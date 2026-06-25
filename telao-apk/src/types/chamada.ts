/**
 * Tipagem para chamadas de caixa.
 * callId: identificador único por chamada (garante detecção mesmo caixa repetido)
 * timestamp: ISO timestamp da chamada (fallback de unicidade)
 */

export interface Chamada {
  caixa: number | string;
  tipo?: string;
  callId?: string;
  timestamp?: string;
}
