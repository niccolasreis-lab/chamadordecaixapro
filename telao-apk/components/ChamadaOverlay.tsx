import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Animated, Dimensions } from 'react-native';

const { height: screenHeight } = Dimensions.get('window');
// Base scale relative to Full HD (1080p)
const scale = screenHeight / 1080;
const scaleVal = (val: number) => Math.max(12, Math.round(val * scale));

interface ChamadaProps {
  chamada: { caixa: number | string; tipo?: string } | null;
  eventoMode?: { ativo: boolean };
  historico?: Array<{ caixa: number | string; tipo?: string }>;
  onComplete?: () => void;
  somAtivado: boolean;
}

export default function ChamadaOverlay({ chamada, eventoMode, onComplete, somAtivado }: ChamadaProps) {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.92));
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    if (chamada) {
      // Toca chime e faz síntese de voz se som ativado
      playSound();

      // Reinicia os valores das animações
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.92);
      pulseAnim.setValue(1);

      // Animações de entrada
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();

      // Loop do pulso no brilho traseiro
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.start();

      // Desaparece suavemente após 8 segundos
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.92,
            duration: 500,
            useNativeDriver: true,
          }),
        ]).start(() => {
          pulseLoop.stop();
          if (onComplete) onComplete();
        });
      }, 8000);

      return () => {
        clearTimeout(timer);
        pulseLoop.stop();
      };
    }
  }, [chamada]);

  async function playSound() {
    if (!chamada) return;
    if (!somAtivado) {
      console.log('Som desativado. Chamada silenciosa.');
      return;
    }

    try {
      console.log('Tocando chime e executando síntese de voz...');
      
      const tipoLower = (chamada.tipo || 'Normal').toLowerCase();
      let speechTipo = 'livre';
      if (tipoLower.includes('pref')) {
        speechTipo = 'preferencial';
      } else if (tipoLower.includes('rap') || tipoLower.includes('ráp')) {
        speechTipo = 'rápido';
      }

      const text = `Caixa ${speechTipo} número ${chamada.caixa}. Dirija-se ao caixa.`;

      if (typeof window !== 'undefined' && window.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'pt-BR';
        utterance.rate = 0.95; // Velocidade natural e bem inteligível

        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          try {
            const ctx = new AudioContextClass();
            
            // Gerador de Chime duplo (Ding-Dong) senoidal
            const playBeep = (freq: number, start: number, duration: number) => {
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              
              osc.connect(gain);
              gain.connect(ctx.destination);
              
              osc.type = 'sine';
              osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
              
              gain.gain.setValueAtTime(0.08, ctx.currentTime + start);
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration - 0.05);
              
              osc.start(ctx.currentTime + start);
              osc.stop(ctx.currentTime + start + duration);
            };

            playBeep(587.33, 0, 0.3); // Ré (D5)
            playBeep(880.00, 0.25, 0.4); // Lá (A5)
            
            setTimeout(() => {
              window.speechSynthesis.speak(utterance);
            }, 750);
          } catch (e) {
            window.speechSynthesis.speak(utterance);
          }
        } else {
          window.speechSynthesis.speak(utterance);
        }
      }
    } catch (error) {
      console.error('Erro ao reproduzir áudio da chamada', error);
    }
  }

  if (!chamada) return null;

  const isCopa = !!eventoMode?.ativo;
  const numFormatado = String(chamada.caixa).padStart(2, '0');

  // Cores dinâmicas com suporte ao modo Copa do Mundo
  const primaryColor = isCopa ? '#ffd600' : '#00e676';
  const secondaryColor = isCopa ? '#fff59d' : '#b8f5dc';
  const glowColor = isCopa ? 'rgba(255, 214, 0, 0.12)' : 'rgba(0, 255, 140, 0.16)';
  const glowShadow = isCopa ? '#ffd600' : '#00ff88';

  const tipoLower = (chamada.tipo || 'Normal').toLowerCase();
  let labelTop = '🛒 CAIXA LIVRE';
  let labelBottom = 'LIVRE';

  if (tipoLower.includes('pref')) {
    labelTop = '🛒 CAIXA PREFERENCIAL';
    labelBottom = 'PREFERENCIAL';
  } else if (tipoLower.includes('rap') || tipoLower.includes('ráp')) {
    labelTop = '🛒 CAIXA RÁPIDO';
    labelBottom = 'RÁPIDO';
  }

  return (
    <Animated.View 
      style={[
        styles.overlay, 
        { 
          opacity: fadeAnim,
          backgroundColor: isCopa ? '#0e1f00' : '#002b1c',
          // @ts-ignore
          backgroundImage: isCopa 
            ? 'radial-gradient(circle, #0e1f00 0%, #030800 100%)' 
            : 'radial-gradient(circle, #002b1c 0%, #000503 100%)',
        }
      ]}
    >
      <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
        
        {/* Camada do brilho neon verde/amarelo traseiro com pulso animado */}
        <Animated.View 
          style={[
            styles.glow, 
            { 
              width: scaleVal(620),
              height: scaleVal(620),
              borderRadius: scaleVal(310),
              backgroundColor: glowColor,
              shadowColor: glowShadow,
              // @ts-ignore (Suporte para box-shadow na Web)
              boxShadow: `0 0 100px ${glowShadow}`,
              transform: [{ scale: pulseAnim }] 
            }
          ]} 
        />

        {/* Informações Textuais */}
        <Text style={[styles.titulo, { fontSize: scaleVal(56), color: primaryColor }]}>
          {labelTop}
        </Text>
        
        <Text style={[styles.labelNumero, { fontSize: scaleVal(28), color: secondaryColor, marginTop: scaleVal(20) }]}>
          NÚMERO
        </Text>
        
        <Text style={[styles.numero, { fontSize: scaleVal(300), lineHeight: scaleVal(320) }]}>
          {numFormatado}
        </Text>
        
        <Text style={[styles.livre, { fontSize: scaleVal(92), color: primaryColor }]}>
          {labelBottom}
        </Text>
        
        <Text style={[styles.instrucao, { fontSize: scaleVal(40), color: primaryColor, marginTop: scaleVal(40) }]}>
          DIRIJA-SE AO CAIXA
        </Text>

      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  glow: {
    position: 'absolute',
    shadowOpacity: 0.8,
    shadowRadius: 80,
    zIndex: -1,
  },
  titulo: {
    fontWeight: '900',
    letterSpacing: 4,
    textAlign: 'center',
  },
  labelNumero: {
    fontWeight: '800',
    letterSpacing: 8,
    textAlign: 'center',
  },
  numero: {
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
  },
  livre: {
    fontWeight: '900',
    letterSpacing: 18,
    textAlign: 'center',
  },
  instrucao: {
    fontWeight: '900',
    letterSpacing: 4,
    textAlign: 'center',
  },
});
