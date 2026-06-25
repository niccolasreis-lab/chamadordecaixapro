/**
 * Serviço de armazenamento persistente (wrapper sobre AsyncStorage).
 * Centraliza acesso às chaves de configuração do servidor.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ServerConfig } from '../types';
import { STORAGE_KEYS, DEFAULTS } from '../constants';

/**
 * Lê a configuração do servidor salva no AsyncStorage.
 */
export async function loadServerConfig(): Promise<Partial<ServerConfig>> {
  try {
    const savedIp = await AsyncStorage.getItem(STORAGE_KEYS.SERVER_IP);
    const savedPortApi = await AsyncStorage.getItem(STORAGE_KEYS.SERVER_PORT_API) || DEFAULTS.PORT_API;
    const savedPortWs = await AsyncStorage.getItem(STORAGE_KEYS.SERVER_PORT_WS) || DEFAULTS.PORT_WS;

    let defaultIp = savedIp;

    // Se estiver rodando na web, usa hostname como fallback se não houver IP salvo
    if (
      !defaultIp &&
      typeof window !== 'undefined' &&
      window.location &&
      window.location.hostname &&
      window.location.hostname !== 'localhost'
    ) {
      defaultIp = window.location.hostname;
    }

    return {
      ip: defaultIp || '',
      portApi: savedPortApi,
      portWs: savedPortWs,
    };
  } catch (error) {
    console.error('Erro ao ler config do AsyncStorage', error);
    return {};
  }
}

/**
 * Salva a configuração do servidor no AsyncStorage.
 */
export async function saveServerConfig(
  ip: string,
  portApi: string,
  portWs: string
): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.SERVER_IP, ip);
    await AsyncStorage.setItem(STORAGE_KEYS.SERVER_PORT_API, portApi);
    await AsyncStorage.setItem(STORAGE_KEYS.SERVER_PORT_WS, portWs);
  } catch (error) {
    console.error('Erro ao salvar config no AsyncStorage', error);
    throw error;
  }
}
