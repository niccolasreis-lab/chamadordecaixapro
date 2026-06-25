const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const esportesFile = path.join(dataDir, 'esportes.json');

let ultimoErro = null;
let errorStatusCode = null;

const BASE_URL = 'https://api.football-data.org/v4';

function getHeaders() {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    throw new Error('TOKEN_MISSING');
  }
  return {
    'X-Auth-Token': token,
    'Content-Type': 'application/json'
  };
}

function readEsportesConfig() {
  if (fs.existsSync(esportesFile)) {
    try {
      return JSON.parse(fs.readFileSync(esportesFile, 'utf8'));
    } catch (e) {
      console.error('[Esportes] Erro ao ler esportes.json:', e.message);
    }
  }
  return null;
}

function writeEsportesConfig(data) {
  try {
    fs.writeFileSync(esportesFile, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[Esportes] Erro ao gravar esportes.json:', e.message);
  }
}

async function fetchFromAPI(endpoint) {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      headers: getHeaders()
    });

    if (!response.ok) {
      errorStatusCode = response.status;
      if (response.status === 403 || response.status === 429) {
         throw new Error('RATE_LIMIT_OR_UNAVAILABLE');
      }
      throw new Error(`API_ERROR_${response.status}`);
    }

    const data = await response.json();
    ultimoErro = null;
    errorStatusCode = null;
    return data;
  } catch (error) {
    if (error.message === 'TOKEN_MISSING') {
      ultimoErro = 'Token football-data.org não configurado.';
    } else if (error.message === 'RATE_LIMIT_OR_UNAVAILABLE') {
      ultimoErro = `Competição indisponível no plano atual da API ou limite de requisições atingido. (Erro ${errorStatusCode})`;
    } else {
      ultimoErro = `Erro ao acessar API Esportiva: ${error.message}`;
    }
    console.error(`[Esportes API] ${ultimoErro}`);
    throw error;
  }
}

function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getFutureDateString(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const ProviderFactory = require('./providers/ProviderFactory');

async function buscarJogosHoje(competicao) {
  const res = await ProviderFactory.buscarDados('buscarJogosHoje', competicao);
  return res.data;
}

async function buscarProximosJogos(competicao) {
  const res = await ProviderFactory.buscarDados('buscarProximosJogos', competicao);
  return res.data;
}

async function buscarClassificacao(competicao) {
  const res = await ProviderFactory.buscarDados('buscarClassificacao', competicao);
  return res.data;
}

async function atualizarCacheEsportivo(app) {
  const config = readEsportesConfig();
  if (!config || !config.ativo || !config.competicao) {
    return;
  }

  console.log(`[Esportes] Atualizando cache com provedores para competicao: ${config.competicao}`);
  
  let updated = false;
  let matchesToday = config.cache.jogosHoje || [];
  let futureMatches = config.cache.proximosJogos || [];
  let standings = config.cache.classificacao || [];
  let erroAcumulado = null;
  let fonteUsada = process.env.SPORT_PROVIDER || 'football-data';

  try {
    if (config.mostrarJogosHoje) {
      const res = await ProviderFactory.buscarDados('buscarJogosHoje', config.competicao, config.cache.jogosHoje);
      matchesToday = res.data;
      fonteUsada = res.fonteUsada;
      if (res.erro) erroAcumulado = res.erro;
    }
    
    if (config.mostrarProximosJogos) {
      const res = await ProviderFactory.buscarDados('buscarProximosJogos', config.competicao, config.cache.proximosJogos);
      futureMatches = res.data;
      fonteUsada = res.fonteUsada;
      if (res.erro) erroAcumulado = res.erro;
    }

    if (config.mostrarClassificacao) {
      const res = await ProviderFactory.buscarDados('buscarClassificacao', config.competicao, config.cache.classificacao);
      standings = res.data;
      fonteUsada = res.fonteUsada;
      if (res.erro) erroAcumulado = res.erro;
    }

    updated = true;
    ultimoErro = erroAcumulado;
  } catch (e) {
    ultimoErro = e.message;
    console.error('[Esportes] Falha crítica ao atualizar dados na cadeia de provedores:', e.message);
  }

  if (updated || ultimoErro) {
     config.cache.jogosHoje = matchesToday;
     config.cache.proximosJogos = futureMatches;
     config.cache.classificacao = standings;
     config.ultimaAtualizacao = new Date().toISOString();
     config.provedorAtivo = ProviderFactory.getProvedorAtivo().name;
     config.fonteUsada = fonteUsada;
     writeEsportesConfig(config);

     // Emitir WS se tivermos acesso ao app
     if (app) {
        const wss = app.get('wss');
        if (wss) {
          wss.broadcast({
            type: 'SPORTS_UPDATE',
            data: config.cache
          });
        }
     }
  }
}

function getStatus() {
  const config = readEsportesConfig();
  return {
    ok: !ultimoErro,
    ativo: config ? config.ativo : false,
    competicao: config ? config.competicao : null,
    competicaoNome: config ? config.competicaoNome : null,
    ultimaAtualizacao: config ? config.ultimaAtualizacao : null,
    provedorAtivo: config ? config.provedorAtivo : (process.env.SPORT_PROVIDER || 'football-data'),
    fonteUsada: config ? config.fonteUsada : null,
    temToken: !!process.env.FOOTBALL_DATA_TOKEN,
    erro: ultimoErro
  };
}

module.exports = {
  readEsportesConfig,
  writeEsportesConfig,
  buscarJogosHoje,
  buscarProximosJogos,
  buscarClassificacao,
  atualizarCacheEsportivo,
  getStatus
};
