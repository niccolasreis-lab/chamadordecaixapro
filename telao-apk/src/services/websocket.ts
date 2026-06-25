/**
 * Serviço de WebSocket com reconexão automática.
 * Extraído de App.tsx — preserva a mesma lógica de reconnect (5s).
 */

import { WebSocketMessage, WebSocketMessageType } from '../types';
import { DEFAULTS } from '../constants';

export type MessageHandler = (type: WebSocketMessageType, data: any) => void;

export interface WebSocketServiceOptions {
  url: string;
  onMessage: MessageHandler;
  onConnected: () => void;
  onDisconnected: () => void;
}

/**
 * Cria e gerencia uma conexão WebSocket com reconexão automática.
 * Retorna uma função de cleanup para fechar a conexão.
 */
export function createWebSocketConnection(options: WebSocketServiceOptions): () => void {
  const { url, onMessage, onConnected, onDisconnected } = options;
  let ws: WebSocket;
  let isCleanedUp = false;

  function connect() {
    if (isCleanedUp) return;

    console.log('Tentando conectar ao WebSocket:', url);
    ws = new WebSocket(url);

    ws.onopen = () => {
      console.log('Conectado ao servidor WebSocket');
      onConnected();
    };

    ws.onmessage = (e) => {
      try {
        const message: WebSocketMessage = JSON.parse(e.data);
        onMessage(message.type, message.data);
      } catch (error) {
        console.error('Erro ao interpretar mensagem WS', error);
      }
    };

    ws.onerror = (e: any) => {
      console.error('Erro no WebSocket', e.message || e);
    };

    ws.onclose = () => {
      console.log('WebSocket desconectado. Tentando reconectar em 5s...');
      onDisconnected();
      if (!isCleanedUp) {
        setTimeout(connect, DEFAULTS.RECONNECT_DELAY_MS);
      }
    };
  }

  connect();

  // Retorna função de cleanup
  return () => {
    isCleanedUp = true;
    if (ws) {
      ws.close();
    }
  };
}
