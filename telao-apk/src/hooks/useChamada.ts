/**
 * Hook para gerenciar chamadas de caixa (chamada atual + histórico).
 * Extraído de App.tsx.
 *
 * CORREÇÃO: adicionarChamada injeta callId único em cada chamada.
 * Garante que mesmo caixa chamado duas vezes seguidas dispare o useEffect
 * no ChamadaOverlay e reproduza o áudio novamente.
 */

import { useState, useCallback } from 'react';
import { Chamada } from '../types';
import { DEFAULTS } from '../constants';

function gerarCallId(): string {
  // crypto.randomUUID disponível em navegadores modernos e Node 14.17+
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback compatível
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function useChamada() {
  const [chamadaAtual, setChamadaAtual] = useState<Chamada | null>(null);
  const [historico, setHistorico] = useState<Chamada[]>([]);

  const adicionarChamada = useCallback((novaChamada: Chamada) => {
    // Injeta callId e timestamp únicos — essencial para detectar chamadas repetidas
    const chamadaComId: Chamada = {
      ...novaChamada,
      callId: gerarCallId(),
      timestamp: novaChamada.timestamp || new Date().toISOString(),
    };

    console.log('[useChamada] Nova chamada recebida:', chamadaComId);

    setChamadaAtual(chamadaComId);
    setHistorico((prev) => {
      const novoHistorico = [chamadaComId, ...prev].slice(0, DEFAULTS.HISTORICO_MAX);
      return novoHistorico;
    });
  }, []);

  const limparChamada = useCallback(() => {
    console.log('[useChamada] Chamada limpa.');
    setChamadaAtual(null);
  }, []);

  return {
    chamadaAtual,
    historico,
    adicionarChamada,
    limparChamada,
  };
}
