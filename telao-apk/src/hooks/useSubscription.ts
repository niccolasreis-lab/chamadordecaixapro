import { useEffect, useState } from 'react';

export function useSubscription(serverUrl: string) {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    setAllowed(false);
    if (!serverUrl) return;
    let validUntil: number | null = null;
    async function check() {
      if (inFlight) return;
      if (validUntil !== null && Date.now() >= validUntil) setAllowed(false);
      inFlight = true;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(serverUrl.replace(/\/$/, '') + '/api/subscription/status', { signal: controller.signal, headers: { 'Cache-Control': 'no-cache' } });
        if (!response.ok) return;
        const state = await response.json();
        if (typeof state.allowed !== 'boolean' || disposed) return;
        validUntil = state.managed ? Date.parse(state.validUntil || '') : null;
        if (state.managed && !Number.isFinite(validUntil)) validUntil = 0;
        setAllowed(state.allowed);
      } catch (_) { /* Mantém bloqueado se não há validação disponível. */ }
      finally { clearTimeout(timeout); inFlight = false; }
    }
    // Ao reiniciar, liberação sempre exige validação pelo servidor local.
    void check();
    const timer = setInterval(() => { void check(); }, 5000);
    return () => { disposed = true; clearInterval(timer); };
  }, [serverUrl]);
  return allowed;
}
