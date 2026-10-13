(() => {
  let checking = false;
  const blockedPage = document.getElementById('status');
  async function check() {
    if (checking) return; checking = true;
    try {
      const response = await fetch('/api/subscription/status', { cache:'no-store',signal:AbortSignal.timeout(5000) });
      if (!response.ok) return;
      const state = await response.json();
      if (blockedPage) {
        const management = document.getElementById('management-link');
        const qr = document.getElementById('unlock-qr');
        if (management && state.managementUrl) management.href = state.managementUrl;
        const managementImage = document.getElementById('management-qr-image');
        if (managementImage && state.managementUrl && managementImage.getAttribute('src') !== '/subscription/unlock-qr.svg') {
          managementImage.src = '/subscription/unlock-qr.svg';
        }
        if (qr) qr.hidden = !state.managementUrl;
        blockedPage.textContent = state.allowed ? 'Assinatura liberada. Abrindo o telão…' : 'Aguardando liberação da assinatura.' + (state.customerId ? ' Cliente: '+state.customerId : '');
        if (state.allowed) location.reload();
      } else if (!state.allowed) location.reload();
    } catch (_) { /* Servidor offline: não libera uma tela bloqueada. */ }
    finally { checking = false; }
  }
  void check(); setInterval(check, 5000);
  if (!blockedPage) {
    const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://')+location.host);
    ws.onmessage = event => { try { const message=JSON.parse(event.data); if(message.type === 'SUBSCRIPTION_STATUS' && !message.data.allowed) location.reload(); } catch (_) {} };
  }
})();
