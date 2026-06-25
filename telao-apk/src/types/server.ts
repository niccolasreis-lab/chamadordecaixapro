/**
 * Tipagem para configuração do servidor e mensagens WebSocket.
 */

export interface ServerConfig {
  ip: string;
  portApi: string;
  portWs: string;
  loaded: boolean;
}

export type WebSocketMessageType =
  | 'CALL'
  | 'MEDIA_UPDATE'
  | 'STREAM_UPDATE'
  | 'STREAM_CHANGE'
  | 'CONFIG_UPDATE'
  | 'EVENT_MODE'
  | 'INSTITUCIONAL_UPDATE'
  | 'MEDIA_PLAY_NOW'
  | 'COPA_CONFIG_UPDATE'
  | 'COPA_UPDATE';

export interface WebSocketMessage<T = unknown> {
  type: WebSocketMessageType;
  data: T;
}
