/**
 * Player de vídeo local encapsulado.
 * Wrapper sobre expo-av Video com tipagem e props limpas.
 */

import React from 'react';
import { StyleSheet, Platform } from 'react-native';
import { Video, ResizeMode } from 'expo-av';

interface VideoPlayerProps {
  uri: string;
  shouldPlay: boolean;
  isMuted: boolean;
  isLooping?: boolean;
  onError?: () => void;
  onFinish?: () => void;
}

export default function VideoPlayer({
  uri,
  shouldPlay,
  isMuted,
  isLooping = false,
  onError,
  onFinish,
}: VideoPlayerProps) {
  if (Platform.OS === 'web') {
    return (
      <video
        src={uri}
        style={{ width: '100%', height: '100%', objectFit: 'contain' } as any}
        autoPlay={shouldPlay}
        muted={isMuted}
        loop={isLooping}
        playsInline
        onEnded={() => {
          if (onFinish) onFinish();
        }}
        onError={() => {
          console.log('Erro no vídeo local (web)');
          if (onError) onError();
        }}
      />
    );
  }

  return (
    <Video
      source={{ uri }}
      style={styles.media}
      // @ts-ignore
      videoStyle={{ objectFit: 'cover', WebkitPlaysInline: true, playsInline: true }}
      resizeMode={ResizeMode.COVER}
      shouldPlay={shouldPlay}
      isMuted={isMuted}
      isLooping={isLooping}
      useNativeControls={false}
      // @ts-ignore
      playsInInline={true}
      onError={() => {
        console.log('Erro no vídeo local');
        if (onError) onError();
      }}
      onPlaybackStatusUpdate={(status) => {
        if (status.isLoaded && status.didJustFinish && onFinish) {
          onFinish();
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  media: {
    width: '100%',
    height: '100%',
    // @ts-ignore - objectFit is supported by react-native-web
    objectFit: 'contain',
  },
});
