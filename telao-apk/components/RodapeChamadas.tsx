import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface RodapeProps {
  chamadas: Array<{ caixa: string; tipo: string }>;
}

export default function RodapeChamadas({ chamadas }: RodapeProps) {
  // Pega as últimas 5 chamadas (ignorando a atual que está no overlay, caso queiramos)
  // Vamos exibir até 5 anteriores. Se a lista crescer, pegamos do fim.
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
    flex: 0.12, // 12% da tela
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    paddingHorizontal: 30,
    borderTopWidth: 2,
    borderTopColor: '#dddddd',
  },
  title: {
    fontSize: 32,
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
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0056b3',
  },
  separator: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#999',
    marginHorizontal: 15,
  },
  empty: {
    fontSize: 28,
    color: '#888',
    fontStyle: 'italic',
  },
});
