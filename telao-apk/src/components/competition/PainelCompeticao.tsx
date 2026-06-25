/**
 * Painel de Competição — Design Premium Copa do Mundo 2026.
 *
 * Fundo verde escuro com degradê, bandeiras do Brasil nas laterais,
 * título dourado "COPA DO MUNDO 2026", cards com glassmorphism,
 * barra motivacional no rodapé.
 *
 * Genérico: suporta qualquer competição via CompetitionConfig.
 * Só aparece quando 🎉 Modo Evento está ativo.
 */

import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { CompetitionConfig } from '../../types';
import { useCompetition } from '../../hooks/useCompetition';
import { formatHora } from '../../utils/date';
import FadeView from '../ui/FadeView';
import MatchList from './MatchList';
import StandingsTable from './StandingsTable';
import EmptyState from '../ui/EmptyState';

interface PainelCompeticaoProps {
  copaConfig: CompetitionConfig | null;
  specificBlock?: string;
}

export default function PainelCompeticao({ copaConfig, specificBlock }: PainelCompeticaoProps) {
  const {
    competicaoNome,
    jogosHoje,
    proximosJogos,
    classificacao,
    activeBlock,
    ultimaAtualizacao,
  } = useCompetition(copaConfig, specificBlock);

  if (!copaConfig) return null;

  const updatedTime = ultimaAtualizacao ? formatHora(ultimaAtualizacao) : '--:--';

  // Ano atual para o título
  const currentYear = new Date().getFullYear();

  return (
    <FadeView
      style={styles.container}
      triggerKey={`${specificBlock || ''}-${activeBlock}`}
    >
      {/* Background gradient layer */}
      <View style={styles.bgGradient} />

      {/* Bandeiras decorativas nas laterais */}
      <View style={styles.flagLeft}>
        <Image
          source={require('../../../assets/bandeira-brasil.png')}
          style={styles.flagDecorative}
          resizeMode="contain"
        />
      </View>
      <View style={styles.flagRight}>
        <Image
          source={require('../../../assets/bandeira-brasil.png')}
          style={[styles.flagDecorative, { transform: [{ scaleX: -1 }] }]}
          resizeMode="contain"
        />
      </View>

      {/* Header superior */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerIcon}>⚽</Text>
          <Text style={styles.headerLabel}>Painel</Text>
          <Text style={styles.headerTitle}>{competicaoNome}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.statusDot} />
          <Text style={styles.headerInfo}>
            Competição: {competicaoNome}  |  Atualizado às {updatedTime}
          </Text>
        </View>
      </View>

      {/* Título central grande */}
      <View style={styles.titleContainer}>
        <Text style={styles.titleStars}>⭐⭐⭐</Text>
        <Text style={styles.mainTitle}>{competicaoNome.toUpperCase()}</Text>
        {!competicaoNome.includes(String(currentYear)) && (
          <Text style={styles.yearTitle}>{currentYear}</Text>
        )}
      </View>

      {/* Conteúdo principal */}
      <View style={styles.content}>
        {activeBlock === 'jogosHoje' && (
          <View style={styles.blockContainer}>
            <View style={styles.blockTitleRow}>
              <Text style={styles.blockTitleIcon}>📅</Text>
              <Text style={styles.blockTitle}>JOGOS DE HOJE</Text>
            </View>
            <MatchList
              matches={jogosHoje}
              variant="today"
              fallbackMatches={copaConfig?.mostrarProximosJogos ? proximosJogos : undefined}
            />
          </View>
        )}

        {activeBlock === 'proximosJogos' && (
          <View style={styles.blockContainer}>
            <View style={styles.blockTitleRow}>
              <Text style={styles.blockTitleIcon}>📆</Text>
              <Text style={styles.blockTitle}>PRÓXIMOS JOGOS</Text>
            </View>
            <MatchList matches={proximosJogos} variant="upcoming" />
          </View>
        )}

        {activeBlock === 'classificacao' && (
          <View style={styles.blockContainer}>
            <View style={styles.blockTitleRow}>
              <Text style={styles.blockTitleIcon}>🏆</Text>
              <Text style={styles.blockTitle}>CLASSIFICAÇÃO / GRUPOS</Text>
            </View>
            <StandingsTable standings={classificacao} maxItems={5} />
          </View>
        )}

        {activeBlock === 'empty' && (
          <EmptyState message="Nenhum dado disponível no momento para esta competição." />
        )}
      </View>

      {/* Barra motivacional no rodapé */}
      <View style={styles.bottomBar}>
        <Text style={styles.bottomBarText}>
          🏆 A maior competição do futebol mundial
        </Text>
        <Text style={styles.bottomBarSep}>|</Text>
        <Text style={styles.bottomBarText}>
          🌍 Paixão que nos une
        </Text>
        <Text style={styles.bottomBarSep}>|</Text>
        <Text style={styles.bottomBarText}>
          💚 Brasil no coração!
        </Text>
      </View>
    </FadeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#0a1f0e',
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },

  // Background
  bgGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0a2810',
    // @ts-ignore - web gradient
    backgroundImage: 'radial-gradient(ellipse at center top, #0f3d1a 0%, #071a0c 50%, #030d05 100%)',
  },

  // Bandeiras decorativas
  flagLeft: {
    position: 'absolute',
    left: -30,
    top: '15%',
    opacity: 0.35,
    zIndex: 0,
  },
  flagRight: {
    position: 'absolute',
    right: -30,
    top: '15%',
    opacity: 0.35,
    zIndex: 0,
  },
  flagDecorative: {
    width: 280,
    height: 200,
  },

  // Header superior
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 18,
    paddingBottom: 10,
    zIndex: 2,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    fontSize: 28,
    marginRight: 8,
  },
  headerLabel: {
    fontSize: 26,
    color: '#4ade80',
    fontWeight: '600',
    marginRight: 6,
  },
  headerTitle: {
    fontSize: 26,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4ade80',
    marginRight: 8,
    shadowColor: '#4ade80',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  headerInfo: {
    fontSize: 22,
    color: 'rgba(255, 255, 255, 0.65)',
    fontWeight: '500',
  },

  // Título central
  titleContainer: {
    alignItems: 'center',
    paddingVertical: 10,
    zIndex: 2,
  },
  titleStars: {
    fontSize: 24,
    marginBottom: 4,
    letterSpacing: 4,
  },
  mainTitle: {
    fontSize: 64,
    fontWeight: '900',
    color: '#fbbf24',
    letterSpacing: 6,
    textAlign: 'center',
    textShadowColor: 'rgba(251, 191, 36, 0.4)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 12,
  },
  yearTitle: {
    fontSize: 48,
    fontWeight: '900',
    color: '#f59e0b',
    letterSpacing: 8,
    fontStyle: 'italic',
    textShadowColor: 'rgba(245, 158, 11, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },

  // Conteúdo
  content: {
    flex: 1,
    paddingHorizontal: 28,
    zIndex: 2,
  },
  blockContainer: {
    flex: 1,
  },
  blockTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  blockTitleIcon: {
    fontSize: 32,
    marginRight: 10,
  },
  blockTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  // Barra motivacional
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 60, 30, 0.6)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 200, 100, 0.2)',
    zIndex: 2,
  },
  bottomBarText: {
    fontSize: 22,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
  },
  bottomBarSep: {
    fontSize: 22,
    color: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 16,
  },
});
