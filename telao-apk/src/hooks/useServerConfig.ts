/**
 * Hook para gerenciar configuração do servidor (IP, portas).
 * Extraído de App.tsx — carrega do AsyncStorage e salva alterações.
 */

import { useState, useEffect } from 'react';
import { ServerConfig } from '../types';
import { DEFAULTS } from '../constants';
import { loadServerConfig, saveServerConfig } from '../services/storage';

export function useServerConfig() {
  const [serverConfig, setServerConfig] = useState<ServerConfig>({
    ip: '',
    portApi: DEFAULTS.PORT_API,
    portWs: DEFAULTS.PORT_WS,
    loaded: false,
  });
  const [configModalVisible, setConfigModalVisible] = useState(false);

  // Carrega configurações persistidas no início
  useEffect(() => {
    async function load() {
      try {
        const saved = await loadServerConfig();

        if (saved.ip) {
          setServerConfig({
            ip: saved.ip,
            portApi: saved.portApi || DEFAULTS.PORT_API,
            portWs: saved.portWs || DEFAULTS.PORT_WS,
            loaded: true,
          });
        } else {
          setServerConfig((prev) => ({ ...prev, loaded: true }));
          setConfigModalVisible(true);
        }
      } catch {
        setServerConfig((prev) => ({ ...prev, loaded: true }));
        setConfigModalVisible(true);
      }
    }
    load();
  }, []);

  // Salva novas configurações
  const handleSaveConfig = async (ip: string, portApi: string, portWs: string) => {
    try {
      await saveServerConfig(ip, portApi, portWs);
      setServerConfig({
        ip,
        portApi,
        portWs,
        loaded: true,
      });
      setConfigModalVisible(false);
    } catch (error) {
      console.error('Erro ao salvar config no AsyncStorage', error);
    }
  };

  return {
    serverConfig,
    configModalVisible,
    setConfigModalVisible,
    handleSaveConfig,
  };
}
