const fs = require('fs');
const path = require('path');
const BaseProvider = require('./BaseProvider');
const CountryService = require('../CountryService');

const CACHE_FILE = path.join(__dirname, '..', '..', 'data', 'worldcup26-cache.json');

class WorldCup26Provider extends BaseProvider {
  constructor() {
    super('WorldCup26');
    this.baseUrl = process.env.WORLDCUP26_BASE_URL || 'https://worldcup26.ir';
    this.token = process.env.WORLDCUP26_TOKEN || '';
    this.isRefreshing = false;
    this.cache = {
      rawGames: [],
      rawGroups: [],
      rawTeams: [],
      lastUpdated: null,
      durationMs: 0
    };

    this.CACHE_TTL_MS = (parseInt(process.env.FOOTBALL_CACHE_TTL_SECONDS) || 300) * 1000;
    this.STALE_TTL_MS = (parseInt(process.env.FOOTBALL_CACHE_STALE_TTL_SECONDS) || 3600) * 1000;
    this.LIVE_CACHE_TTL_MS = (parseInt(process.env.FOOTBALL_LIVE_CACHE_TTL_SECONDS) || 60) * 1000;
    this.LIVE_STALE_TTL_MS = (parseInt(process.env.FOOTBALL_LIVE_CACHE_STALE_TTL_SECONDS) || 600) * 1000;
    this.BACKGROUND_TIMEOUT_MS = parseInt(process.env.WORLDCUP26_BACKGROUND_TIMEOUT_MS) || 25000;
    this.SYNC_TIMEOUT_MS = 5000;

    this.loadCacheFromDisk();
  }

  _normalizeArray(value, key) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (value[key] && Array.isArray(value[key])) return value[key];
    if (value.data && Array.isArray(value.data)) return value.data;
    if (value.data && value.data[key] && Array.isArray(value.data[key])) return value.data[key];
    return [];
  }

  loadCacheFromDisk() {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const raw = fs.readFileSync(CACHE_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed) {
          this.cache = {
            rawGames: this._normalizeArray(parsed.rawGames, 'games'),
            rawGroups: this._normalizeArray(parsed.rawGroups, 'groups'),
            rawTeams: this._normalizeArray(parsed.rawTeams, 'teams'),
            lastUpdated: parsed.lastUpdated || null,
            durationMs: parsed.durationMs || 0
          };
          console.log(`[${this.name}] Cache carregado do disco. Última atualização: ${this.cache.lastUpdated}`);
        }
      }
    } catch (e) {
      console.error(`[${this.name}] Erro ao ler cache do disco:`, e.message);
    }
  }

  saveCacheToDisk() {
    try {
      const dir = path.dirname(CACHE_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const serialized = {
        rawGames: this._normalizeArray(this.cache.rawGames, 'games'),
        rawGroups: this._normalizeArray(this.cache.rawGroups, 'groups'),
        rawTeams: this._normalizeArray(this.cache.rawTeams, 'teams'),
        lastUpdated: this.cache.lastUpdated || null,
        durationMs: this.cache.durationMs || 0
      };
      fs.writeFileSync(CACHE_FILE, JSON.stringify(serialized, null, 2));
    } catch (e) {
      console.error(`[${this.name}] Erro ao salvar cache no disco:`, e.message);
    }
  }

  hasLiveGame() {
    if (!this.cache || !this.cache.rawGames) return false;
    return this.cache.rawGames.some(g => {
      const st = this.mapStatus(g);
      return st === 'IN_PLAY' || st === 'PAUSED';
    });
  }

  getCacheStatus() {
    if (!this.cache || !this.cache.lastUpdated) return 'unavailable';
    const age = Date.now() - new Date(this.cache.lastUpdated).getTime();
    const isLive = this.hasLiveGame();
    const freshTtl = isLive ? this.LIVE_CACHE_TTL_MS : this.CACHE_TTL_MS;
    const staleTtl = isLive ? this.LIVE_STALE_TTL_MS : this.STALE_TTL_MS;

    if (age <= freshTtl) return 'fresh';
    if (age <= staleTtl) return 'stale';
    return 'expired';
  }

  parseWorldCup26LocalDate(localDateStr) {
    if (!localDateStr) return new Date();
    const match = localDateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
    if (match) {
      const [, month, day, year, hour, minute] = match;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute));
    }
    return new Date(localDateStr);
  }

  mapStatus(game) {
    if (!game) return 'SCHEDULED';
    // A API WorldCup26 usa 'finished' (TRUE/FALSE) e 'time_elapsed' em vez de 'status'
    const rawStatus = game.status || game.time_elapsed || '';
    const finished = game.finished;
    
    // Se finished é TRUE (string), o jogo terminou
    if (finished === 'TRUE' || finished === true) return 'FINISHED';
    
    const s = rawStatus.toString().toUpperCase();
    if (s === 'FT' || s === 'FINISHED' || s === 'FINISHED_FULL_TIME') return 'FINISHED';
    if (s === 'IP' || s === 'IN_PLAY' || s === 'LIVE' || s === '1H' || s === '2H' || s === 'HT') return 'IN_PLAY';
    if (s === 'P' || s === 'PAUSED' || s === 'PEN' || s === 'BREAK') return 'PAUSED';
    
    // Se não tem status mas tem finished FALSE, está agendado
    if (finished === 'FALSE' || finished === false) return 'SCHEDULED';
    // Se time_elapsed contém algo além de 'finished', pode estar em jogo
    if (rawStatus && rawStatus !== 'finished' && rawStatus !== '') return 'IN_PLAY';
    
    return 'SCHEDULED';
  }

  normalizarJogos(matches) {
    if (!matches || !Array.isArray(matches)) return [];
    return matches.map(game => {
      // A API WorldCup26 usa snake_case: home_team_name_en, away_team_name_en
      const homeName = game.home_team_name_en || game.homeTeam || game.home || game.homeTeamName || 'A definir';
      const awayName = game.away_team_name_en || game.awayTeam || game.away || game.awayTeamName || 'A definir';

      const homeMeta = CountryService.getMetadata(homeName);
      const awayMeta = CountryService.getMetadata(awayName);

      // A API WorldCup26 usa local_date (snake_case) no formato "MM/DD/YYYY HH:MM"
      const dateRaw = game.local_date || game.date || game.utcDate || game.localDate || game.matchDate || '';
      let dateObj;
      if (typeof dateRaw === 'string' && dateRaw.match(/^\d{2}\/\d{2}\/\d{4}/)) {
        dateObj = this.parseWorldCup26LocalDate(dateRaw);
      } else {
        dateObj = new Date(dateRaw);
      }
      const dateIso = dateObj.toISOString();

      const status = this.mapStatus(game);

      // A API WorldCup26 usa home_score e away_score (snake_case, strings)
      const homeScore = game.home_score !== undefined ? parseInt(game.home_score) : (game.homeScore !== undefined ? game.homeScore : (game.score && game.score.home !== undefined ? game.score.home : null));
      const awayScore = game.away_score !== undefined ? parseInt(game.away_score) : (game.awayScore !== undefined ? game.awayScore : (game.score && game.score.away !== undefined ? game.score.away : null));

      return {
        id: game.id || game.matchId || `wc26-${homeName}-${awayName}-${dateIso}`,
        data: dateIso,
        status: status,
        statusTexto: this.formatarData(dateIso),
        mandante: this.normalizarTime(homeName),
        visitante: this.normalizarTime(awayName),
        placarMandante: isNaN(homeScore) ? null : homeScore,
        placarVisitante: isNaN(awayScore) ? null : awayScore,
        fase: game.stage || game.phase || game.type || 'GROUP_STAGE',
        grupo: game.group || game.groupName || null,
        crestMandante: homeMeta ? `https://flagcdn.com/w80/${homeMeta.iso2.toLowerCase()}.png` : null,
        crestVisitante: awayMeta ? `https://flagcdn.com/w80/${awayMeta.iso2.toLowerCase()}.png` : null,
        countryMandanteCode: homeMeta ? homeMeta.iso2 : null,
        countryVisitanteCode: awayMeta ? awayMeta.iso2 : null,
        lastUpdated: new Date().toISOString()
      };
    });
  }

  async _fetchWithTimeout(endpoint, timeoutMs) {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    try {
      const response = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(id);
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      return await response.json();
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  }

  async _ensureCache() {
    const status = this.getCacheStatus();

    if (status === 'fresh') {
      return this.cache;
    }

    if (status === 'stale') {
      this.backgroundRefresh();
      return this.cache;
    }

    try {
      const gamesData = await this._fetchWithTimeout('/get/games', this.SYNC_TIMEOUT_MS);
      const rawGames = this._normalizeArray(gamesData, 'games');
      this.cache = {
        rawGames,
        rawGroups: this.cache ? this.cache.rawGroups : [],
        rawTeams: this.cache ? this.cache.rawTeams : [],
        lastUpdated: new Date().toISOString(),
        durationMs: 0
      };
      this.saveCacheToDisk();
    } catch (e) {
      console.warn(`[${this.name}] Busca síncrona inicial falhou:`, e.message);
    }

    this.backgroundRefresh();
    return this.cache;
  }

  async backgroundRefresh() {
    if (this.isRefreshing) return;
    this.isRefreshing = true;
    const startTs = Date.now();

    try {
      const [gamesResult, groupsResult, teamsResult] = await Promise.allSettled([
        this._fetchWithTimeout('/get/games', this.BACKGROUND_TIMEOUT_MS),
        this._fetchWithTimeout('/get/groups', this.BACKGROUND_TIMEOUT_MS),
        this._fetchWithTimeout('/get/teams', this.BACKGROUND_TIMEOUT_MS)
      ]);

      let rawGames = this.cache ? this.cache.rawGames : [];
      let rawGroups = this.cache ? this.cache.rawGroups : [];
      let rawTeams = this.cache ? this.cache.rawTeams : [];

      if (gamesResult.status === 'fulfilled') {
        rawGames = this._normalizeArray(gamesResult.value, 'games');
      } else {
        console.warn(`[${this.name}] backgroundRefresh: falha ao buscar jogos:`, gamesResult.reason?.message);
      }

      if (groupsResult.status === 'fulfilled') {
        rawGroups = this._normalizeArray(groupsResult.value, 'groups');
      }

      if (teamsResult.status === 'fulfilled') {
        rawTeams = this._normalizeArray(teamsResult.value, 'teams');
      }

      this.cache = {
        rawGames,
        rawGroups,
        rawTeams,
        lastUpdated: new Date().toISOString(),
        durationMs: Date.now() - startTs
      };
      this.saveCacheToDisk();
      console.log(`[${this.name}] backgroundRefresh concluído em ${Date.now() - startTs}ms. Jogos: ${rawGames.length}`);
    } catch (e) {
      console.error(`[${this.name}] Erro inesperado no backgroundRefresh:`, e.message);
    } finally {
      this.isRefreshing = false;
    }
  }

  async buscarJogosHoje(competicao) {
    const cache = await this._ensureCache();
    if (!cache || !cache.rawGames) return [];

    const hoje = new Date();
    const todayStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

    const jogosHoje = cache.rawGames.filter(g => {
      // A API WorldCup26 usa local_date (snake_case)
      const dateRaw = g.local_date || g.date || g.utcDate || g.localDate || '';
      let dateObj;
      if (typeof dateRaw === 'string' && dateRaw.match(/^\d{2}\/\d{2}\/\d{4}/)) {
        dateObj = this.parseWorldCup26LocalDate(dateRaw);
      } else {
        dateObj = new Date(dateRaw);
      }
      const gameDateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      return gameDateStr === todayStr;
    });

    return this.normalizarJogos(jogosHoje);
  }

  async buscarProximosJogos(competicao) {
    const cache = await this._ensureCache();
    if (!cache || !cache.rawGames) return [];

    const agora = new Date();
    const proximos = cache.rawGames.filter(g => {
      // A API WorldCup26 usa local_date (snake_case)
      const dateRaw = g.local_date || g.date || g.utcDate || g.localDate || '';
      let dateObj;
      if (typeof dateRaw === 'string' && dateRaw.match(/^\d{2}\/\d{2}\/\d{4}/)) {
        dateObj = this.parseWorldCup26LocalDate(dateRaw);
      } else {
        dateObj = new Date(dateRaw);
      }
      const st = this.mapStatus(g);
      return dateObj > agora && (st === 'SCHEDULED' || st === 'PAUSED');
    });

    proximos.sort((a, b) => {
      const dateRawA = a.local_date || a.date || a.utcDate || a.localDate || '';
      const dateRawB = b.local_date || b.date || b.utcDate || b.localDate || '';
      let dA, dB;
      if (typeof dateRawA === 'string' && dateRawA.match(/^\d{2}\/\d{2}\/\d{4}/)) {
        dA = this.parseWorldCup26LocalDate(dateRawA);
      } else {
        dA = new Date(dateRawA);
      }
      if (typeof dateRawB === 'string' && dateRawB.match(/^\d{2}\/\d{2}\/\d{4}/)) {
        dB = this.parseWorldCup26LocalDate(dateRawB);
      } else {
        dB = new Date(dateRawB);
      }
      return dA - dB;
    });

    return this.normalizarJogos(proximos.slice(0, 20));
  }

  async buscarClassificacao(competicao) {
    const cache = await this._ensureCache();
    if (!cache || !cache.rawGroups) return [];

    const teamsData = {};
    if (cache.rawTeams && Array.isArray(cache.rawTeams)) {
      cache.rawTeams.forEach(t => {
        // A API WorldCup26 usa 'id' como chave de identificação
        const id = t.id || t.teamId || t.code;
        if (id) teamsData[id] = t;
      });
    }

    const groups = Array.isArray(cache.rawGroups) ? cache.rawGroups : [];
    return groups.map(group => {
      const groupName = group.name || group.groupName || group.id || 'Grupo';
      const teams = group.teams || group.standings || group.table || [];

      const table = teams.map((t, idx) => {
        // A API WorldCup26 usa team_id (snake_case) nos grupos
        const teamId = t.team_id || t.id || t.teamId || t.team;
        const teamInfo = teamsData[teamId] || t;
        // A API WorldCup26 usa name_en para o nome em inglês dos times
        const teamName = teamInfo.name_en || teamInfo.name || teamInfo.teamName || teamInfo.team || `Time ${idx + 1}`;
        const teamMeta = CountryService.getMetadata(teamName);

        // A API WorldCup26 usa campos abreviados: mp, w, d, l, pts, gf, ga, gd
        const playedGames = parseInt(t.mp) || t.playedGames || t.played || t.gamesPlayed || 0;
        const won = parseInt(t.w) || t.won || t.wins || 0;
        const draw = parseInt(t.d) || t.draw || t.draws || t.ties || 0;
        const lost = parseInt(t.l) || t.lost || t.losses || 0;
        const points = parseInt(t.pts) || t.points || 0;
        const goalsFor = parseInt(t.gf) || t.goalsFor || t.goalsScored || 0;
        const goalsAgainst = parseInt(t.ga) || t.goalsAgainst || t.goalsConceded || 0;
        const goalDifference = parseInt(t.gd) || t.goalDifference || (goalsFor - goalsAgainst);

        // Usar crest do teamInfo (flag da API) ou fallback do CountryService
        const crest = teamInfo.flag || (teamMeta ? `https://flagcdn.com/w80/${teamMeta.iso2.toLowerCase()}.png` : null);
        const iso2 = teamInfo.iso2 || (teamMeta ? teamMeta.iso2 : null);

        return {
          position: t.position || (idx + 1),
          team: {
            id: teamId,
            name: this.normalizarTime(teamName),
            shortName: this.normalizarTime(teamInfo.shortName || teamInfo.fifa_code || teamName),
            crest: crest,
            iso2: iso2
          },
          playedGames,
          won,
          draw,
          lost,
          points,
          goalsFor,
          goalsAgainst,
          goalDifference
        };
      });

      table.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
        return b.goalsFor - a.goalsFor;
      });

      table.forEach((row, i) => { row.position = i + 1; });

      return {
        stage: 'GROUP_STAGE',
        type: 'TOTAL',
        group: CountryService.translate(groupName),
        table
      };
    });
  }

  getHealthInfo() {
    const cacheStatus = this.getCacheStatus();
    return {
      provider: this.name,
      cacheStatus,
      lastUpdated: this.cache ? this.cache.lastUpdated : null,
      gamesCount: this.cache && this.cache.rawGames ? this.cache.rawGames.length : 0,
      groupsCount: this.cache && this.cache.rawGroups ? this.cache.rawGroups.length : 0,
      teamsCount: this.cache && this.cache.rawTeams ? this.cache.rawTeams.length : 0,
      durationMs: this.cache ? this.cache.durationMs : null,
      isRefreshing: this.isRefreshing,
      hasLiveGame: this.hasLiveGame()
    };
  }
}

module.exports = WorldCup26Provider;
