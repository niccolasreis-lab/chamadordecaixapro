import React, { useEffect, useState, useRef } from "react";
import { View, Dimensions, StyleSheet, Text, Image, TouchableOpacity, Platform } from "react-native";
import { Video, ResizeMode } from "expo-av";
import YoutubeIframe from "react-native-youtube-iframe";
import PainelCopaMundo from "./PainelCopaMundo";

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

interface StreamType {
  id: string;
  youtubeId: string;
  url: string;
}

interface MediaManagerProps {
  midias?: any[];
  streams?: any[];
  eventoMode?: { ativo: boolean };
  chamadaAtiva?: boolean;
  serverUrl?: string;
  somAtivado: boolean;
  somMidia: boolean;
  playing?: boolean;
  mediaPlayNow?: { id: string } | null;
  onMediaPlayNowComplete?: () => void;
  institucional?: any;
  copaConfig?: any;
}

function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;

  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?&]+)/,
    /youtube\.com\/live\/([^?&]+)/,
    /youtube\.com\/embed\/([^?&]+)/,
    /youtube\.com\/shorts\/([^?&]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) return match[1];
  }

  return null;
}

export default function MediaManager({
  midias,
  streams,
  eventoMode,
  chamadaAtiva,
  serverUrl,
  somAtivado,
  somMidia,
  playing: playingProp = true,
  mediaPlayNow,
  onMediaPlayNowComplete,
  institucional,
  copaConfig,
}: MediaManagerProps) {
  const [currentPlaylistIndex, setCurrentPlaylistIndex] = useState(0);
  const [playing, setPlaying] = useState(playingProp);
  const [testMedia, setTestMedia] = useState<any>(null);

  // Estados robustos para o controle do YouTube Stream
  const [youtubeTentativas, setYoutubeTentativas] = useState(0);
  const [youtubeKey, setYoutubeKey] = useState(0);
  const [youtubeStatus, setYoutubeStatus] = useState("idle");
  const [ultimaTentativa, setUltimaTentativa] = useState(Date.now());

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

  // Temporizador para mídia de teste do tipo imagem
  useEffect(() => {
    if (!testMedia) return;
    if (testMedia.tipo === "imagem") {
      const dur = testMedia.duracao || testMedia.tempo || 10;
      const timer = setTimeout(() => {
        setTestMedia(null);
        if (onMediaPlayNowComplete) onMediaPlayNowComplete();
      }, dur * 1000);
      return () => clearTimeout(timer);
    }
  }, [testMedia]);

  const [areaDimensions, setAreaDimensions] = useState({
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height * 0.76,
  });

  // Sincroniza o playing com o prop
  useEffect(() => {
    setPlaying(playingProp);
  }, [playingProp]);

  // Atualiza dimensões se a tela mudar de tamanho
  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setAreaDimensions({
        width: window.width,
        height: window.height * 0.76,
      });
    });
    return () => {
      subscription?.remove();
    };
  }, []);

  const mappedStreams = (streams || [])
    .filter((item) => item.ativo)
    .map((item) => ({
      id: item.id,
      youtubeId: extractYouTubeVideoId(item.url) || "",
      url: item.url,
    }))
    .filter((item) => Boolean(item.youtubeId));

  const currentStream = mappedStreams[0];

  const playlist = (midias || []).filter(m => {
    if (m.ativo === false) return false;
    if (m.tipo.startsWith('copa_')) {
      return copaConfig?.ativo === true;
    }
    if (m.tipo === 'youtube_stream') {
      return !!currentStream;
    }
    return true; // local media
  }).sort((a, b) => {
    if (a.reproduzirPrimeiro && !b.reproduzirPrimeiro) return -1;
    if (!a.reproduzirPrimeiro && b.reproduzirPrimeiro) return 1;
    return (a.ordem || 0) - (b.ordem || 0);
  });

  // Proteção contra estouro de índice se a playlist diminuir
  useEffect(() => {
    if (currentPlaylistIndex >= playlist.length && playlist.length > 0) {
      setCurrentPlaylistIndex(0);
    }
  }, [playlist.length, currentPlaylistIndex]);

  const currentMedia = playlist.length > 0 ? playlist[Math.min(currentPlaylistIndex, playlist.length - 1)] : null;

  // Reseta estados e incrementa chave de renderização quando o ID do stream ativo muda
  useEffect(() => {
    if (currentStream) {
      setYoutubeStatus("loading");
      setYoutubeTentativas(0);
      setYoutubeKey(prev => prev + 1);
      setUltimaTentativa(Date.now());
    } else {
      setYoutubeStatus("idle");
    }
  }, [currentStream?.id]);

  // Lógica de retry automático com backoff exponencial
  const retryDelay = Math.min(30000, 5000 * Math.max(1, youtubeTentativas));

  useEffect(() => {
    if (!currentStream) return;
    if (youtubeStatus !== "error_retrying" && youtubeStatus !== "reconnecting") return;

    const timer = setTimeout(() => {
      console.log(`[Watchdog] Tentativa de reconexão do stream... (Tentativa ${youtubeTentativas + 1})`);
      setYoutubeTentativas(prev => prev + 1);
      setYoutubeKey(prev => prev + 1);
      setYoutubeStatus("loading");
      setUltimaTentativa(Date.now());
    }, retryDelay);

    return () => clearTimeout(timer);
  }, [currentStream?.id, youtubeStatus, youtubeTentativas, retryDelay]);

  // Timeout sem bloqueio
  useEffect(() => {
    if (!currentStream || chamadaAtiva) return;
    if (youtubeStatus === "playing" || youtubeStatus === "buffering") return;

    const timer = setTimeout(() => {
      console.log("[Watchdog] Stream demorou muito para carregar, forçando reconexão.");
      setYoutubeStatus("reconnecting");
    }, 20000);

    return () => clearTimeout(timer);
  }, [currentStream?.id, youtubeStatus, chamadaAtiva, youtubeKey]);

  // Função para tratar erros capturados pelo player
  function handleYoutubeError(error: any) {
    console.log("Erro reportado pelo player do YouTube:", error);
    setYoutubeStatus("error_retrying");
  }

  const nextMedia = () => {
    if (playlist.length > 1) {
      setCurrentPlaylistIndex((prev) => (prev + 1) % playlist.length);
    }
  };

  // Temporizador unificado para avançar mídias estáticas ou virtuais após 'duracao'
  useEffect(() => {
    if (!currentMedia || testMedia || chamadaAtiva) return;

    // Apenas avançamos pelo timer se for imagem, bloco da Copa ou stream do YouTube (modo não-finito).
    if (currentMedia.tipo === "imagem" || currentMedia.tipo.startsWith("copa_") || currentMedia.tipo === "youtube_stream") {
      const dur = currentMedia.duracao || currentMedia.tempo || 10;
      const timer = setTimeout(() => {
        nextMedia();
      }, dur * 1000);
      return () => clearTimeout(timer);
    }
  }, [currentPlaylistIndex, currentMedia, testMedia, chamadaAtiva]);

  const isEvento = eventoMode?.ativo;
  const midiaPodeTerSom = somAtivado && somMidia && !chamadaAtiva;

  const FallbackInstitucional = () => (
    <View style={[styles.fallbackContainer, isEvento ? styles.eventoBg : styles.normalBg]}>
      <Text style={[styles.fallbackTitle, { color: isEvento ? "#002b1c" : "#00e676" }]}>
        {institucional?.nome || "Supermercado Modelo"}
      </Text>
      <Text style={[styles.fallbackText, { color: isEvento ? "#002b1c" : "#ffffff" }]}>
        {institucional?.slogan || "Qualidade e tradição para sua família"}
      </Text>
    </View>
  );



  if (testMedia) {
    const resolvedServerUrl = serverUrl || (typeof window !== "undefined" && window.location && window.location.hostname ? "http://" + window.location.hostname + ":3001" : "http://localhost:3001");
    const mediaUrl = testMedia.url.startsWith("http") ? testMedia.url : `${resolvedServerUrl}${testMedia.url}`;

    return (
      <View style={[styles.container, isEvento ? styles.eventoBg : styles.normalBg]}>
        {testMedia.tipo === "imagem" ? (
          <Image source={{ uri: mediaUrl }} style={styles.media} resizeMode="contain" />
        ) : (
          <Video
            source={{ uri: mediaUrl }}
            style={styles.media}
            // @ts-ignore
            videoStyle={{ objectFit: "cover" }}
            resizeMode={ResizeMode.COVER}
            shouldPlay={playing && !chamadaAtiva}
            isMuted={!midiaPodeTerSom}
            onError={() => {
              console.log("Erro no vídeo de teste");
              setTestMedia(null);
              if (onMediaPlayNowComplete) onMediaPlayNowComplete();
            }}
            onPlaybackStatusUpdate={(status) => {
              if (status.isLoaded && status.didJustFinish) {
                setTestMedia(null);
                if (onMediaPlayNowComplete) onMediaPlayNowComplete();
              }
            }}
          />
        )}
      </View>
    );
  }

  if (!currentMedia) {
    return <FallbackInstitucional />;
  }

  const renderCurrentMedia = () => {
    if (currentMedia.tipo === "youtube_stream" && currentStream) {
      const isStreamHealthy = youtubeStatus === "playing" || youtubeStatus === "buffering" || youtubeStatus === "loading";
      
      return (
        <View style={styles.visibleVideo}>
          <YoutubeIframe
            key={`${currentStream.id}-${youtubeKey}`}
            height={areaDimensions.height}
            width={areaDimensions.width}
            videoId={currentStream.youtubeId}
            play={playing && !chamadaAtiva}
            mute={!midiaPodeTerSom}
            volume={midiaPodeTerSom ? 100 : 0}
            onReady={() => {
              setYoutubeStatus("playing");
              setYoutubeTentativas(0);
            }}
            onChangeState={(state: string) => {
              if (state === "playing") {
                setYoutubeStatus("playing");
                setYoutubeTentativas(0);
              } else if (state === "buffering") {
                setYoutubeStatus("buffering");
              } else if (state === "ended" && currentStream) {
                console.log("Stream do YouTube encerrado.");
              }
            }}
            onError={handleYoutubeError}
            webViewProps={{
              allowsInlineMediaPlayback: true,
              mediaPlaybackRequiresUserAction: false,
              scrollEnabled: false,
              nestedScrollEnabled: false,
              overScrollMode: "never"
            }}
          />
          {!isStreamHealthy && (
            <View style={styles.reconnectingBadge}>
              <Text style={styles.reconnectingText}>Conectando transmissão...</Text>
            </View>
          )}
        </View>
      );
    }

    if (currentMedia.tipo.startsWith("copa_")) {
      return <PainelCopaMundo copaConfig={copaConfig} specificBlock={currentMedia.tipo} />;
    }

    const resolvedServerUrl = serverUrl || (typeof window !== "undefined" && window.location && window.location.hostname ? "http://" + window.location.hostname + ":3001" : "http://localhost:3001");
    const mediaUrl = currentMedia.url.startsWith("http") ? currentMedia.url : `${resolvedServerUrl}${currentMedia.url}`;

    if (currentMedia.tipo === "imagem") {
      return <Image source={{ uri: mediaUrl }} style={styles.media} resizeMode="contain" />;
    }

    return (
      <Video
        source={{ uri: mediaUrl }}
        style={styles.media}
        // @ts-ignore
        videoStyle={{ objectFit: "cover" }}
        resizeMode={ResizeMode.COVER}
        shouldPlay={playing && !chamadaAtiva}
        isMuted={!midiaPodeTerSom}
        isLooping={playlist.length === 1}
        onError={() => {
          console.log("Erro no vídeo local");
          nextMedia();
        }}
        onPlaybackStatusUpdate={(status) => {
          if (status.isLoaded && status.didJustFinish && playlist.length > 1) {
            nextMedia();
          }
        }}
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
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  fallbackContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    width: "100%",
    height: "100%",
  },
  fallbackTitle: {
    fontSize: 48,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 15,
  },
  fallbackText: {
    fontSize: 24,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 34,
  },
  media: {
    width: "100%",
    height: "100%",
    // @ts-ignore - objectFit is supported by react-native-web
    objectFit: "contain",
  },
  normalBg: {
    backgroundColor: "#002b1c",
  },
  eventoBg: {
    backgroundColor: "#fedf00",
  },
  hiddenVideo: {
    opacity: 0,
    position: 'absolute',
    left: -10000,
  },
  visibleVideo: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  reconnectingBadge: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    elevation: 5,
  },
  reconnectingText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
