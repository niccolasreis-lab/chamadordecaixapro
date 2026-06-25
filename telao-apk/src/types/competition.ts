/**
 * Tipagem genérica para competições de futebol.
 * Suporta Copa do Mundo, Libertadores, Champions League, Brasileirão, etc.
 * Compatível com a API football-data.org.
 */

export interface Match {
  id?: string | number;
  data: string;
  mandante: string;
  visitante: string;
  placarMandante: number | null;
  placarVisitante: number | null;
  status: 'SCHEDULED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'POSTPONED' | string;
  minute?: string;
  grupo?: string;
  /** URL do escudo do time mandante (retornado pela API football-data.org) */
  crestMandante?: string;
  /** URL do escudo do time visitante (retornado pela API football-data.org) */
  crestVisitante?: string;
  competicaoNome?: string;
  areaMandanteCode?: string;
  areaVisitanteCode?: string;
  countryMandanteCode?: string;
  countryVisitanteCode?: string;
}

export interface Standing {
  position: number;
  team: {
    name: string;
    shortName?: string;
    crest?: string;
  };
  points: number;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor?: number;
  goalsAgainst?: number;
  goalDifference?: number;
}

export interface CompetitionCache {
  jogosHoje: Match[];
  proximosJogos: Match[];
  classificacaoGrupos: Standing[];
}

export interface CompetitionTheme {
  corPrimaria: string;
  corSecundaria: string;
  corFundo: string;
  icone?: string;
  bandeira?: string;
}

export interface CompetitionConfig {
  ativo: boolean;
  competicaoNome: string;
  competicaoId?: string | number;
  mostrarJogosHoje: boolean;
  mostrarProximosJogos: boolean;
  mostrarClassificacaoGrupos: boolean;
  cache?: CompetitionCache;
  ultimaAtualizacao?: string;
  tema?: CompetitionTheme;
}
