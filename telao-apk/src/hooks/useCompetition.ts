/**
 * Hook para gerenciar dados da competição ativa (Copa do Mundo, Libertadores, etc.)
 * Extraído de PainelCopaMundo.tsx — rotação de blocos e parsing de dados.
 * Só retorna dados quando o Modo Evento está ativo.
 */

import { useState, useEffect } from 'react';
import { CompetitionConfig, Match, Standing } from '../types';
import { DEFAULTS } from '../constants';

import { SportService } from '../services/SportService';

export type CompetitionBlock = 'jogosHoje' | 'proximosJogos' | 'classificacao' | 'empty';

export function useCompetition(config: CompetitionConfig | null, specificBlock?: string) {
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);

  const competicaoNome = SportService.getCompetitionName(config);
  const jogosHoje = SportService.getTodayMatches(config);
  const proximosJogos = SportService.getUpcomingMatches(config);
  const classificacao = SportService.getStandings(config);

  // Determina quais blocos estão habilitados
  const blocks: CompetitionBlock[] = [];
  if (config?.mostrarJogosHoje) blocks.push('jogosHoje');
  if (config?.mostrarProximosJogos) blocks.push('proximosJogos');
  if (config?.mostrarClassificacaoGrupos) blocks.push('classificacao');

  // Rotação automática dos blocos a cada 15s (se não tem bloco específico)
  useEffect(() => {
    if (specificBlock || blocks.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentBlockIndex((prev) => (prev + 1) % blocks.length);
    }, DEFAULTS.BLOCK_ROTATION_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [blocks.length, specificBlock]);

  // Mapeia o nome do bloco específico para o tipo interno
  const mappedBlock: CompetitionBlock | null =
    specificBlock === 'copa_jogos_hoje'
      ? 'jogosHoje'
      : specificBlock === 'copa_proximos_jogos'
        ? 'proximosJogos'
        : specificBlock === 'copa_classificacao'
          ? 'classificacao'
          : null;

  const activeBlock: CompetitionBlock =
    mappedBlock || blocks[currentBlockIndex] || 'empty';

  return {
    competicaoNome,
    jogosHoje,
    proximosJogos,
    classificacao,
    blocks,
    activeBlock,
    ultimaAtualizacao: SportService.getLastUpdate(config),
    tema: config?.tema,
  };
}
