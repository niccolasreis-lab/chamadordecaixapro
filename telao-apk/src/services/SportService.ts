import { CompetitionConfig, Match, Standing } from '../types';

/**
 * Serviço unificado para acesso aos dados esportivos no Frontend.
 * Centraliza e encapsula o consumo dos dados normalizados para os componentes.
 */
export class SportService {
  /**
   * Obtém os jogos de hoje a partir da configuração ativa
   */
  static getTodayMatches(config: CompetitionConfig | null): Match[] {
    return config?.cache?.jogosHoje || [];
  }

  /**
   * Obtém os próximos jogos a partir da configuração ativa
   */
  static getUpcomingMatches(config: CompetitionConfig | null): Match[] {
    return config?.cache?.proximosJogos || [];
  }

  /**
   * Obtém a classificação/tabela de grupos a partir da configuração ativa
   */
  static getStandings(config: CompetitionConfig | null): Standing[] {
    return config?.cache?.classificacaoGrupos || [];
  }

  /**
   * Obtém o nome da competição
   */
  static getCompetitionName(config: CompetitionConfig | null): string {
    return config?.competicaoNome || 'Copa do Mundo';
  }

  /**
   * Obtém a data/hora da última atualização dos dados
   */
  static getLastUpdate(config: CompetitionConfig | null): string | null {
    return config?.ultimaAtualizacao || null;
  }
}
