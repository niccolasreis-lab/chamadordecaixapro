/**
 * Layout principal do telão — define a estrutura visual:
 * - Header: 12% da tela (lógico)
 * - Content: 76% da tela (lógico)
 * - Footer: 12% da tela (lógico)
 * - Overlays: posicionados absolutamente sobre tudo
 * 
 * Modificado para escala de Viewport virtual 1920x1080 responsiva.
 */

import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';

interface TelaoLayoutProps {
  header: React.ReactNode;
  content: React.ReactNode;
  footer: React.ReactNode;
  overlays?: React.ReactNode;
}

export default function TelaoLayout({ header, content, footer, overlays }: TelaoLayoutProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const baseHeight = 1080;
  
  // Calcula a largura base para manter o aspect ratio físico e evitar bordas
  const windowRatio = windowWidth / windowHeight;
  const baseWidth = baseHeight * windowRatio;

  // A escala é baseada apenas na altura
  const scale = windowHeight / baseHeight;

  // Centraliza o container compensando a escala (transform-origin: center)
  const left = (windowWidth - baseWidth) / 2;
  const top = (windowHeight - baseHeight) / 2;

  return (
    <View style={styles.outerContainer}>
      <View
        style={[
          styles.container,
          {
            width: baseWidth,
            height: baseHeight,
            position: 'absolute',
            left,
            top,
            transform: [{ scale }],
          },
        ]}
      >
        {header}

        <View style={styles.content}>
          {content}
        </View>

        {footer}

        {overlays}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  container: {
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  content: {
    flex: 0.84,
    width: '100%',
    position: 'relative',
  },
});
