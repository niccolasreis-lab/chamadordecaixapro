/**
 * Serviço de API HTTP para comunicação com o servidor.
 * Centraliza todos os fetch com tratamento de erros silencioso.
 */

import { Media, Stream, EventoMode, InstitucionalData, CompetitionConfig } from '../types';
import { API_ENDPOINTS } from '../constants';

export interface AppConfig {
  somMidia?: boolean;
}

/**
 * Faz um GET com tratamento de erro silencioso (retorna fallback em caso de falha).
 */
async function safeFetch<T>(url: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data as T;
  } catch {
    return fallback;
  }
}

export function fetchMidias(baseUrl: string): Promise<Media[]> {
  return safeFetch<Media[]>(`${baseUrl}${API_ENDPOINTS.MIDIAS}`, []);
}

export function fetchStreams(baseUrl: string): Promise<Stream[]> {
  return safeFetch<Stream[]>(`${baseUrl}${API_ENDPOINTS.STREAMS}`, []);
}

export function fetchConfig(baseUrl: string): Promise<AppConfig> {
  return safeFetch<AppConfig>(`${baseUrl}${API_ENDPOINTS.CONFIG}`, {});
}

export function fetchEventos(baseUrl: string): Promise<EventoMode> {
  return safeFetch<EventoMode>(`${baseUrl}${API_ENDPOINTS.EVENTOS}`, { ativo: false });
}

export function fetchInstitucional(baseUrl: string): Promise<InstitucionalData | null> {
  return safeFetch<InstitucionalData | null>(`${baseUrl}${API_ENDPOINTS.INSTITUCIONAL}`, null);
}

export function fetchCompetitionConfig(baseUrl: string): Promise<CompetitionConfig | null> {
  return safeFetch<CompetitionConfig | null>(`${baseUrl}${API_ENDPOINTS.COPA_CONFIG}`, null);
}
