/**
 * Hook para gerenciar conexão WebSocket com o servidor.
 * Extraído de App.tsx — preserva mesma lógica de reconexão e dispatch.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { ServerConfig, WebSocketMessageType } from '../types';
import { createWebSocketConnection } from '../services/websocket';
import { buildWsUrl } from '../utils/url';

export type WebSocketHandlers = {
  [K in WebSocketMessageType]?: (data: any) => void;
};

export function useWebSocket(serverConfig: ServerConfig, handlers: WebSocketHandlers) {
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef(handlers);

  // Mantém ref atualizada sem causar re-render do efeito
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!serverConfig.ip) return;

    const wsUrl = buildWsUrl(serverConfig);

    const cleanup = createWebSocketConnection({
      url: wsUrl,
      onConnected: () => setConnected(true),
      onDisconnected: () => setConnected(false),
      onMessage: (type: WebSocketMessageType, data: any) => {
        const handler = handlersRef.current[type];
        if (handler) {
          handler(data);
        }
      },
    });

    return cleanup;
  }, [serverConfig.ip, serverConfig.portApi, serverConfig.portWs]);

  return { connected };
}
