/**
 * Utilitário de escala responsiva baseado na resolução Full HD (1080p).
 * Extraído de ChamadaOverlay.tsx.
 */

import { Dimensions } from 'react-native';

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');

const baseFactor = 1;

/**
 * Retorna o valor escalado dinamicamente para fontes e componentes fixos.
 * Garante um mínimo para legibilidade.
 */
export function scaleVal(val: number): number {
  return Math.max(12, Math.round(val * baseFactor));
}
