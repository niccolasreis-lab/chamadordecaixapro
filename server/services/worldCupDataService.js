const fs = require('fs');
const path = require('path');
const footballDataService = require('./footballDataService');
const nativeStatsService = require('./nativeStatsWorldCupService');

const dataDir = path.join(__dirname, '..', 'data');
const copaMundoFile = path.join(dataDir, 'copa_mundo.json');

class WorldCupDataService {
  constructor() {
    this.ultimoErro = null;
  }

  readConfig() {
    if (fs.existsSync(copaMundoFile)) {
      try {
        return JSON.parse(fs.readFileSync(copaMundoFile, 'utf8'));
      } catch (e) {
        console.error('[Copa do Mundo] Erro ao ler copa_mundo.json:', e.message);
      }
    }
    return null;
  }

  writeConfig(data) {
    try {
      fs.writeFileSync(copaMundoFile, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error('[Copa do Mundo] Erro ao gravar copa_mundo.json:', e.message);
    }
  }

  normalizarJogos(jogos) {
    return jogos.map(jogo => ({
      id: jogo.id,
      data: jogo.utcDate,
      status: jogo.status,
      statusTexto: this.formatarData(jogo.utcDate),
      mandante: jogo.homeTeam ? jogo.homeTeam.name : 'A definir',
      visitante: jogo.awayTeam ? jogo.awayTeam.name : 'A definir',
      placarMandante: jogo.score && jogo.score.fullTime ? jogo.score.fullTime.home : null,
      placarVisitante: jogo.score && jogo.score.fullTime ? jogo.score.fullTime.away : null,
      fase: jogo.stage,
      grupo: jogo.group
    }));
  }

  formatarData(dataIso) {
    const d = new Date(dataIso);
    const hj = new Date();
    const isHoje = d.getDate() === hj.getDate() && d.getMonth() === hj.getMonth() && d.getFullYear() === hj.getFullYear();
    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (isHoje) return `Hoje — ${hora}`;
    const amanha = new Date(hj);
    amanha.setDate(amanha.getDate() + 1);
    const isAmanha = d.getDate() === amanha.getDate() && d.getMonth() === amanha.getMonth() && d.getFullYear() === amanha.getFullYear();
    if (isAmanha) return `Amanhã — ${hora}`;
    return `${d.toLocaleDateString('pt-BR')} — ${hora}`;
  }

  normalizarClassificacao(standingsRaw) {
    if (!standingsRaw) return [];
    // O Football-Data retorna a tabela em formato standings[0].table quando é liga, 
    // mas para copa do mundo pode retornar múltiplos arrays (um por grupo).
    // O footballDataService.buscarClassificacao retorna standings[0].table atualmente, 
    // precisaremos garantir que isso funcione para WC se necessário.
    // Assumiremos que footballDataService pode retornar um array de grupos.
    return standingsRaw; // Repassando direto por enquanto
  }

  async buscarComFootballData(config) {
    const ProviderFactory = require('./providers/ProviderFactory');
    let jogosHoje = [];
    let proximosJogos = [];
    let classificacao = [];

    if (config.mostrarJogosHoje) {
      const res = await ProviderFactory.buscarDados('buscarJogosHoje', config.competicao, config.cache ? config.cache.jogosHoje : null);
      jogosHoje = res.data;
    }

    if (config.mostrarProximosJogos) {
      const res = await ProviderFactory.buscarDados('buscarProximosJogos', config.competicao, config.cache ? config.cache.proximosJogos : null);
      proximosJogos = res.data;
    }

    if (config.mostrarClassificacaoGrupos) {
      const res = await ProviderFactory.buscarDados('buscarClassificacao', config.competicao, config.cache ? config.cache.classificacaoGrupos : null);
      classificacao = res.data;
    }

    return { jogosHoje, proximosJogos, classificacaoGrupos: classificacao, estatisticas: [] };
  }

  async atualizarCache(app) {
    const config = this.readConfig();
    if (!config || !config.ativo) return;

    console.log(`[Copa do Mundo] Verificando fontes de dados... Config: ${config.fonteDados}`);
    
    let dados = null;
    let fonteUsada = null;
    let erroFinal = null;

    // Tentativa na Native Stats
    if (config.fonteDados === 'native-stats' || config.fonteDados === 'automatico') {
      const resultNative = await nativeStatsService.buscarDadosCompletos();
      if (resultNative.ok) {
        dados = resultNative.dados;
        fonteUsada = 'native-stats';
      } else {
        if (config.fonteDados === 'native-stats') {
          erroFinal = resultNative.erro;
        } else {
          console.log(`[Copa do Mundo] Native Stats falhou. Usando fallback (football-data). Erro: ${resultNative.erro}`);
        }
      }
    }

    // Tentativa Football Data (se Native falhou em automático, ou se fonte for football-data)
    if (!dados && (config.fonteDados === 'football-data' || config.fonteDados === 'automatico')) {
      try {
        dados = await this.buscarComFootballData(config);
        fonteUsada = 'football-data';
      } catch (e) {
        erroFinal = e.message;
      }
    }

    if (dados) {
      config.cache = dados;
      config.ultimaFonteUsada = fonteUsada;
      config.erro = null;
      config.ultimaAtualizacao = new Date().toISOString();
    } else {
      config.erro = erroFinal || "Nenhuma fonte retornou dados no momento.";
      // Se era automático e a native não funciona, a fallback falhou, marca football-data se era ela
      if (config.fonteDados === 'automatico') {
          config.ultimaFonteUsada = 'football-data'; // Fallback final
      }
    }

    this.writeConfig(config);

    if (app) {
      const wss = app.get('wss');
      if (wss) {
        wss.broadcast({
          type: 'COPA_UPDATE',
          data: {
            fonte: config.ultimaFonteUsada,
            ...config.cache
          }
        });
      }
    }
  }

  getStatus() {
    const config = this.readConfig();
    return {
      ok: config ? !config.erro : false,
      ativo: config ? config.ativo : false,
      competicao: config ? config.competicao : "WC",
      competicaoNome: config ? config.competicaoNome : "Copa do Mundo",
      fonteDados: config ? config.fonteDados : "automatico",
      ultimaFonteUsada: config ? config.ultimaFonteUsada : null,
      ultimaAtualizacao: config ? config.ultimaAtualizacao : null,
      temFootballDataToken: !!process.env.FOOTBALL_DATA_TOKEN,
      temNativeStatsToken: !!process.env.NATIVE_STATS_TOKEN,
      erro: config ? config.erro : null
    };
  }
}

module.exports = new WorldCupDataService();
