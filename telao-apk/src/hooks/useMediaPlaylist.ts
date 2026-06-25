/**
 * Hook para gerenciar a playlist de mídias do telão.
 * Refatorado para arquitetura blindada baseada em referências estritas de ID
 * para garantir 100% de performance e zero interrupções não intencionais.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Media, MappedStream, CompetitionConfig } from '../types';

export interface PlaylistOptions {
  competitionConfig: CompetitionConfig | null;
  currentStream: MappedStream | null;
  chamadaAtiva: boolean;
  testMedia: Media | null;
}

export function useMediaPlaylist(midias: Media[], options: PlaylistOptions) {
  const { competitionConfig, currentStream, chamadaAtiva, testMedia } = options;
  const [currentMediaId, setCurrentMediaId] = useState<string | null>(null);
  const [playbackKey, setPlaybackKey] = useState(0);

  // Filtra e ordena a playlist de forma memoizada para O(N log N) não ocorrer em todo render
  const playlist = useMemo(() => {
    return (midias || [])
      .filter((m) => {
        if (m.ativo === false) return false;
        if (m.tipo.startsWith('copa_')) {
          if (!competitionConfig?.ativo) return false;
          if (m.tipo === 'copa_jogos_hoje' && competitionConfig.mostrarJogosHoje === false) return false;
          if (m.tipo === 'copa_proximos_jogos' && competitionConfig.mostrarProximosJogos === false) return false;
          if (m.tipo === 'copa_classificacao' && competitionConfig.mostrarClassificacaoGrupos === false) return false;
          return true;
        }
        if (m.tipo === 'youtube_stream') {
          return !!currentStream;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.reproduzirPrimeiro && !b.reproduzirPrimeiro) return -1;
        if (!a.reproduzirPrimeiro && b.reproduzirPrimeiro) return 1;
        return (a.ordem || 0) - (b.ordem || 0);
      });
  }, [
    midias,
    competitionConfig?.ativo,
    competitionConfig?.mostrarJogosHoje,
    competitionConfig?.mostrarProximosJogos,
    competitionConfig?.mostrarClassificacaoGrupos,
    !!currentStream
  ]);

  // Mantém a ref da playlist sempre atualizada para o nextMedia (evitando redeclaração do callback)
  const playlistRef = useRef(playlist);
  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);

  // Deriva a mídia atual e seu índice de forma segura durante o render sem side-effects
  let currentIndex = playlist.findIndex((m) => m.id === currentMediaId);
  if (currentIndex === -1) {
    currentIndex = 0; // Fallback se a mídia foi removida ou é o estado inicial
  }
  const currentMedia = playlist.length > 0 ? playlist[currentIndex] : null;

  // Sincroniza o state do ID se ele estava inválido (removido) ou vazio
  useEffect(() => {
    if (currentMedia && currentMedia.id !== currentMediaId) {
      setCurrentMediaId(currentMedia.id);
    } else if (!currentMedia && currentMediaId !== null) {
      setCurrentMediaId(null);
    }
  }, [currentMedia, currentMediaId]);

  const nextMedia = useCallback(() => {
    setPlaybackKey((prev) => prev + 1);
    setCurrentMediaId((prevId) => {
      const list = playlistRef.current;
      if (list.length <= 1) return prevId;
      
      let idx = list.findIndex((m) => m.id === prevId);
      if (idx === -1) idx = 0;
      
      const nextIdx = (idx + 1) % list.length;
      return list[nextIdx].id;
    });
  }, []);

  // Temporizador para avançar mídias.
  // Só é ativado se houver mais de uma mídia na playlist para evitar recarregamentos desnecessários.
  // Serve como safety net (watchdog) para vídeos também, garantindo que a playlist nunca trave se um vídeo congelar.
  useEffect(() => {
    if (!currentMedia || testMedia || chamadaAtiva || playlist.length <= 1) return;

    const dur = currentMedia.duracao || currentMedia.tempo || 15;
    // Tolerância extra para buffering no caso de vídeos
    const delay = currentMedia.tipo === 'video' ? (dur + 15) : dur;

    const timer = setTimeout(() => {
      console.log(`[useMediaPlaylist] Safety net ativado para mídia tipo: ${currentMedia.tipo}, id: ${currentMedia.id}`);
      nextMedia();
    }, delay * 1000);

    return () => clearTimeout(timer);
  }, [
    currentMedia?.id,
    currentMedia?.tipo,
    currentMedia?.duracao,
    currentMedia?.tempo,
    testMedia,
    chamadaAtiva,
    playlist.length,
    nextMedia,
  ]);

  return {
    playlist,
    currentMedia,
    currentPlaylistIndex: currentIndex,
    playbackKey,
    nextMedia,
  };
}
