const FootballDataProvider = require('./FootballDataProvider');
const SofascoreProvider = require('./SofascoreProvider');
const WorldCup26Provider = require('./WorldCup26Provider');
const MockProvider = require('./MockProvider');

const providers = {
  'football-data': new FootballDataProvider(),
  'sofascore': new SofascoreProvider(),
  'worldcup26': new WorldCup26Provider(),
  'mock': new MockProvider()
};

const providerHealth = {};

function recordHealth(providerName, success, error, durationMs) {
  if (!providerHealth[providerName]) {
    providerHealth[providerName] = { lastSuccess: null, lastError: null, lastDurationMs: null };
  }
  providerHealth[providerName].lastDurationMs = durationMs;
  if (success) {
    providerHealth[providerName].lastSuccess = new Date().toISOString();
    providerHealth[providerName].lastError = null;
  } else {
    providerHealth[providerName].lastError = {
      message: error,
      timestamp: new Date().toISOString()
    };
  }
}

async function executarComLog(provider, metodo, competicao) {
  const startTime = Date.now();
  console.log(`[Engine Esportiva] Executando ${provider.name} -> ${metodo} (Competicao: ${competicao})`);

  try {
    const res = await provider[metodo](competicao);
    const duration = Date.now() - startTime;
    console.log(`[Engine Esportiva] OK: ${provider.name} -> ${metodo} executado em ${duration}ms. Quantidade: ${res.length || 0}`);
    recordHealth(provider.name, true, null, duration);
    return {
      success: true,
      data: res,
      duration,
      provider: provider.name
    };
  } catch (err) {
    const duration = Date.now() - startTime;
    console.error(`[Engine Esportiva] FALHA: ${provider.name} -> ${metodo} falhou após ${duration}ms. Erro: ${err.message}`);
    recordHealth(provider.name, false, err.message, duration);
    return {
      success: false,
      error: err.message,
      duration,
      provider: provider.name
    };
  }
}

function getActiveProviderKey() {
  return (process.env.FOOTBALL_PROVIDER || process.env.SPORT_PROVIDER || 'worldcup26').toLowerCase();
}

function getFallbackProviderKey() {
  return (process.env.FOOTBALL_PROVIDER_FALLBACK || 'football-data').toLowerCase();
}

const ProviderFactory = {
  getProvedorAtivo() {
    const key = getActiveProviderKey();
    return providers[key] || providers['worldcup26'];
  },

  getProvedorFallback() {
    const key = getFallbackProviderKey();
    return providers[key] || providers['football-data'];
  },

  getProviderHealth() {
    const active = getActiveProviderKey();
    const fallback = getFallbackProviderKey();

    const details = {};
    for (const [name, provider] of Object.entries(providers)) {
      const health = providerHealth[name] || { lastSuccess: null, lastError: null, lastDurationMs: null };
      let extraInfo = null;
      if (typeof provider.getHealthInfo === 'function') {
        extraInfo = provider.getHealthInfo();
      }
      details[name] = { ...health, ...extraInfo };
    }

    let status = 'ok';
    const activeHealth = providerHealth[active];
    if (activeHealth && activeHealth.lastError) {
      status = 'degraded';
    }
    if (activeHealth && activeHealth.lastError && !providerHealth[fallback]?.lastSuccess) {
      status = 'error';
    }

    return {
      activeProvider: active,
      fallbackProvider: fallback,
      status,
      details
    };
  },

  async buscarDados(metodo, competicao, cacheAntigo = null) {
    const disableFallback = process.env.FOOTBALL_DISABLE_FALLBACK === 'true';
    const primaryKey = getActiveProviderKey();
    const fallbackKey = getFallbackProviderKey();

    const chain = [];
    if (providers[primaryKey]) chain.push(providers[primaryKey]);
    if (!disableFallback && providers[fallbackKey] && fallbackKey !== primaryKey) {
      chain.push(providers[fallbackKey]);
    }
    if (!disableFallback) chain.push(providers['mock']);

    let finalData = null;
    let fonteUsada = null;
    let errors = [];

    for (const provider of chain) {
      const result = await executarComLog(provider, metodo, competicao);
      if (result.success) {
        finalData = result.data;
        fonteUsada = provider.name;
        break;
      } else {
        errors.push(`${provider.name}: ${result.error}`);
      }
    }

    if (!finalData && cacheAntigo) {
      console.warn(`[Engine Esportiva] Toda a cadeia de provedores falhou. Usando Cache Local antigo.`);
      return {
        data: cacheAntigo,
        fonteUsada: 'cache-local',
        erro: `Falhas na cadeia de provedores: [${errors.join(' | ')}]. Utilizando cache salvo.`
      };
    }

    if (finalData) {
      return {
        data: finalData,
        fonteUsada: fonteUsada || primaryKey,
        erro: errors.length > 0 ? `Fallback ativado: ${errors.join(' | ')}` : null
      };
    }

    throw new Error(`Toda a cadeia de provedores e cache local falharam. Erros: ${errors.join(', ')}`);
  },

  async forcarAtualizacaoBackground() {
    const primaryKey = getActiveProviderKey();
    const provider = providers[primaryKey];
    if (provider && typeof provider.backgroundRefresh === 'function') {
      console.log(`[Engine Esportiva] Forçando refresh em background no provedor: ${provider.name}`);
      await provider.backgroundRefresh();
      return { provider: provider.name, triggered: true };
    }
    return { provider: primaryKey, triggered: false, reason: 'Provedor não suporta refresh em background' };
  }
};

module.exports = ProviderFactory;
