const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const WebSocket = require('ws');
const { initWebSocket } = require('../services/websocket');

function waitOpen(client) {
  return new Promise((resolve, reject) => {
    client.once('open', resolve);
    client.once('error', reject);
  });
}

function nextMessage(client, timeoutMs = 500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.off('message', onMessage);
      reject(new Error('timeout'));
    }, timeoutMs);
    function onMessage(raw) {
      clearTimeout(timer);
      resolve(JSON.parse(raw.toString()));
    }
    client.once('message', onMessage);
  });
}

test('VIGNETTE_PLAY e entregue somente a clientes display registrados e ACK exige esse papel', async (t) => {
  const server = http.createServer();
  const wss = initWebSocket(server);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const url = 'ws://127.0.0.1:' + address.port;
  const display = new WebSocket(url);
  const pdv = new WebSocket(url);

  t.after(async () => {
    display.close();
    pdv.close();
    await new Promise((resolve) => wss.close(resolve));
    await new Promise((resolve) => server.close(resolve));
  });

  await Promise.all([waitOpen(display), waitOpen(pdv)]);
  const registeredPromise = nextMessage(display);
  display.send(JSON.stringify({
    type: 'CLIENT_REGISTER',
    data: { role: 'display', clientId: 'display-test-1' },
  }));
  const registered = await registeredPromise;
  assert.equal(registered.type, 'CLIENT_REGISTERED');
  assert.equal(registered.data.success, true);
  assert.deepEqual(wss.getConnectedDisplayIds(), ['display-test-1']);

  const displayMessage = nextMessage(display);
  const pdvMessage = nextMessage(pdv, 100).catch(() => null);
  const recipients = wss.broadcastToDisplays({
    type: 'VIGNETTE_PLAY',
    data: { executionId: 'exec-1' },
  });

  assert.deepEqual(recipients, ['display-test-1']);
  assert.equal((await displayMessage).type, 'VIGNETTE_PLAY');
  assert.equal(await pdvMessage, null);

  const ackPromise = new Promise((resolve) => wss.once('vignette-ack', resolve));
  display.send(JSON.stringify({
    type: 'VIGNETTE_ACK',
    data: { executionId: 'exec-1', status: 'queued' },
  }));
  const ack = await ackPromise;
  assert.equal(ack.executionId, 'exec-1');

  let pdvAckObserved = false;
  wss.once('vignette-ack', () => { pdvAckObserved = true; });
  pdv.send(JSON.stringify({
    type: 'VIGNETTE_ACK',
    data: { executionId: 'exec-pdv', status: 'queued' },
  }));
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(pdvAckObserved, false);
});

test('assinatura bloqueada rejeita chamada antiga e transmissões, mas informa estado', async t => {
  const subscription={isAllowed:()=>false,publicStatus:()=>({allowed:false,status:'blocked'})};
  const server=http.createServer();const wss=initWebSocket(server,{subscription});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const client=new WebSocket('ws://127.0.0.1:'+server.address().port);
  t.after(async()=>{client.close();await new Promise(resolve=>wss.close(resolve));await new Promise(resolve=>server.close(resolve));});
  const initial=nextMessage(client);await waitOpen(client);assert.equal((await initial).type,'SUBSCRIPTION_STATUS');
  const rejected=nextMessage(client);client.send(JSON.stringify({tipo:'caixa-livre',num:'teste-bloqueado'}));
  assert.equal((await rejected).data.allowed,false);
  const forbidden=nextMessage(client,100).catch(()=>null);wss.broadcast({type:'CALL',data:{caixa:'teste'}});
  assert.equal(await forbidden,null);assert.deepEqual(wss.broadcastToDisplays({type:'VIGNETTE_PLAY'}),[]);
});
