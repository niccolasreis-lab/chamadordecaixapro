/**
 * Utilitários de URL — resolução de mídias e extração de IDs YouTube.
 * Extraídos de MediaManager.tsx e App.tsx.
 */

import { ServerConfig } from '../types';

/**
 * Extrai o ID de um vídeo do YouTube a partir de vários formatos de URL.
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;

  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?&]+)/,
    /youtube\.com\/live\/([^?&]+)/,
    /youtube\.com\/embed\/([^?&]+)/,
    /youtube\.com\/shorts\/([^?&]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) return match[1];
  }

  return null;
}

/**
 * Resolve uma URL de mídia, prefixando com serverUrl se necessário.
 */
export function resolveMediaUrl(url: string, serverUrl: string): string {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  return `${serverUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * Gera a URL base do servidor HTTP a partir da configuração.
 */
export function buildServerUrl(config: ServerConfig): string {
  if (!config.ip) return '';
  return `http://${config.ip}:${config.portApi}`;
}

/**
 * Gera a URL do WebSocket a partir da configuração.
 */
export function buildWsUrl(config: ServerConfig): string {
  if (!config.ip) return '';
  return `ws://${config.ip}:${config.portWs}`;
}

/**
 * Fallback para obter serverUrl quando não há config salva (ambiente web).
 */
export function getDefaultServerUrl(): string {
  if (typeof window !== 'undefined' && window.location && window.location.hostname && window.location.hostname !== 'localhost') {
    return `http://${window.location.hostname}:3040`;
  }
  return 'http://localhost:3040';
}
