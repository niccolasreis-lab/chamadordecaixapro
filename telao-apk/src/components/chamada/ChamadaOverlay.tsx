/**
 * Overlay de chamada de caixa — exibe chamada sobre todo o conteúdo.
 * Preserva 100% do visual e lógica original.
 * Refatorado: usa scaleVal de utils/scale e tipo Chamada.
 */

import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Animated } from 'react-native';
import { Chamada, EventoMode } from '../../types';
import { scaleVal } from '../../utils/scale';
import { DEFAULTS } from '../../constants';
import { getDefaultServerUrl } from '../../utils/url';

let cacheNarracoes: string[] | null = null;
let lastPlayed: Record<string, string> = {};

const debugLog = (...args: any[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('[Narracao]', ...args);
  }
};

async function carregarListaNarracoes(serverUrl: string) {
  if (cacheNarracoes) return cacheNarracoes;
  try {
    const res = await fetch(`${serverUrl}/api/narracoes`);
    if (!res.ok) throw new Error('API erro');
    const data = await res.json();
    cacheNarracoes = data.arquivos || [];
    return cacheNarracoes;
  } catch (err) {
    debugLog('Erro ao buscar lista de narrações', err);
    return [];
  }
}

function encontrarNarracoesDisponiveis(lista: string[], caixa: string | number, suffix: string) {
  const targetCaixaStr = String(caixa).replace(/^0+/, '');
  const targetSuffix = suffix.toLowerCase();

  return lista.filter(filename => {
    const f = filename.toLowerCase().trim();
    const match = f.match(/^caixa livre_0*(\d+)(_preferencial|_rapido)?(?:_\d+)?\.mp3$/);
    if (!match) return false;
    const fileCaixa = match[1];
    const fileSuffix = match[2] || '';
    return fileCaixa === targetCaixaStr && fileSuffix === targetSuffix;
  });
}

function escolherNarracaoAleatoria(lista: string[], chaveCaixaTipo: string): string | null {
  if (lista.length === 0) return null;
  if (lista.length === 1) return lista[0];
  const ultimo = lastPlayed[chaveCaixaTipo];
  const opcoes = lista.filter(f => f !== ultimo);
  const disponiveis = opcoes.length > 0 ? opcoes : lista;
  const selecionado = disponiveis[Math.floor(Math.random() * disponiveis.length)];
  lastPlayed[chaveCaixaTipo] = selecionado;
  return selecionado;
}

interface ChamadaOverlayProps {
  chamada: Chamada | null;
  eventoMode?: EventoMode;
  historico?: Chamada[];
  onComplete?: () => void;
  somAtivado: boolean;
  serverUrl?: string;
}

export default function ChamadaOverlay({ chamada, eventoMode, onComplete, somAtivado, serverUrl }: ChamadaOverlayProps) {
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
      }, DEFAULTS.CALL_DISPLAY_DURATION_MS);

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
      console.log('Preparando áudio da chamada...');

      const tipoLower = (chamada.tipo || 'Normal').toLowerCase();
      let speechTipo = 'livre';
      let suffix = '';
      if (tipoLower.includes('pref')) {
        speechTipo = 'preferencial';
        suffix = '_preferencial';
      } else if (tipoLower.includes('rap') || tipoLower.includes('ráp')) {
        speechTipo = 'rápido';
        suffix = '_rapido';
      }

      const text = `Caixa ${speechTipo} número ${chamada.caixa}. Dirija-se ao caixa.`;
      const resolvedServerUrl = serverUrl || getDefaultServerUrl();
      const filenameOriginal = `caixa livre_${chamada.caixa}${suffix}.mp3`;

      // Prepara a síntese de voz (TTS) como fallback
      let utterance: any = null;
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'pt-BR';
        utterance.rate = 0.95;
      }

      const playFallbackTTS = () => {
        if (utterance && typeof window !== 'undefined' && window.speechSynthesis) {
          debugLog('Fallback TTS executado');
          window.speechSynthesis.speak(utterance);
        }
      };

      const tocarBeepEletronico = () => {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          try {
            const ctx = new AudioContextClass();

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
          } catch (e) {
            console.warn('Erro ao tocar beep eletrônico', e);
          }
        }
      };

      const iniciarFluxoNarracao = async () => {
        if (typeof Audio !== 'undefined') {
          try {
            const listaGeral = await carregarListaNarracoes(resolvedServerUrl);
            console.warn('[AudioRandomizer] Lista geral de áudios do servidor:', listaGeral);
            
            const disponiveis = encontrarNarracoesDisponiveis(listaGeral, chamada.caixa, suffix);
            console.warn('[AudioRandomizer] Áudios disponíveis para o Caixa', chamada.caixa, ':', disponiveis);

            let filename = filenameOriginal;
            if (disponiveis.length > 0) {
              const chave = `${chamada.caixa}_${suffix}`;
              const sorteado = escolherNarracaoAleatoria(disponiveis, chave);
              if (sorteado) {
                filename = sorteado;
                console.warn('[AudioRandomizer] Áudio sorteado para tocar:', filename);
              }
            } else {
              console.warn('[AudioRandomizer] Nenhum áudio correspondente encontrado na lista. Usando padrão:', filenameOriginal);
            }

            let fallbackTriggered = false;

            const tocarNarracao = (nomeArquivo: string, outrasOpcoes: string[]) => {
              if (fallbackTriggered) return;

              const audioUrl = `${resolvedServerUrl}/narracoes/${encodeURIComponent(nomeArquivo)}`;
              debugLog(`Tentando tocar áudio gravado: ${nomeArquivo}`);

              const audio = new Audio(audioUrl);

              const triggerFallbackOuProximo = (err?: any) => {
                debugLog(`Falha ao tocar MP3 ${nomeArquivo}`, err || '');
                if (outrasOpcoes.length > 0) {
                  const proximo = outrasOpcoes[0];
                  debugLog(`Tentando próxima variação: ${proximo}`);
                  tocarNarracao(proximo, outrasOpcoes.slice(1));
                } else if (!fallbackTriggered) {
                  fallbackTriggered = true;
                  playFallbackTTS();
                }
              };

              audio.oncanplaythrough = () => {
                audio.play().catch(err => triggerFallbackOuProximo(err));
              };
              audio.onerror = (err) => triggerFallbackOuProximo(err);

              setTimeout(() => {
                if (!fallbackTriggered && audio.paused && audio.currentTime === 0) {
                  triggerFallbackOuProximo('Timeout de carregamento do áudio');
                }
              }, 3000);
            };

            const restantes = disponiveis.filter(f => f !== filename);
            tocarNarracao(filename, restantes);

          } catch (e) {
            debugLog('Erro na lógica de narração aleatória, usando fallback TTS', e);
            playFallbackTTS();
          }
        } else {
          playFallbackTTS();
        }
      };

      // Tenta reproduzir o efeito de som customizado
      if (typeof Audio !== 'undefined') {
        const customChimeUrl = `${resolvedServerUrl}/sons/efeito_som_painel_chamada_caixa_livre.mp3`;
        console.log(`[SoundEffect] Solicitando som do painel: ${customChimeUrl}`);
        const chime = new Audio(customChimeUrl);
        let chimeStarted = false;

        const triggerFallback = () => {
          if (chimeStarted) return;
          chimeStarted = true;
          console.warn('[SoundEffect] Usando fallback: tocando beep eletrônico e agendando narração...');
          tocarBeepEletronico();
          setTimeout(() => {
            iniciarFluxoNarracao();
          }, 750);
        };

        chime.oncanplaythrough = () => {
          chime.play()
            .then(() => {
              chimeStarted = true;
              console.log('[SoundEffect] Som do painel iniciado com sucesso. Contando 2 segundos para a narração...');
              setTimeout(() => {
                iniciarFluxoNarracao();
              }, 2000);
            })
            .catch(err => {
              console.warn('[SoundEffect] Falha ao iniciar play do som do painel:', err);
              triggerFallback();
            });
        };

        chime.onerror = (err) => {
          console.warn('[SoundEffect] Erro ao carregar som do painel:', err);
          triggerFallback();
        };

        // Timeout de segurança para caso o som demore demais para carregar
        setTimeout(() => {
          if (!chimeStarted) {
            console.warn('[SoundEffect] Timeout de carregamento do som do painel. Usando fallback.');
            triggerFallback();
          }
        }, 2000);

      } else {
        // Sem suporte a Audio na plataforma
        tocarBeepEletronico();
        setTimeout(() => {
          iniciarFluxoNarracao();
        }, 750);
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
        },
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
              transform: [{ scale: pulseAnim }],
            },
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
