import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image } from 'react-native';

interface PainelCopaMundoProps {
  copaConfig: any;
  specificBlock?: string;
}

const BandeiraBrasilReal = () => (
  <Image 
    source={require('../assets/bandeira-brasil.png')}
    style={styles.flagImage}
    resizeMode="contain"
  />
);

export default function PainelCopaMundo({ copaConfig, specificBlock }: PainelCopaMundoProps) {
  const [currentBlock, setCurrentBlock] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
  if (!copaConfig) return null;

  const {
    competicaoNome = "Copa do Mundo",
    mostrarJogosHoje,
    mostrarProximosJogos,
    mostrarClassificacaoGrupos,
    cache,
    ultimaAtualizacao
  } = copaConfig;

  const jogosHoje = cache?.jogosHoje || [];
  const proximosJogos = cache?.proximosJogos || [];
  const classificacao = cache?.classificacaoGrupos || [];

  const blocks = [];
  if (mostrarJogosHoje) blocks.push('jogosHoje');
  if (mostrarProximosJogos) blocks.push('proximosJogos');
  if (mostrarClassificacaoGrupos) blocks.push('classificacao');

  // Rotate blocks every 15 seconds if there are multiple, ONLY IF specificBlock is not provided
  useEffect(() => {
    if (specificBlock || blocks.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentBlock((prev) => (prev + 1) % blocks.length);
    }, 15000);
    return () => clearInterval(interval);
  }, [blocks.length, specificBlock]);

  // Smooth fade-in transition on mount / block change to avoid bright flash on TV screens
  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [specificBlock, currentBlock]);

  const formatHora = (dateString: string) => {
    try {
      const d = new Date(dateString);
      return d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '--:--';
    }
  };

  const formatDataHora = (dateString: string) => {
    try {
      const d = new Date(dateString);
      return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '--/-- --:--';
    }
  };

  const updatedTime = ultimaAtualizacao ? formatHora(ultimaAtualizacao) : '--:--';

  const renderEmpty = () => (
    <View style={styles.centerContainer}>
      <Text style={styles.emptyText}>Nenhum dado disponível no momento para esta competição.</Text>
    </View>
  );

  const renderJogosHoje = () => {
    if (jogosHoje.length === 0) {
      if (proximosJogos.length > 0 && mostrarProximosJogos) {
         return renderProximosJogos();
      }
      return renderEmpty();
    }
    
    // Max 4 games for TV
    const visible = jogosHoje.slice(0, 4);

    return (
      <View style={styles.gridContainer}>
        {visible.map((jogo: any, index: number) => (
          <View key={index} style={styles.card}>
            <Text style={styles.matchStatus}>
               {jogo.status === 'IN_PLAY' || jogo.status === 'PAUSED' ? '🔴 AO VIVO' : formatHora(jogo.data)}
            </Text>
            <View style={styles.teamsRow}>
              <Text style={styles.teamName}>{jogo.mandante}</Text>
              <Text style={styles.score}>{jogo.placarMandante ?? '-'}</Text>
              <Text style={styles.scoreVs}>x</Text>
              <Text style={styles.score}>{jogo.placarVisitante ?? '-'}</Text>
              <Text style={styles.teamName}>{jogo.visitante}</Text>
            </View>
            <Text style={styles.matchTimeInfo}>
               {jogo.status === 'IN_PLAY' || jogo.status === 'PAUSED' ? `Minuto: ${jogo.minute || '--'}'` : 'Hoje'}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const renderProximosJogos = () => {
    if (proximosJogos.length === 0) return renderEmpty();

    const visible = proximosJogos.slice(0, 6);

    return (
      <View style={styles.gridContainerSmall}>
        {visible.map((jogo: any, index: number) => (
          <View key={index} style={styles.cardSmall}>
            <Text style={styles.matchDate}>{formatDataHora(jogo.data)}</Text>
            <Text style={styles.matchTeamsSmall}>
              {jogo.mandante || 'Time'} x {jogo.visitante || 'Time'}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const renderClassificacao = () => {
    if (classificacao.length === 0) return renderEmpty();

    const visible = classificacao.slice(0, 8); // Top 8

    return (
      <View style={styles.tableContainer}>
        <View style={styles.tableRowHeader}>
          <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 0.5 }]}>#</Text>
          <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 3 }]}>Equipe</Text>
          <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 1, color: '#047857' }]}>Pts</Text>
          <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 1 }]}>J</Text>
          <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 1 }]}>V</Text>
          <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 1 }]}>E</Text>
          <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 1 }]}>D</Text>
        </View>
        {visible.map((team: any, index: number) => (
          <View key={index} style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 0.5 }]}>{team.position || (index + 1)}</Text>
            <Text style={[styles.tableCell, { flex: 3, fontWeight: 'bold', color: '#0f172a' }]}>{team.team?.shortName || team.team?.name || 'A definir'}</Text>
            <Text style={[styles.tableCell, { flex: 1, fontWeight: 'bold', color: '#047857' }]}>{team.points || 0}</Text>
            <Text style={[styles.tableCell, { flex: 1 }]}>{team.playedGames || 0}</Text>
            <Text style={[styles.tableCell, { flex: 1 }]}>{team.won || 0}</Text>
            <Text style={[styles.tableCell, { flex: 1 }]}>{team.draw || 0}</Text>
            <Text style={[styles.tableCell, { flex: 1 }]}>{team.lost || 0}</Text>
          </View>
        ))}
      </View>
    );
  };

  const mappedBlock = specificBlock === 'copa_jogos_hoje' ? 'jogosHoje' 
                    : specificBlock === 'copa_proximos_jogos' ? 'proximosJogos'
                    : specificBlock === 'copa_classificacao' ? 'classificacao'
                    : null;

  const activeBlock = mappedBlock || blocks[currentBlock] || 'empty';

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.header}>
        <View style={{flexDirection:'row', alignItems:'center'}}>
          <BandeiraBrasilReal />
          <Text style={styles.title}>Painel Copa do Mundo</Text>
        </View>
        <Text style={styles.subtitle}>Competição: {competicaoNome} | Atualizado às {updatedTime}</Text>
      </View>

      <View style={styles.content}>
        {activeBlock === 'jogosHoje' && (
          <View style={styles.blockContainer}>
            <Text style={styles.blockTitle}>Jogos de Hoje</Text>
            {renderJogosHoje()}
          </View>
        )}
        
        {activeBlock === 'proximosJogos' && (
          <View style={styles.blockContainer}>
            <Text style={styles.blockTitle}>Próximos Jogos</Text>
            {renderProximosJogos()}
          </View>
        )}
        
        {activeBlock === 'classificacao' && (
          <View style={styles.blockContainer}>
            <Text style={styles.blockTitle}>Classificação / Grupos</Text>
            {renderClassificacao()}
          </View>
        )}

        {activeBlock === 'empty' && renderEmpty()}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#f8fafc', // Soft light gray-blue background
    padding: 20,
    justifyContent: 'flex-start',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: '#e2e8f0', // Light grey border
    marginBottom: 20,
  },
  title: {
    fontSize: 38,
    fontWeight: 'bold',
    color: '#047857', // Premium Deep Emerald/Forest green
  },
  subtitle: {
    fontSize: 22,
    color: '#64748b', // Muted slate gray
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  blockContainer: {
    flex: 1,
  },
  blockTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0f172a', // Near black text
    marginBottom: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 32,
    color: '#64748b',
    textAlign: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 20,
  },
  card: {
    backgroundColor: '#ffffff', // Clean white background
    borderRadius: 16,
    padding: 25,
    width: '45%',
    borderWidth: 1,
    borderColor: '#e2e8f0', // Border outline
    alignItems: 'center',
    marginBottom: 10,
    // Soft shadow styling for Web and Native
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  matchStatus: {
    fontSize: 24,
    color: '#ea580c', // Bright orange for live/status
    fontWeight: 'bold',
    marginBottom: 15,
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 15,
  },
  teamName: {
    flex: 2,
    fontSize: 30,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
  },
  score: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#047857', // High contrast dark green for scores
    marginHorizontal: 10,
  },
  scoreVs: {
    fontSize: 24,
    color: '#94a3b8',
    marginHorizontal: 10,
  },
  matchTimeInfo: {
    fontSize: 20,
    color: '#64748b',
  },
  gridContainerSmall: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 15,
  },
  cardSmall: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    width: '31%',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  matchDate: {
    fontSize: 22,
    color: '#047857',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  matchTeamsSmall: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
  },
  tableContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  tableRowHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#cbd5e1',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tableCell: {
    fontSize: 24,
    color: '#334155',
  },
  tableHeaderCell: {
    fontWeight: 'bold',
    color: '#475569',
  },
  
  // Waving Brazilian Flag Style
  flagImage: {
    width: 60,
    height: 42,
    marginRight: 15,
  },
});
