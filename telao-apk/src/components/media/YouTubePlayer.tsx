/**
 * Player YouTube com lógica de retry/watchdog.
 * Extraído de MediaManager.tsx — toda a lógica de reconnect com backoff exponencial.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import YoutubeIframe from 'react-native-youtube-iframe';
import { MappedStream } from '../../types';
import { DEFAULTS } from '../../constants';

interface YouTubePlayerProps {
  stream: MappedStream;
  width: number;
  height: number;
  playing: boolean;
  muted: boolean;
  volume: number;
  onFinish?: () => void;
}

export default function YouTubePlayer({
  stream,
  width,
  height,
  playing,
  muted,
  volume,
  onFinish,
}: YouTubePlayerProps) {
  const [tentativas, setTentativas] = useState(0);
  const [youtubeKey, setYoutubeKey] = useState(0);
  const [status, setStatus] = useState<string>('loading');
  const [ultimaTentativa, setUltimaTentativa] = useState(Date.now());

  const isHealthy = status === 'playing' || status === 'buffering' || status === 'loading';
  const retryDelay = Math.min(DEFAULTS.YOUTUBE_RETRY_MAX_DELAY_MS, 5000 * Math.max(1, tentativas));

  // Reset quando o stream muda
  useEffect(() => {
    setStatus('loading');
    setTentativas(0);
    setYoutubeKey((prev) => prev + 1);
    setUltimaTentativa(Date.now());
  }, [stream.id]);

  // Retry automático com backoff exponencial
  useEffect(() => {
    if (status !== 'error_retrying' && status !== 'reconnecting') return;

    const timer = setTimeout(() => {
      console.log(`[Watchdog] Tentativa de reconexão do stream... (Tentativa ${tentativas + 1})`);
      setTentativas((prev) => prev + 1);
      setYoutubeKey((prev) => prev + 1);
      setStatus('loading');
      setUltimaTentativa(Date.now());
    }, retryDelay);

    return () => clearTimeout(timer);
  }, [stream.id, status, tentativas, retryDelay]);

  // Timeout de carregamento
  useEffect(() => {
    if (status === 'playing' || status === 'buffering') return;

    const timer = setTimeout(() => {
      console.log('[Watchdog] Stream demorou muito para carregar, forçando reconexão.');
      setStatus('reconnecting');
    }, DEFAULTS.YOUTUBE_LOADING_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [stream.id, status, youtubeKey]);

  function handleError(error: any) {
    console.log('Erro reportado pelo player do YouTube:', error);
    setStatus('error_retrying');
  }

  return (
    <View style={styles.visibleVideo}>
      <YoutubeIframe
        key={`${stream.id}-${youtubeKey}`}
        height={height}
        width={width}
        videoId={stream.youtubeId}
        play={playing}
        mute={muted}
        volume={volume}
        onReady={() => {
          setStatus('playing');
          setTentativas(0);
        }}
        onChangeState={(state: string) => {
          if (state === 'playing') {
            setStatus('playing');
            setTentativas(0);
          } else if (state === 'buffering') {
            setStatus('buffering');
          } else if (state === 'ended') {
            console.log('Stream do YouTube encerrado. Reiniciando...');
            setYoutubeKey((prev) => prev + 1);
            setStatus('loading');
            if (onFinish) onFinish();
          }
        }}
        onError={handleError}
        webViewProps={{
          allowsInlineMediaPlayback: true,
          mediaPlaybackRequiresUserAction: false,
          scrollEnabled: false,
          nestedScrollEnabled: false,
          overScrollMode: 'never',
        }}
      />
      {!isHealthy && (
        <View style={styles.reconnectingBadge}>
          <Text style={styles.reconnectingText}>Conectando transmissão...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  visibleVideo: {
    flex: 1,
    width: '100%',
    height: '100%',
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
  },
});
