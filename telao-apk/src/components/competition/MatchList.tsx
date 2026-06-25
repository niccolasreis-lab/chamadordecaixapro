/**
 * Lista de jogos (Hoje / Próximos) — Design Premium com Bandeiras Oficiais.
 * Grid com cards glassmorphism + bandeiras oficiais dinâmicas com suporte a temas.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { Match } from '../../types';
import { formatDataHora } from '../../utils/date';
import { resolveFlagSequence, cacheResolvedFlag } from '../../services/flags';
import MatchCard from './MatchCard';
import EmptyState from '../ui/EmptyState';

interface MatchListProps {
  matches: Match[];
  variant: 'today' | 'upcoming';
  fallbackMatches?: Match[];
  themeMode?: 'dark' | 'light';
}

/**
 * Mini bandeira para os cards compactos de próximos jogos com lazy-loading e fallbacks.
 */
function MiniFlag({
  teamName,
  areaCode,
  countryCode,
  match
}: {
  teamName: string;
  areaCode?: string | null;
  countryCode?: string | null;
  match: Match;
}) {
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [successUrl, setSuccessUrl] = useState<string | null>(null);

  const urls = resolveFlagSequence(
    teamName,
    areaCode,
    countryCode,
    null
  );

  const currentUrl = successUrl || urls[currentUrlIndex];

  const handleLoadSuccess = () => {
    setLoading(false);
    if (currentUrl && !successUrl) {
      setSuccessUrl(currentUrl);
      cacheResolvedFlag(teamName, areaCode ?? null, countryCode ?? null, currentUrl);
    }
  };

  const handleLoadError = () => {
    if (successUrl) return;
    if (currentUrlIndex < urls.length - 1) {
      setCurrentUrlIndex(currentUrlIndex + 1);
    } else {
      setLoading(false);
    }
  };

  return (
    <View style={styles.miniFlagContainer}>
      {loading && (
        <ActivityIndicator size="small" color="#4ade80" style={StyleSheet.absoluteFill} />
      )}
      {currentUrl && (
        <Image
          source={{ uri: currentUrl }}
          style={styles.miniFlag}
          resizeMode="cover"
          onLoad={handleLoadSuccess}
          onError={handleLoadError}
        />
      )}
    </View>
  );
}

export default function MatchList({ matches, variant, fallbackMatches, themeMode = 'dark' }: MatchListProps) {
  const isDark = themeMode === 'dark';

  if (variant === 'today' && matches.length === 0) {
    if (fallbackMatches && fallbackMatches.length > 0) {
      return <MatchList matches={fallbackMatches} variant="upcoming" themeMode={themeMode} />;
    }
    return <EmptyState message="Nenhum jogo programado para hoje." />;
  }

  if (matches.length === 0) {
    return <EmptyState message="Nenhum jogo próximo encontrado." />;
  }

  if (variant === 'today') {
    const visible = matches.slice(0, 4);
    return (
      <View style={styles.gridContainer}>
        {visible.map((match, index) => (
          <MatchCard key={index} match={match} themeMode={themeMode} />
        ))}
      </View>
    );
  }

  // Variant: upcoming — cards compactos com mini bandeiras
  const visible = matches.slice(0, 6);
  const cardBg = isDark ? 'rgba(0, 60, 30, 0.45)' : 'rgba(255, 255, 255, 0.9)';
  const cardBorder = isDark ? 'rgba(0, 200, 100, 0.3)' : 'rgba(5, 150, 105, 0.2)';
  const textColor = isDark ? '#ffffff' : '#1f2937';
  const shadowColor = isDark ? '#00ff88' : '#10b981';

  return (
    <View style={styles.gridContainerSmall}>
      {visible.map((match, index) => (
        <View
          key={index}
          style={[
            styles.cardSmall,
            {
              backgroundColor: cardBg,
              borderColor: cardBorder,
              shadowColor: shadowColor
            }
          ]}
        >
          <Text style={styles.matchDate}>{formatDataHora(match.data)}</Text>
          <View style={styles.teamsSmallRow}>
            <MiniFlag
              teamName={match.mandante}
              areaCode={match.areaMandanteCode}
              countryCode={match.countryMandanteCode}
              match={match}
            />
            <Text style={[styles.matchTeamsSmall, { color: textColor }]}>
              {match.mandante || 'Time'}
            </Text>
            <Text style={styles.vsText}>x</Text>
            <Text style={[styles.matchTeamsSmall, { color: textColor }]}>
              {match.visitante || 'Time'}
            </Text>
            <MiniFlag
              teamName={match.visitante}
              areaCode={match.areaVisitanteCode}
              countryCode={match.countryVisitanteCode}
              match={match}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 20,
  },
  gridContainerSmall: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 15,
  },
  cardSmall: {
    borderRadius: 14,
    padding: 18,
    width: '31%',
    borderWidth: 1,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  matchDate: {
    fontSize: 24,
    color: '#fbbf24',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  teamsSmallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  miniFlagContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniFlag: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  matchTeamsSmall: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  vsText: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: 'bold',
    marginHorizontal: 2,
  },
});
