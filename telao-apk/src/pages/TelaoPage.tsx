/**
 * Página principal do Telão — compõe todos os componentes usando hooks e layout.
 *
 * Esta é a "nova App.tsx": limpa, declarativa e sem lógica inline.
 * Toda a lógica foi movida para hooks e services.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

// Hooks
import { useServerConfig } from '../hooks/useServerConfig';
import { useWebSocket, WebSocketHandlers } from '../hooks/useWebSocket';
import { useApi } from '../hooks/useApi';
import { useChamada } from '../hooks/useChamada';

// Layout
import TelaoLayout from '../layouts/TelaoLayout';

// Components
import HeaderInstitucional from '../components/header/HeaderInstitucional';
import MediaManager from '../components/media/MediaManager';
import RodapeChamadas from '../components/footer/RodapeChamadas';
import ChamadaOverlay from '../components/chamada/ChamadaOverlay';
import AtivarSomModal from '../components/modals/AtivarSomModal';
import ServerConfigModal from '../components/modals/ServerConfigModal';
import FlagGallery from '../components/competition/FlagGallery';

// Utils
import { buildServerUrl, resolveMediaUrl } from '../utils/url';

// Services
import { fetchStreams } from '../services/api';

export default function TelaoPage() {
  const [somAtivado, setSomAtivado] = useState(false);
  const [flagGalleryVisible, setFlagGalleryVisible] = useState(false);

  // Hooks de estado
  const { serverConfig, configModalVisible, setConfigModalVisible, handleSaveConfig } = useServerConfig();
  const resolvedServerUrl = buildServerUrl(serverConfig);

  const {
    midias, setMidias,
    streams, setStreams,
    somMidia, setSomMidia,
    eventoMode, setEventoMode,
    institucional, setInstitucional,
    competitionConfig, setCompetitionConfig,
    mediaPlayNow, setMediaPlayNow,
    refetch,
  } = useApi(resolvedServerUrl);

  const { chamadaAtual, historico, adicionarChamada, limparChamada } = useChamada();

  // Handlers do WebSocket — memoizado para evitar re-renders desnecessários
  const wsHandlers = useMemo<WebSocketHandlers>(() => ({
    CALL: (data) => adicionarChamada(data),
    MEDIA_UPDATE: (data) => setMidias(data),
    STREAM_UPDATE: (data) => setStreams(data),
    STREAM_CHANGE: () => {
      if (resolvedServerUrl) {
        fetchStreams(resolvedServerUrl).then(setStreams);
      }
    },
    CONFIG_UPDATE: (data) => {
      if (data && typeof data.somMidia === 'boolean') {
        setSomMidia(data.somMidia);
      }
    },
    EVENT_MODE: (data) => setEventoMode(data),
    INSTITUCIONAL_UPDATE: (data) => setInstitucional(data),
    MEDIA_PLAY_NOW: (data) => setMediaPlayNow(data),
    COPA_CONFIG_UPDATE: (data) => setCompetitionConfig(data),
    SPORTS_CONFIG_UPDATE: (data) => setCompetitionConfig(data),
    COPA_UPDATE: (data) => {
      setCompetitionConfig((prev: any) => ({
        ...prev,
        cache: data,
        ultimaAtualizacao: new Date().toISOString(),
      }));
    },
  }), [resolvedServerUrl, adicionarChamada, setMidias, setStreams, setSomMidia, setEventoMode, setInstitucional, setMediaPlayNow, setCompetitionConfig]);

  const { connected } = useWebSocket(serverConfig, wsHandlers);

  // Força atualização dos dados ao conectar/reconectar
  useEffect(() => {
    if (connected && resolvedServerUrl) {
      console.log('[TelaoPage] Conectado/Reconectado ao servidor. Atualizando dados locais...');
      refetch();
    }
  }, [connected, resolvedServerUrl, refetch]);

  // Resolve URLs de logo e QRCode para o header
  const resolvedInstitucional = useMemo(() => ({
    ...institucional,
    logo: institucional.logo
      ? resolveMediaUrl(institucional.logo, resolvedServerUrl)
      : '',
    qrcode: institucional.qrcode
      ? resolveMediaUrl(institucional.qrcode, resolvedServerUrl)
      : '',
  }), [institucional, resolvedServerUrl]);

  return (
    <TelaoLayout
      header={
        <HeaderInstitucional dados={resolvedInstitucional} />
      }
      content={
        resolvedServerUrl ? (
          <MediaManager
            midias={midias}
            streams={streams}
            eventoMode={eventoMode}
            chamadaAtiva={!!chamadaAtual}
            serverUrl={resolvedServerUrl}
            somAtivado={somAtivado}
            somMidia={somMidia}
            mediaPlayNow={mediaPlayNow}
            onMediaPlayNowComplete={() => setMediaPlayNow(null)}
            institucional={institucional}
            copaConfig={competitionConfig}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Configure o servidor para iniciar.</Text>
          </View>
        )
      }
      footer={
        <RodapeChamadas chamadas={historico} />
      }
      overlays={
        <>
          {/* Modal de Ativação do Som */}
          <AtivarSomModal
            visible={!somAtivado}
            onActivate={() => setSomAtivado(true)}
          />

          {/* Modal de Configuração do Servidor */}
          <ServerConfigModal
            visible={configModalVisible}
            currentIp={serverConfig.ip}
            currentPortApi={serverConfig.portApi}
            currentPortWs={serverConfig.portWs}
            onSave={handleSaveConfig}
            onCancel={serverConfig.ip ? () => setConfigModalVisible(false) : undefined}
          />

          {/* Galeria de Bandeiras para Desenvolvimento */}
          <FlagGallery
            visible={flagGalleryVisible}
            onClose={() => setFlagGalleryVisible(false)}
          />

          {/* Indicador Offline */}
          {!connected && (
            <View style={styles.offline}>
              <Text style={styles.offlineText}>Aguardando Servidor...</Text>
              <TouchableOpacity
                style={styles.configButton}
                onPress={() => setConfigModalVisible(true)}
              >
                <Text style={styles.configButtonText}>⚙️ Configurar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.configButton, { backgroundColor: 'rgba(251, 191, 36, 0.3)', marginTop: 4 }]}
                onPress={() => setFlagGalleryVisible(true)}
              >
                <Text style={styles.configButtonText}>🚩 Bandeiras</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Overlay de Chamada por cima de tudo */}
          <ChamadaOverlay
            chamada={chamadaAtual}
            eventoMode={eventoMode}
            historico={historico}
            onComplete={limparChamada}
            somAtivado={somAtivado}
            serverUrl={resolvedServerUrl}
          />
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
  },
  emptyText: {
    color: '#aaa',
    fontSize: 20,
  },
  offline: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(211, 47, 47, 0.9)',
    padding: 15,
    borderRadius: 8,
    zIndex: 9999,
    alignItems: 'center',
  },
  offlineText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  configButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 5,
    marginTop: 8,
    width: '100%',
    alignItems: 'center',
  },
  configButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
