const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const chamadasPath = path.join(dataDir, 'chamadas.json');

function readChamadas() {
  if (fs.existsSync(chamadasPath)) {
    try {
      return JSON.parse(fs.readFileSync(chamadasPath, 'utf8'));
    } catch (e) {
      return [];
    }
  }
  return [];
}

function writeChamadas(data) {
  try {
    fs.writeFileSync(chamadasPath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[WebSocket] Erro ao salvar chamadas:', e.message);
  }
}

function initWebSocket(server) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    console.log('[WebSocket] Novo cliente conectado');

    ws.on('message', (message) => {
      try {
        const parsed = JSON.parse(message);
        console.log('[WebSocket] Recebido:', parsed);
        
        // Tratar mensagem de chamada do pdv-client antigo
        if (parsed.tipo === 'caixa-livre') {
          const caixa = parsed.num;
          const tipo = parsed.tipoCaixa || 'Normal';
          const chamada = {
            caixa,
            tipo,
            timestamp: new Date().toISOString()
          };

          // Salvar no histórico de chamadas
          const chamadas = readChamadas();
          chamadas.push(chamada);
          writeChamadas(chamadas);

          // Transmitir para o telão e outros clientes
          wss.broadcast({ type: 'CALL', data: chamada });
          console.log('[WebSocket] Chamada de caixa antigo transmitida:', chamada);
        }
      } catch (e) {
        console.error('[WebSocket] Erro ao processar mensagem', e);
      }
    });

    ws.on('close', () => {
      console.log('[WebSocket] Cliente desconectado');
    });
  });

  wss.broadcast = (data) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  };

  return wss;
}

module.exports = { initWebSocket };
