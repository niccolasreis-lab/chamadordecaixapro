/**
 * MediaManager — Orquestrador de renderização de mídias do telão.
 *
 * Refatorado: lógica de playlist extraída para useMediaPlaylist hook,
 * YouTube retry extraído para YouTubePlayer, vídeos para VideoPlayer.
 * Este componente agora foca apenas em orquestrar a renderização.
 */

import React, { useEffect, useState } from 'react';
import { View, Dimensions, StyleSheet, Text, Image, Platform } from 'react-native';
import { Media, Stream, MappedStream, CompetitionConfig, InstitucionalData, EventoMode } from '../../types';
import { useMediaPlaylist } from '../../hooks/useMediaPlaylist';
import { extractYouTubeVideoId, resolveMediaUrl, getDefaultServerUrl } from '../../utils/url';
import VideoPlayer from './VideoPlayer';
import YouTubePlayer from './YouTubePlayer';
import PainelCompeticao from '../competition/PainelCompeticao';

// Injeta CSS para vídeos na web (mesmo comportamento original)
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.type = 'text/css';
  style.innerHTML = `
    video {
      object-fit: cover !important;
      width: 100% !important;
      height: 100% !important;
      max-width: none !important;
      max-height: none !important;
    }
  `;
  document.head.appendChild(style);
}

interface MediaManagerProps {
  midias?: Media[];
  streams?: Stream[];
  eventoMode?: EventoMode;
  chamadaAtiva?: boolean;
  serverUrl?: string;
  somAtivado: boolean;
  somMidia: boolean;
  playing?: boolean;
  mediaPlayNow?: { id: string } | null;
  onMediaPlayNowComplete?: () => void;
  institucional?: InstitucionalData;
  copaConfig?: CompetitionConfig | null;
}

export default function MediaManager({
  midias = [],
  streams = [],
  eventoMode,
  chamadaAtiva = false,
  serverUrl,
  somAtivado,
  somMidia,
  playing: playingProp = true,
  mediaPlayNow,
  onMediaPlayNowComplete,
  institucional,
  copaConfig = null,
}: MediaManagerProps) {
  const [playing, setPlaying] = useState(playingProp);
  const [testMedia, setTestMedia] = useState<Media | null>(null);

  const [areaDimensions, setAreaDimensions] = useState({
    width: 1920,
    height: 907.2,
  });

  // Sincroniza o playing com o prop
  useEffect(() => {
    setPlaying(playingProp);
  }, [playingProp]);

  // Mapeia streams ativos para formato com YouTubeId
  const mappedStreams: MappedStream[] = (streams || [])
    .filter((item) => item.ativo)
    .map((item) => ({
      id: item.id,
      youtubeId: extractYouTubeVideoId(item.url) || '',
      url: item.url,
    }))
    .filter((item) => Boolean(item.youtubeId));

  const currentStream = mappedStreams[0] || null;

  // Hook de playlist
  const { currentMedia, nextMedia, playlist, playbackKey } = useMediaPlaylist(midias, {
    competitionConfig: copaConfig,
    currentStream,
    chamadaAtiva,
    testMedia,
  });

  // Efeito para tratar a mídia de teste recebida (MEDIA_PLAY_NOW)
  useEffect(() => {
    if (mediaPlayNow) {
      const found = (midias || []).find((m) => m.id === mediaPlayNow.id);
      if (found) {
        setTestMedia(found);
      } else {
        setTestMedia(null);
        if (onMediaPlayNowComplete) onMediaPlayNowComplete();
      }
    } else {
      setTestMedia(null);
    }
  }, [mediaPlayNow, midias]);

  // Temporizador para mídia de teste do tipo imagem, youtube_stream ou copa
  useEffect(() => {
    if (!testMedia) return;
    if (testMedia.tipo === 'imagem' || testMedia.tipo === 'youtube_stream' || testMedia.tipo.startsWith('copa_')) {
      const dur = testMedia.duracao || testMedia.tempo || 10;
      const timer = setTimeout(() => {
        setTestMedia(null);
        if (onMediaPlayNowComplete) onMediaPlayNowComplete();
      }, dur * 1000);
      return () => clearTimeout(timer);
    }
  }, [testMedia]);

  const isEvento = eventoMode?.ativo;
  const midiaPodeTerSom = somAtivado && somMidia && !chamadaAtiva;
  const resolvedServerUrl = serverUrl || getDefaultServerUrl();

  // Componente de fallback institucional
  const FallbackInstitucional = () => (
    <View style={[styles.fallbackContainer, isEvento ? styles.eventoBg : styles.normalBg]}>
      <Text style={[styles.fallbackTitle, { color: isEvento ? '#002b1c' : '#00e676' }]}>
        {institucional?.nome || 'Supermercado Modelo'}
      </Text>
      <Text style={[styles.fallbackText, { color: isEvento ? '#002b1c' : '#ffffff' }]}>
        {institucional?.slogan || 'Qualidade e tradição para sua família'}
      </Text>
    </View>
  );

  // Renderiza mídia de teste (MEDIA_PLAY_NOW)
  if (testMedia) {
    const mediaUrl = resolveMediaUrl(testMedia.url, resolvedServerUrl);

    const renderTestMedia = () => {
      if (testMedia.tipo === 'youtube_stream') {
        const streamData = {
          id: testMedia.id,
          youtubeId: extractYouTubeVideoId(testMedia.url) || '',
          url: testMedia.url,
        };
        return (
          <YouTubePlayer
            key={`test-yt-${testMedia.id}`}
            stream={streamData}
            width={areaDimensions.width}
            height={areaDimensions.height}
            playing={playing && !chamadaAtiva}
            muted={!midiaPodeTerSom}
            volume={midiaPodeTerSom ? 100 : 0}
            onFinish={() => {
              setTestMedia(null);
              if (onMediaPlayNowComplete) onMediaPlayNowComplete();
            }}
          />
        );
      }
      if (testMedia.tipo.startsWith('copa_')) {
        return <PainelCompeticao key={`test-copa-${testMedia.tipo}`} copaConfig={copaConfig} specificBlock={testMedia.tipo} />;
      }
      if (testMedia.tipo === 'imagem') {
        return <Image key={`test-img-${testMedia.id}`} source={{ uri: mediaUrl }} style={styles.media} resizeMode="contain" />;
      }
      return (
        <VideoPlayer
          key={`test-vid-${testMedia.id}`}
          uri={mediaUrl}
          shouldPlay={playing && !chamadaAtiva}
          isMuted={!midiaPodeTerSom}
          onError={() => {
            console.log('Erro no vídeo de teste');
            setTestMedia(null);
            if (onMediaPlayNowComplete) onMediaPlayNowComplete();
          }}
          onFinish={() => {
            setTestMedia(null);
            if (onMediaPlayNowComplete) onMediaPlayNowComplete();
          }}
        />
      );
    };

    return (
      <View style={[styles.container, isEvento ? styles.eventoBg : styles.normalBg]}>
        {renderTestMedia()}
      </View>
    );
  }

  if (!currentMedia) {
    return <FallbackInstitucional />;
  }

  const renderCurrentMedia = () => {
    // YouTube Stream
    if (currentMedia.tipo === 'youtube_stream' && currentStream) {
      return (
        <YouTubePlayer
          key={`yt-${currentStream.id}-${playbackKey}`}
          stream={currentStream}
          width={areaDimensions.width}
          height={areaDimensions.height}
          playing={playing && !chamadaAtiva}
          muted={!midiaPodeTerSom}
          volume={midiaPodeTerSom ? 100 : 0}
          onFinish={() => {
            nextMedia();
          }}
        />
      );
    }

    // Painel de Competição (Copa, Libertadores, etc.) — só quando Modo Evento ativo
    if (currentMedia.tipo.startsWith('copa_')) {
      return <PainelCompeticao key={`copa-${currentMedia.tipo}-${playbackKey}`} copaConfig={copaConfig} specificBlock={currentMedia.tipo} />;
    }

    // Mídia local (imagem ou vídeo)
    const mediaUrl = resolveMediaUrl(currentMedia.url, resolvedServerUrl);

    if (currentMedia.tipo === 'imagem') {
      return <Image key={`img-${currentMedia.id}-${playbackKey}`} source={{ uri: mediaUrl }} style={styles.media} resizeMode="contain" />;
    }

    return (
      <VideoPlayer
        key={`vid-${currentMedia.id}-${playbackKey}`}
        uri={mediaUrl}
        shouldPlay={playing && !chamadaAtiva}
        isMuted={!midiaPodeTerSom}
        isLooping={false} // Desativamos o loop nativo do expo-av para forçar a remontagem e evitar bugs de congelamento
        onError={() => nextMedia()}
        onFinish={() => nextMedia()}
      />
    );
  };

  return (
    <View style={[styles.container, isEvento ? styles.eventoBg : styles.normalBg]}>
      {renderCurrentMedia()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fallbackContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    width: '100%',
    height: '100%',
  },
  fallbackTitle: {
    fontSize: 48,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  fallbackText: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 34,
  },
  media: {
    width: '100%',
    height: '100%',
    // @ts-ignore - objectFit is supported by react-native-web
    objectFit: 'contain',
  },
  normalBg: {
    backgroundColor: '#002b1c',
  },
  eventoBg: {
    backgroundColor: '#fedf00',
  },
});
