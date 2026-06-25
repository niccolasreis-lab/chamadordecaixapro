const http = require('http');

const SERVER_URL = 'http://localhost:3001';

async function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get(`${SERVER_URL}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch(e) {
            resolve(data);
          }
        } else {
          reject(new Error(`Status ${res.statusCode}: ${data}`));
        }
      });
    }).on('error', reject);
  });
}

async function postJson(path, payload = {}) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const url = new URL(`${SERVER_URL}${path}`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch(e) {
            resolve(data);
          }
        } else {
          reject(new Error(`Status ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('=== INICIANDO VALIDACAO AUTOMATICA DO PAINEL ADMIN ===\n');
  const failures = [];
  const okEndpoints = [];
  
  // 1. GET /api/status
  try {
    const status = await getJson('/api/status');
    if (status && status.status === 'online') {
      okEndpoints.push('GET /api/status');
    } else {
      failures.push('GET /api/status retornou resposta invalida');
    }
  } catch (err) {
    failures.push(`GET /api/status falhou: ${err.message}`);
  }
  
  // 2. GET /api/config
  try {
    const config = await getJson('/api/config');
    if (config && config.somMidia !== undefined) {
      okEndpoints.push('GET /api/config');
    } else {
      failures.push('GET /api/config retornou estrutura invalida');
    }
  } catch (err) {
    failures.push(`GET /api/config falhou: ${err.message}`);
  }

  // 3. GET /api/midias
  let midias = [];
  try {
    midias = await getJson('/api/midias');
    if (Array.isArray(midias)) {
      okEndpoints.push('GET /api/midias');
      console.log(`- Mídias encontradas: ${midias.length}`);
      const ativas = midias.filter(m => m.ativo === true).length;
      console.log(`- Mídias ativas: ${ativas}`);
      const primeira = midias.find(m => m.reproduzirPrimeiro === true);
      console.log(`- Mídia marcada como primeira: ${primeira ? primeira.nome : 'Nenhuma'}`);
    } else {
      failures.push('GET /api/midias nao retornou um array');
    }
  } catch (err) {
    failures.push(`GET /api/midias falhou: ${err.message}`);
  }

  // 4. GET /api/streams
  let streams = [];
  try {
    streams = await getJson('/api/streams');
    if (Array.isArray(streams)) {
      okEndpoints.push('GET /api/streams');
      console.log(`- Streams cadastrados: ${streams.length}`);
      const ativo = streams.find(s => s.ativo === true);
      console.log(`- Stream ativo: ${ativo ? ativo.url : 'Nenhum'}`);
    } else {
      failures.push('GET /api/streams nao retornou um array');
    }
  } catch (err) {
    failures.push(`GET /api/streams falhou: ${err.message}`);
  }

  // 5. POST /api/midias/:id/testar
  if (midias.length > 0) {
    const testId = midias[0].id;
    try {
      const res = await postJson(`/api/midias/${testId}/testar`);
      if (res && res.success) {
        okEndpoints.push(`POST /api/midias/:id/testar`);
      } else {
        failures.push(`POST /api/midias/:id/testar retornou falha na resposta`);
      }
    } catch (err) {
      failures.push(`POST /api/midias/:id/testar falhou: ${err.message}`);
    }
  } else {
    console.log('- Pulando teste de testar mídia (nenhuma mídia cadastrada)');
  }

  // 6. POST /api/chamar
  try {
    const callRes = await postJson('/api/chamar', { caixa: 6, tipo: 'Preferencial' });
    if (callRes && callRes.success) {
      okEndpoints.push('POST /api/chamar');
    } else {
      failures.push('POST /api/chamar retornou falha na resposta');
    }
  } catch (err) {
    failures.push(`POST /api/chamar falhou: ${err.message}`);
  }

  // 7. GET /api/institucional
  try {
    const inst = await getJson('/api/institucional');
    if (inst && inst.nome) {
      okEndpoints.push('GET /api/institucional');
      console.log(`- Nome Institucional: ${inst.nome}`);
    } else {
      failures.push('GET /api/institucional retornou resposta sem nome');
    }
  } catch (err) {
    failures.push(`GET /api/institucional falhou: ${err.message}`);
  }

  // 8. GET /api/copa/config
  try {
    const copaCfg = await getJson('/api/copa/config');
    if (copaCfg && copaCfg.intervaloAtualizacaoSegundos !== undefined) {
      okEndpoints.push('GET /api/copa/config');
    } else {
      failures.push('GET /api/copa/config retornou estrutura invalida');
    }
  } catch (err) {
    failures.push(`GET /api/copa/config falhou: ${err.message}`);
  }

  // 9. GET /api/copa/status
  try {
    const copaSts = await getJson('/api/copa/status');
    if (copaSts && copaSts.fonteDados !== undefined) {
      okEndpoints.push('GET /api/copa/status');
      console.log(`- Status Copa do Mundo: ${copaSts.ativo ? 'Ativo' : 'Inativo'} (Fonte: ${copaSts.fonteDados})`);
    } else {
      failures.push('GET /api/copa/status retornou resposta invalida');
    }
  } catch (err) {
    failures.push(`GET /api/copa/status falhou: ${err.message}`);
  }

  // 10. GET /api/esportes/config
  try {
    const espCfg = await getJson('/api/esportes/config');
    if (espCfg && espCfg.intervaloAtualizacaoSegundos !== undefined) {
      okEndpoints.push('GET /api/esportes/config');
    } else {
      failures.push('GET /api/esportes/config retornou estrutura invalida');
    }
  } catch (err) {
    failures.push(`GET /api/esportes/config falhou: ${err.message}`);
  }

  // 11. GET /api/esportes/status
  try {
    const espSts = await getJson('/api/esportes/status');
    if (espSts && espSts.ok !== undefined) {
      okEndpoints.push('GET /api/esportes/status');
    } else {
      failures.push('GET /api/esportes/status retornou resposta invalida');
    }
  } catch (err) {
    failures.push(`GET /api/esportes/status falhou: ${err.message}`);
  }

  console.log('\n=== RESULTADO DA VALIDACAO ===');
  console.log(`\nEndpoints OK:`);
  okEndpoints.forEach(ep => console.log(`  [OK] ${ep}`));
  
  if (failures.length > 0) {
    console.log(`\nFalhas encontradas:`);
    failures.forEach(f => console.log(`  [FALHA] ${f}`));
    process.exit(1);
  } else {
    console.log(`\n[SUCESSO] Todos os testes passaram sem falhas!`);
    process.exit(0);
  }
}

run();
