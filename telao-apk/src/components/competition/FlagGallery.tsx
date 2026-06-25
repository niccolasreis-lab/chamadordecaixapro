import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Modal, Image } from 'react-native';
import { API_AREA_MAP, CONFEDERATION_LOGOS } from '../../services/flags/mapping';
import { resolveFlagSequence } from '../../services/flags';

interface FlagGalleryProps {
  visible: boolean;
  onClose: () => void;
}

export default function FlagGallery({ visible, onClose }: FlagGalleryProps) {
  const [search, setSearch] = useState('');
  const [selectedTheme, setSelectedTheme] = useState<'dark' | 'light'>('dark');

  // Filtra todas as áreas mapeadas com base na busca
  const items = Object.entries(API_AREA_MAP).filter(([name, code]) => {
    const term = search.toLowerCase();
    return name.toLowerCase().includes(term) || code.toLowerCase().includes(term);
  });

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <View style={[styles.container, selectedTheme === 'dark' ? styles.bgDark : styles.bgLight]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, selectedTheme === 'dark' ? styles.textDark : styles.textLight]}>
              🚩 Galeria de Bandeiras & Confederações
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>

          {/* Ferramentas / Controles */}
          <View style={styles.toolbar}>
            <TextInput
              style={[
                styles.searchInput,
                selectedTheme === 'dark' ? styles.inputDark : styles.inputLight
              ]}
              placeholder="Buscar país ou código (ex: Brazil, br)..."
              placeholderTextColor={selectedTheme === 'dark' ? '#888' : '#666'}
              value={search}
              onChangeText={setSearch}
            />

            <TouchableOpacity
              style={[
                styles.themeToggle,
                { backgroundColor: selectedTheme === 'dark' ? '#333' : '#e5e7eb' }
              ]}
              onPress={() => setSelectedTheme(prev => prev === 'dark' ? 'light' : 'dark')}
            >
              <Text style={{ color: selectedTheme === 'dark' ? '#fff' : '#000', fontWeight: 'bold' }}>
                Tema: {selectedTheme === 'dark' ? '🌙 Escuro' : '☀️ Claro'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Grid de Bandeiras */}
          <ScrollView contentContainerStyle={styles.grid}>
            {items.map(([name, code]) => {
              const urls = resolveFlagSequence(name, null, null);
              const primaryUrl = urls[0];

              return (
                <View
                  key={name}
                  style={[
                    styles.card,
                    selectedTheme === 'dark' ? styles.cardDark : styles.cardLight
                  ]}
                >
                  <View style={[
                    styles.flagWrapper,
                    selectedTheme === 'dark' ? styles.wrapperDark : styles.wrapperLight
                  ]}>
                    {primaryUrl ? (
                      <Image
                        source={{ uri: primaryUrl }}
                        style={styles.flagImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <Text style={styles.fallbackText}>?</Text>
                    )}
                  </View>
                  <Text style={[styles.countryName, selectedTheme === 'dark' ? styles.textDark : styles.textLight]} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text style={styles.countryCode}>
                    Código: {code.toUpperCase()}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  container: {
    width: '90%',
    height: '85%',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  bgDark: {
    backgroundColor: '#111827',
  },
  bgLight: {
    backgroundColor: '#f9fafb',
  },
  textDark: {
    color: '#ffffff',
  },
  textLight: {
    color: '#111827',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  closeButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  toolbar: {
    flexDirection: 'row',
    padding: 18,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    height: 46,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  inputDark: {
    backgroundColor: '#1f2937',
    color: '#fff',
    borderColor: '#374151',
  },
  inputLight: {
    backgroundColor: '#fff',
    color: '#000',
    borderColor: '#d1d5db',
  },
  themeToggle: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 16,
    justifyContent: 'center',
  },
  card: {
    width: '18%',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  cardDark: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
  },
  cardLight: {
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
  },
  flagWrapper: {
    width: 60,
    height: 40,
    borderRadius: 6,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
  },
  wrapperDark: {
    backgroundColor: '#111827',
    borderColor: '#4b5563',
  },
  wrapperLight: {
    backgroundColor: '#f3f4f6',
    borderColor: '#d1d5db',
  },
  flagImage: {
    width: '100%',
    height: '100%',
  },
  fallbackText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#888',
  },
  countryName: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    textTransform: 'capitalize',
    marginBottom: 2,
  },
  countryCode: {
    fontSize: 12,
    color: '#fbbf24',
    fontWeight: '600',
  },
});
