import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface ModalProps {
  onActivate: () => void;
  visible: boolean;
}

export default function AtivarSomModal({ onActivate, visible }: ModalProps) {
  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const keys = ['Enter', ' ', 'Spacebar', 'OK', 'Select'];
      if (keys.includes(e.key)) {
        e.preventDefault();
        onActivate();
      }
    };

    // Adiciona listener global no window (web/Android TV WebView)
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [visible, onActivate]);

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.modal}>
        <Text style={styles.icon}>🔔</Text>
        <Text style={styles.title}>Ativar Som do Painel</Text>
        <Text style={styles.subtitle}>
          Para que as chamadas e vídeos reproduzam com áudio, pressione OK ou toque no botão abaixo.
        </Text>
        <TouchableOpacity style={styles.button} onPress={onActivate}>
          <Text style={styles.buttonText}>INICIAR TELÃO</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999, // Fica na frente de tudo
  },
  modal: {
    backgroundColor: '#fff',
    padding: 50,
    borderRadius: 20,
    alignItems: 'center',
    maxWidth: 600,
  },
  icon: {
    fontSize: 80,
    marginBottom: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 20,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#00c853',
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 10,
    elevation: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
});
