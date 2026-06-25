/**
 * Rodapé com histórico de chamadas anteriores.
 * Refatorado: usa tipo Chamada.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Chamada } from '../../types';

interface RodapeChamadasProps {
  chamadas: Chamada[];
}

export default function RodapeChamadas({ chamadas }: RodapeChamadasProps) {
  const anteriores = chamadas.slice().reverse().slice(0, 5);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ANTERIORES:</Text>
      <View style={styles.list}>
        {anteriores.length > 0 ? (
          anteriores.map((c, i) => (
            <React.Fragment key={i}>
              <Text style={styles.item}>
                Caixa {c.caixa} {c.tipo !== 'Normal' ? `(${c.tipo})` : ''}
              </Text>
              {i < anteriores.length - 1 && <Text style={styles.separator}>•</Text>}
            </React.Fragment>
          ))
        ) : (
          <Text style={styles.empty}>Vazio</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 0.08,
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    paddingHorizontal: 30,
    borderTopWidth: 2,
    borderTopColor: '#dddddd',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#444',
    marginRight: 20,
  },
  list: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  item: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0056b3',
  },
  separator: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#999',
    marginHorizontal: 15,
  },
  empty: {
    fontSize: 22,
    color: '#888',
    fontStyle: 'italic',
  },
});
