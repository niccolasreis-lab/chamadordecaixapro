import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Standing } from '../../types';
import EmptyState from '../ui/EmptyState';

interface StandingsTableProps {
  standings: any[];
  maxItems?: number;
}

export default function StandingsTable({ standings, maxItems = 8 }: StandingsTableProps) {
  if (!standings || standings.length === 0) {
    return <EmptyState message="Classificação indisponível no momento." />;
  }

  // Detect if data is grouped (e.g. WorldCup26Provider returns groups containing a 'table' array)
  const isGrouped = standings[0] && typeof standings[0].group === 'string' && Array.isArray(standings[0].table);

  if (!isGrouped) {
    const visible = standings.slice(0, maxItems);

    return (
      <View style={styles.tableContainer}>
        {/* Header */}
        <View style={styles.tableRowHeader}>
          <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 0.5 }]}>#</Text>
          <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 3 }]}>Equipe</Text>
          <Text style={[styles.tableCell, styles.tableHeaderCell, styles.ptsHeader, { flex: 1 }]}>Pts</Text>
          <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 1 }]}>J</Text>
          <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 1 }]}>V</Text>
          <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 1 }]}>E</Text>
          <Text style={[styles.tableCell, styles.tableHeaderCell, { flex: 1 }]}>D</Text>
        </View>
        {/* Rows */}
        {visible.map((team, index) => (
          <View
            key={index}
            style={[
              styles.tableRow,
              index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd,
            ]}
          >
            <Text style={[styles.tableCell, styles.positionCell, { flex: 0.5 }]}>
              {team.position || index + 1}
            </Text>
            <Text style={[styles.tableCell, styles.teamCell, { flex: 3 }]}>
              {team.team?.shortName || team.team?.name || 'A definir'}
            </Text>
            <Text style={[styles.tableCell, styles.ptsCell, { flex: 1 }]}>
              {team.points || 0}
            </Text>
            <Text style={[styles.tableCell, { flex: 1 }]}>{team.playedGames || 0}</Text>
            <Text style={[styles.tableCell, { flex: 1 }]}>{team.won || 0}</Text>
            <Text style={[styles.tableCell, { flex: 1 }]}>{team.draw || 0}</Text>
            <Text style={[styles.tableCell, { flex: 1 }]}>{team.lost || 0}</Text>
          </View>
        ))}
      </View>
    );
  }

  // WorldCup26 Grouped logic: Pagination of groups (4 groups per page)
  const [currentPage, setCurrentPage] = useState(0);
  const groupsPerPage = 4;
  const totalPages = Math.ceil(standings.length / groupsPerPage);

  useEffect(() => {
    if (totalPages > 1) {
      const timer = setInterval(() => {
        setCurrentPage((prev) => (prev + 1) % totalPages);
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [totalPages]);

  const startIndex = currentPage * groupsPerPage;
  const visibleGroups = standings.slice(startIndex, startIndex + groupsPerPage);

  return (
    <View style={styles.gridContainer}>
      {visibleGroups.map((groupObj, gIndex) => (
        <View key={gIndex} style={styles.groupCard}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupTitle}>{groupObj.group.toUpperCase()}</Text>
          </View>
          <View style={styles.tableRowHeaderGroup}>
            <Text style={[styles.tableCellSmall, styles.tableHeaderCellSmall, { flex: 0.8 }]}>#</Text>
            <Text style={[styles.tableCellSmall, styles.tableHeaderCellSmall, { flex: 3.5 }]}>Seleção</Text>
            <Text style={[styles.tableCellSmall, styles.tableHeaderCellSmall, styles.ptsHeader, { flex: 1 }]}>P</Text>
            <Text style={[styles.tableCellSmall, styles.tableHeaderCellSmall, { flex: 1 }]}>J</Text>
            <Text style={[styles.tableCellSmall, styles.tableHeaderCellSmall, { flex: 1 }]}>SG</Text>
          </View>
          {groupObj.table.slice(0, 4).map((team: any, index: number) => (
            <View
              key={index}
              style={[
                styles.tableRowGroup,
                index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd,
              ]}
            >
              <Text style={[styles.tableCellSmall, styles.positionCell, { flex: 0.8 }]}>
                {team.position || index + 1}
              </Text>
              <Text style={[styles.tableCellSmall, styles.teamCell, { flex: 3.5 }]} numberOfLines={1}>
                {team.team?.shortName || team.team?.name || 'A definir'}
              </Text>
              <Text style={[styles.tableCellSmall, styles.ptsCell, { flex: 1 }]}>
                {team.points || 0}
              </Text>
              <Text style={[styles.tableCellSmall, { flex: 1 }]}>{team.playedGames || 0}</Text>
              <Text style={[styles.tableCellSmall, { flex: 1 }]}>{team.goalDifference || 0}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tableContainer: {
    backgroundColor: 'rgba(0, 40, 20, 0.6)',
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 200, 100, 0.25)',
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
    overflow: 'hidden',
  },
  tableRowHeader: {
    flexDirection: 'row',
    paddingVertical: 18,
    paddingHorizontal: 28,
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(0, 200, 100, 0.3)',
    backgroundColor: 'rgba(0, 60, 30, 0.5)',
    borderRadius: 10,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 8,
    marginVertical: 1,
  },
  tableRowEven: {
    backgroundColor: 'rgba(0, 40, 20, 0.3)',
  },
  tableRowOdd: {
    backgroundColor: 'rgba(0, 60, 30, 0.2)',
  },
  tableCell: {
    fontSize: 28,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500',
  },
  tableHeaderCell: {
    fontWeight: 'bold',
    color: 'rgba(255, 255, 255, 0.6)',
    textTransform: 'uppercase',
    fontSize: 24,
    letterSpacing: 1,
  },
  ptsHeader: {
    color: '#4ade80',
  },
  positionCell: {
    color: '#fbbf24',
    fontWeight: 'bold',
  },
  teamCell: {
    fontWeight: 'bold',
    color: '#ffffff',
  },
  ptsCell: {
    fontWeight: 'bold',
    color: '#4ade80',
  },
  // Grouped Layout Styles
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 2,
  },
  groupCard: {
    width: '49%',
    backgroundColor: 'rgba(0, 30, 15, 0.75)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 200, 100, 0.2)',
    marginBottom: 12,
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  groupHeader: {
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(0, 200, 100, 0.3)',
    paddingBottom: 4,
    marginBottom: 6,
    alignItems: 'center',
  },
  groupTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fbbf24',
    letterSpacing: 1,
  },
  tableRowHeaderGroup: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0, 50, 25, 0.4)',
    borderRadius: 6,
    marginBottom: 4,
  },
  tableRowGroup: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginVertical: 1,
  },
  tableCellSmall: {
    fontSize: 20,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500',
  },
  tableHeaderCellSmall: {
    fontWeight: 'bold',
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'uppercase',
    fontSize: 16,
    letterSpacing: 0.5,
  },
});
