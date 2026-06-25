/**
 * Header institucional — exibe logo, informações do estabelecimento e relógio.
 * Refatorado: usa tipo InstitucionalData e util formatTime.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { InstitucionalData } from '../../types';
import { formatTime } from '../../utils/date';

interface HeaderInstitucionalProps {
  dados: InstitucionalData;
}

export default function HeaderInstitucional({ dados }: HeaderInstitucionalProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hasLogo = !!dados.logo;
  const showName = dados.mostrarNome !== false;
  const showSlogan = dados.mostrarSlogan !== false && !!dados.slogan;
  const showQRCode = dados.mostrarQRCode === true && !!dados.qrcode;

  const contactDetails: string[] = [];
  if (dados.mostrarTelefone !== false && dados.telefone) contactDetails.push(dados.telefone);
  if (dados.mostrarSite !== false && dados.site) contactDetails.push(dados.site);
  if (dados.mostrarInstagram !== false && dados.instagram) contactDetails.push(dados.instagram);
  const contactInfo = contactDetails.join(' | ');

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {hasLogo ? (
          <Image source={{ uri: dados.logo }} style={styles.logo} resizeMode="contain" />
        ) : showName ? (
          <Text style={styles.logoText} numberOfLines={2} ellipsizeMode="tail">
            {dados.nome || 'Nome da Empresa'}
          </Text>
        ) : null}
      </View>

      <View style={styles.center}>
        {showSlogan && (
          <Text style={styles.slogan} numberOfLines={1} ellipsizeMode="tail">
            {dados.slogan}
          </Text>
        )}
        {!!contactInfo && (
          <Text style={styles.info} numberOfLines={1} ellipsizeMode="tail">
            {contactInfo}
          </Text>
        )}
      </View>

      <View style={styles.right}>
        {showQRCode && (
          <Image source={{ uri: dados.qrcode }} style={styles.qrcode} resizeMode="contain" />
        )}
        <Text style={styles.clock}>{formatTime(time)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 0.08,
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 3,
    borderBottomColor: '#e0e0e0',
  },
  left: {
    flex: 1.2,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  logo: {
    width: 200,
    height: 60,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#003366',
  },
  center: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  slogan: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 2,
    textAlign: 'center',
  },
  info: {
    fontSize: 14,
    color: '#555555',
    fontWeight: '600',
    textAlign: 'center',
  },
  right: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  qrcode: {
    width: 60,
    height: 60,
    marginRight: 15,
  },
  clock: {
    fontSize: 38,
    fontWeight: 'bold',
    color: '#111111',
    fontVariant: ['tabular-nums'],
  },
});
