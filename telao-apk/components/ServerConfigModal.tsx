import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Modal } from 'react-native';

interface ServerConfigModalProps {
  visible: boolean;
  currentIp: string;
  currentPortApi: string;
  currentPortWs: string;
  onSave: (ip: string, portApi: string, portWs: string) => void;
  onCancel?: () => void;
}

export default function ServerConfigModal({
  visible,
  currentIp,
  currentPortApi,
  currentPortWs,
  onSave,
  onCancel,
}: ServerConfigModalProps) {
  const [ip, setIp] = useState(currentIp || '');
  const [portApi, setPortApi] = useState(currentPortApi || '3001');
  const [portWs, setPortWs] = useState(currentPortWs || '3001');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!ip.trim()) {
      setError('Por favor, informe o IP do servidor.');
      return;
    }
    setError('');
    onSave(ip.trim(), portApi.trim(), portWs.trim());
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.icon}>⚙️</Text>
          <Text style={styles.title}>Configuração do Servidor</Text>
          <Text style={styles.subtitle}>
            Informe os dados de conexão do servidor Chamador de Caixa PRO
          </Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.formGroup}>
            <Text style={styles.label}>IP do Servidor:</Text>
            <TextInput
              style={styles.input}
              value={ip}
              onChangeText={setIp}
              placeholder="Ex: 192.168.0.100"
              placeholderTextColor="#999"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.formGroup, { flex: 1, marginRight: 10 }]}>
              <Text style={styles.label}>Porta HTTP/API:</Text>
              <TextInput
                style={styles.input}
                value={portApi}
                onChangeText={setPortApi}
                placeholder="3001"
                placeholderTextColor="#999"
                keyboardType="numeric"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={[styles.formGroup, { flex: 1, marginLeft: 10 }]}>
              <Text style={styles.label}>Porta WebSocket:</Text>
              <TextInput
                style={styles.input}
                value={portWs}
                onChangeText={setPortWs}
                placeholder="3001"
                placeholderTextColor="#999"
                keyboardType="numeric"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.buttonContainer}>
            {onCancel && (
              <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onCancel}>
                <Text style={styles.buttonText}>CANCELAR</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleSave}>
              <Text style={styles.buttonText}>SALVAR E CONECTAR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10000,
  },
  modal: {
    backgroundColor: '#1c1c1e',
    padding: 40,
    borderRadius: 20,
    width: '80%',
    maxWidth: 650,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  icon: {
    fontSize: 60,
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 30,
  },
  errorText: {
    color: '#ff453a',
    fontSize: 16,
    marginBottom: 15,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  formGroup: {
    width: '100%',
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#2c2c2e',
    color: '#fff',
    fontSize: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#444',
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    width: '100%',
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 20,
    width: '100%',
    justifyContent: 'center',
  },
  button: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 160,
    marginHorizontal: 10,
  },
  cancelButton: {
    backgroundColor: '#3a3a3c',
  },
  saveButton: {
    backgroundColor: '#00c853',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
