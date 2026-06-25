/**
 * Constantes e valores padrão do projeto.
 */

import { InstitucionalData } from '../types';

/** Configurações de tempo e limites */
export const DEFAULTS = {
  PORT_API: '3040',
  PORT_WS: '3040',
  RECONNECT_DELAY_MS: 5000,
  CALL_DISPLAY_DURATION_MS: 8000,
  HISTORICO_MAX: 5,
  BLOCK_ROTATION_INTERVAL_MS: 15000,
  YOUTUBE_RETRY_MAX_DELAY_MS: 30000,
  YOUTUBE_LOADING_TIMEOUT_MS: 20000,
  MEDIA_DEFAULT_DURATION_S: 10,
} as const;

/** Chaves de armazenamento AsyncStorage */
export const STORAGE_KEYS = {
  SERVER_IP: '@server_ip',
  SERVER_PORT_API: '@server_port_api',
  SERVER_PORT_WS: '@server_port_ws',
} as const;

/** Dados institucionais padrão */
export const INSTITUCIONAL_DEFAULT: InstitucionalData = {
  nome: 'Mercantil Santa Paula',
  telefone: '(11) 3326-2888 / 3311-1340',
  site: 'www.mercantilsantapaula.com.br',
  instagram: '@mercantilsantapaula',
  slogan: 'Qualidade e tradição para sua família',
  logo: '',
  qrcode: '',
};

/** Endpoints da API */
export const API_ENDPOINTS = {
  MIDIAS: '/api/midias',
  STREAMS: '/api/streams',
  CONFIG: '/api/config',
  EVENTOS: '/api/eventos',
  INSTITUCIONAL: '/api/institucional',
  COPA_CONFIG: '/api/copa/config',
} as const;
