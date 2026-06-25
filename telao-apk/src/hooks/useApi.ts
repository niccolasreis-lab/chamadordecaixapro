/**
 * Hook para fetch inicial dos dados da API quando o servidor é configurado.
 * Extraído de App.tsx — busca mídias, streams, config, eventos, institucional e competição.
 */

import { useEffect, useState, useCallback } from 'react';
import { Media, Stream, EventoMode, InstitucionalData, CompetitionConfig } from '../types';
import { INSTITUCIONAL_DEFAULT } from '../constants';
import * as ApiService from '../services/api';

export function useApi(serverUrl: string) {
  const [midias, setMidias] = useState<Media[]>([]);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [somMidia, setSomMidia] = useState(false);
  const [eventoMode, setEventoMode] = useState<EventoMode>({ ativo: false });
  const [institucional, setInstitucional] = useState<InstitucionalData>(INSTITUCIONAL_DEFAULT);
  const [competitionConfig, setCompetitionConfig] = useState<CompetitionConfig | null>(null);
  const [mediaPlayNow, setMediaPlayNow] = useState<{ id: string } | null>(null);

  const refetch = useCallback(() => {
    if (!serverUrl) return;

    ApiService.fetchMidias(serverUrl).then(setMidias);
    ApiService.fetchStreams(serverUrl).then(setStreams);
    ApiService.fetchConfig(serverUrl).then((data) => {
      if (data && typeof data.somMidia === 'boolean') setSomMidia(data.somMidia);
    });
    ApiService.fetchEventos(serverUrl).then(setEventoMode);
    ApiService.fetchInstitucional(serverUrl).then((data) => {
      if (data && Object.keys(data).length > 0) setInstitucional(data);
    });
    ApiService.fetchCompetitionConfig(serverUrl).then((data) => {
      if (data) setCompetitionConfig(data);
    });
  }, [serverUrl]);

  // Fetch inicial quando serverUrl muda
  useEffect(() => {
    refetch();
  }, [serverUrl, refetch]);

  return {
    midias,
    setMidias,
    streams,
    setStreams,
    somMidia,
    setSomMidia,
    eventoMode,
    setEventoMode,
    institucional,
    setInstitucional,
    competitionConfig,
    setCompetitionConfig,
    mediaPlayNow,
    setMediaPlayNow,
    refetch,
  };
}
