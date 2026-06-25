const BaseProvider = require('./BaseProvider');
const CountryService = require('../CountryService');

class FootballDataProvider extends BaseProvider {
  constructor() {
    super('FootballData');
    this.baseUrl = 'https://api.football-data.org/v4';
    this.timeoutMs = 8000;
  }

  getHeaders() {
    const token = process.env.FOOTBALL_DATA_TOKEN;
    if (!token) {
      throw new Error('TOKEN_MISSING');
    }
    return {
      'X-Auth-Token': token,
      'Content-Type': 'application/json'
    };
  }

  async fetchFromAPI(endpoint) {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const startTime = Date.now();
      const response = await fetch(url, {
        headers: this.getHeaders(),
        signal: controller.signal
      });
      clearTimeout(id);

      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`API_ERROR_${response.status}`);
      }

      const data = await response.json();
      console.log(`[Esportes Provider] FootballData fetched ${endpoint} in ${responseTime}ms`);
      return { data, responseTime };
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  }

  getTodayString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getFutureDateString(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  normalizarJogos(matches) {
    if (!matches) return [];
    return matches.map(jogo => {
      const homeName = jogo.homeTeam ? jogo.homeTeam.name : 'A definir';
      const awayName = jogo.awayTeam ? jogo.awayTeam.name : 'A definir';

      const homeMeta = CountryService.getMetadata(homeName);
      const awayMeta = CountryService.getMetadata(awayName);

      return {
        id: jogo.id,
        data: jogo.utcDate,
        status: jogo.status,
        statusTexto: this.formatarData(jogo.utcDate),
        mandante: this.normalizarTime(homeName),
        visitante: this.normalizarTime(awayName),
        placarMandante: jogo.score && jogo.score.fullTime ? jogo.score.fullTime.home : null,
        placarVisitante: jogo.score && jogo.score.fullTime ? jogo.score.fullTime.away : null,
        fase: jogo.stage,
        grupo: jogo.group,
        crestMandante: jogo.homeTeam ? jogo.homeTeam.crest : null,
        crestVisitante: jogo.awayTeam ? jogo.awayTeam.crest : null,
        // Códigos ISO obtidos através do CountryService
        countryMandanteCode: homeMeta ? homeMeta.iso2 : null,
        countryVisitanteCode: awayMeta ? awayMeta.iso2 : null,
        lastUpdated: new Date().toISOString()
      };
    });
  }

  async buscarJogosHoje(competicao) {
    const today = this.getTodayString();
    const { data } = await this.fetchFromAPI(`/competitions/${competicao}/matches?dateFrom=${today}&dateTo=${today}`);
    return this.normalizarJogos(data.matches || []);
  }

  async buscarProximosJogos(competicao) {
    const today = this.getTodayString();
    const future = this.getFutureDateString(7);
    const { data } = await this.fetchFromAPI(`/competitions/${competicao}/matches?dateFrom=${today}&dateTo=${future}&status=SCHEDULED,TIMED`);
    return this.normalizarJogos(data.matches || []);
  }

  async buscarClassificacao(competicao) {
    const { data } = await this.fetchFromAPI(`/competitions/${competicao}/standings`);
    if (!data.standings) return [];

    // Adaptação para suportar tanto liga normal quanto grupos de copa
    return data.standings.map(standingGroup => {
      return {
        stage: standingGroup.stage,
        type: standingGroup.type,
        group: standingGroup.group ? CountryService.translate(standingGroup.group) : null,
        table: (standingGroup.table || []).map(row => {
          const teamName = row.team ? row.team.name : 'Time';
          const teamMeta = CountryService.getMetadata(teamName);

          return {
            position: row.position,
            team: {
              id: row.team ? row.team.id : null,
              name: this.normalizarTime(teamName),
              shortName: row.team ? this.normalizarTime(row.team.shortName || row.team.name) : null,
              crest: row.team ? row.team.crest : null,
              iso2: teamMeta ? teamMeta.iso2 : null
            },
            playedGames: row.playedGames,
            won: row.won,
            draw: row.draw,
            lost: row.lost,
            points: row.points,
            goalsFor: row.goalsFor,
            goalsAgainst: row.goalsAgainst,
            goalDifference: row.goalDifference
          };
        })
      };
    });
  }
}

module.exports = FootballDataProvider;
