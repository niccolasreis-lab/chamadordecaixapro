/**
 * Componente reutilizável de fade-in/fade-out com Animated.View.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle, StyleProp } from 'react-native';

interface FadeViewProps {
  visible?: boolean;
  duration?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  /** Chave para re-disparar a animação */
  triggerKey?: string | number;
}

export default function FadeView({
  visible = true,
  duration = 800,
  style,
  children,
  triggerKey,
}: FadeViewProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: visible ? 1 : 0,
      duration,
      useNativeDriver: true,
    }).start();
  }, [visible, triggerKey]);

  return (
    <Animated.View style={[style, { opacity: fadeAnim }]}>
      {children}
    </Animated.View>
  );
}
