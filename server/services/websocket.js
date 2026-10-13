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

function initWebSocket(server, { subscription } = {}) {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    console.log('[WebSocket] Novo cliente conectado');
    ws.clientRole = null;
    ws.displayId = null;
    if (subscription) ws.send(JSON.stringify({type:'SUBSCRIPTION_STATUS',data:subscription.publicStatus()}));

    ws.on('message', (message) => {
      try {
        const parsed = JSON.parse(message);
        if (subscription && !subscription.isAllowed()) {
          ws.send(JSON.stringify({type:'SUBSCRIPTION_STATUS',data:subscription.publicStatus()}));
          return;
        }
        console.log('[WebSocket] Recebido:', parsed);

        if (parsed.type === 'CLIENT_REGISTER' && parsed.data?.role === 'display') {
          const displayId = String(parsed.data.clientId || '').trim();
          if (!/^[a-zA-Z0-9._:-]{1,128}$/.test(displayId)) {
            ws.send(JSON.stringify({ type: 'CLIENT_REGISTERED', data: { success: false } }));
            return;
          }
          ws.clientRole = 'display';
          ws.displayId = displayId;
          ws.send(JSON.stringify({
            type: 'CLIENT_REGISTERED',
            data: { success: true, role: 'display', clientId: displayId }
          }));
          console.log('[WebSocket] Telao registrado:', displayId);
          return;
        }

        if (parsed.type === 'VIGNETTE_ACK' && ws.clientRole === 'display') {
          wss.emit('vignette-ack', parsed.data, ws);
          return;
        }
        
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
      console.log('[WebSocket] Cliente desconectado', ws.displayId || '');
    });
  });

  wss.broadcast = (data) => {
    if (subscription && !subscription.isAllowed() && data.type !== 'SUBSCRIPTION_STATUS') return;
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  };

  wss.getConnectedDisplayIds = () => {
    const ids = new Set();
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && client.clientRole === 'display' && client.displayId) {
        ids.add(client.displayId);
      }
    });
    return [...ids].sort();
  };

  wss.broadcastToDisplays = (data, targetIds = null) => {
    if (subscription && !subscription.isAllowed()) return [];
    const allowed = targetIds ? new Set(targetIds) : null;
    const recipients = new Set();
    wss.clients.forEach((client) => {
      if (
        client.readyState === WebSocket.OPEN
        && client.clientRole === 'display'
        && client.displayId
        && (!allowed || allowed.has(client.displayId))
      ) {
        client.send(JSON.stringify(data));
        recipients.add(client.displayId);
      }
    });
    return [...recipients].sort();
  };

  return wss;
}

module.exports = { initWebSocket };
