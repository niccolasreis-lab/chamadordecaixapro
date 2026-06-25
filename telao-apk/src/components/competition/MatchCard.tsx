/**
 * Card de jogo individual — Design Premium com Bandeiras Oficiais e Temas Dinâmicos.
 *
 * Bandeiras carregadas dinamicamente via serviço de flags isolado.
 * Suporta Temas Claro e Escuro com glows e bordas adaptativas.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { Match } from '../../types';
import { formatHora } from '../../utils/date';
import { resolveFlagSequence, cacheResolvedFlag, getCountryIsoCode } from '../../services/flags';

interface MatchCardProps {
  match: Match;
  themeMode?: 'dark' | 'light';
}

/**
 * Componente de bandeira circular com lazy-loading e fallback sequencial.
 */
function TeamFlag({
  teamName,
  crestUrl,
  areaCode,
  countryCode,
  match,
  themeMode = 'dark'
}: {
  teamName: string;
  crestUrl?: string;
  areaCode?: string | null;
  countryCode?: string | null;
  match: Match;
  themeMode?: 'dark' | 'light';
}) {
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [successUrl, setSuccessUrl] = useState<string | null>(null);

  // Gera a sequência de fallbacks sob demanda (lazy)
  const urls = resolveFlagSequence(
    teamName,
    areaCode,
    countryCode,
    crestUrl
  );

  useEffect(() => {
    // Alerta de país sem mapeamento na console
    const iso = getCountryIsoCode(teamName, areaCode, countryCode);
    if (!iso) {
      console.warn(
        `[Flags] Código ISO não encontrado para "${teamName}" na competição "${match.competicaoNome || 'Desconhecida'}" (ID Partida: ${match.id || 'N/A'})`
      );
    }
  }, [teamName, match, areaCode, countryCode]);

  const currentUrl = successUrl || urls[currentUrlIndex];

  // Estilos baseados no tema claro/escuro
  const isDark = themeMode === 'dark';
  const flagBorderColor = isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.15)';
  const glowColor = isDark ? '#00ff88' : '#059669';

  const handleLoadSuccess = () => {
    setLoading(false);
    if (currentUrl && !successUrl) {
      setSuccessUrl(currentUrl);
      cacheResolvedFlag(teamName, areaCode ?? null, countryCode ?? null, currentUrl);
    }
  };

  const handleLoadError = () => {
    if (successUrl) return; // Se já teve sucesso anterior, ignora erros subsequentes
    
    if (currentUrlIndex < urls.length - 1) {
      const nextIndex = currentUrlIndex + 1;
      setCurrentUrlIndex(nextIndex);
    } else {
      setLoading(false);
      console.warn(
        `[Flags] Todos os fallbacks de bandeira falharam para "${teamName}" na competição "${match.competicaoNome || 'N/A'}" (ID Partida: ${match.id || 'N/A'})`
      );
    }
  };

  return (
    <View style={[
      styles.flagCircle,
      {
        borderColor: flagBorderColor,
        shadowColor: glowColor,
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)'
      }
    ]}>
      {loading && (
        <ActivityIndicator
          size="small"
          color={isDark ? '#4ade80' : '#059669'}
          style={StyleSheet.absoluteFill}
        />
      )}
      {currentUrl ? (
        <Image
          source={{ uri: currentUrl }}
          style={styles.flagImage}
          resizeMode="cover"
          onLoad={handleLoadSuccess}
          onError={handleLoadError}
        />
      ) : (
        <Text style={[styles.flagFallbackText, { color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }]}>
          {teamName.charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

export default function MatchCard({ match, themeMode = 'dark' }: MatchCardProps) {
  const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED';
  const isFinished = match.status === 'FINISHED';
  const isDark = themeMode === 'dark';

  // Cores dinâmicas para temas Claro/Escuro
  const cardBg = isDark ? 'rgba(0, 60, 30, 0.45)' : 'rgba(255, 255, 255, 0.9)';
  const cardBorder = isDark ? 'rgba(0, 200, 100, 0.35)' : 'rgba(5, 150, 105, 0.2)';
  const textColor = isDark ? '#ffffff' : '#1f2937';
  const subTextColor = isDark ? 'rgba(255, 255, 255, 0.5)' : '#4b5563';
  const scoreVsColor = isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.4)';
  const shadowColor = isDark ? '#00ff88' : '#10b981';

  return (
    <View style={[
      styles.card,
      {
        backgroundColor: cardBg,
        borderColor: cardBorder,
        shadowColor: shadowColor
      }
    ]}>
      {/* Horário / Status */}
      <View style={styles.statusRow}>
        <Text style={styles.clockIcon}>🕐</Text>
        <Text style={[styles.matchStatus, { color: textColor }]}>
          {isLive ? '🔴 AO VIVO' : formatHora(match.data)}
        </Text>
      </View>

      {/* Troféu decorativo */}
      <Text style={styles.trophyIcon}>🏆</Text>

      {/* Times e Placar */}
      <View style={styles.teamsRow}>
        {/* Mandante */}
        <View style={styles.teamContainer}>
          <TeamFlag
            teamName={match.mandante}
            crestUrl={match.crestMandante}
            areaCode={match.areaMandanteCode}
            countryCode={match.countryMandanteCode}
            match={match}
            themeMode={themeMode}
          />
          <Text style={[styles.teamName, { color: textColor }]} numberOfLines={1}>
            {match.mandante}
          </Text>
        </View>

        {/* Placar */}
        <View style={styles.scoreContainer}>
          <Text style={[styles.score, { color: textColor }]}>
            {match.placarMandante ?? '-'}
          </Text>
          <Text style={[styles.scoreVs, { color: scoreVsColor }]}>x</Text>
          <Text style={[styles.score, { color: textColor }]}>
            {match.placarVisitante ?? '-'}
          </Text>
        </View>

        {/* Visitante */}
        <View style={styles.teamContainer}>
          <TeamFlag
            teamName={match.visitante}
            crestUrl={match.crestVisitante}
            areaCode={match.areaVisitanteCode}
            countryCode={match.countryVisitanteCode}
            match={match}
            themeMode={themeMode}
          />
          <Text style={[styles.teamName, { color: textColor }]} numberOfLines={1}>
            {match.visitante}
          </Text>
        </View>
      </View>

      {/* Info do jogo */}
      <View style={styles.matchInfoRow}>
        <Text style={styles.matchInfoIcon}>⚽</Text>
        <Text style={[styles.matchTimeInfo, { color: isDark ? '#4ade80' : '#059669' }]}>
          {isLive
            ? `Minuto: ${match.minute || '--'}'`
            : isFinished
              ? 'Encerrado'
              : 'Hoje'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 24,
    width: '46%',
    borderWidth: 1.5,
    alignItems: 'center',
    marginBottom: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 5,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  clockIcon: {
    fontSize: 24,
    marginRight: 6,
  },
  matchStatus: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  trophyIcon: {
    fontSize: 38,
    marginBottom: 10,
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 14,
  },
  teamContainer: {
    flex: 2,
    alignItems: 'center',
  },
  flagCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  flagImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  flagFallbackText: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  teamName: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  scoreContainer: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: {
    fontSize: 64,
    fontWeight: '900',
    marginHorizontal: 6,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  scoreVs: {
    fontSize: 28,
    fontWeight: 'bold',
    marginHorizontal: 4,
  },
  matchInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  matchInfoIcon: {
    fontSize: 20,
    marginRight: 6,
  },
  matchTimeInfo: {
    fontSize: 24,
    fontWeight: '600',
  },
});
