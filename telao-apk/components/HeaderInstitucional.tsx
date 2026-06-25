import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

interface HeaderProps {
  dados: {
    nome: string;
    telefone: string;
    site: string;
    instagram: string;
    slogan: string;
    logo?: string;
    qrcode?: string;
    mostrarNome?: boolean;
    mostrarTelefone?: boolean;
    mostrarSite?: boolean;
    mostrarInstagram?: boolean;
    mostrarSlogan?: boolean;
    mostrarQRCode?: boolean;
  };
}

export default function HeaderInstitucional({ dados }: HeaderProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  };

  const hasLogo = !!dados.logo;
  const showName = dados.mostrarNome !== false; // default to true
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
    flex: 0.12, // 12% da tela
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 4,
    borderBottomColor: '#e0e0e0',
  },
  left: {
    flex: 1.2,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  logo: {
    width: 220,
    height: 70,
  },
  logoText: {
    fontSize: 28,
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
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
    textAlign: 'center',
  },
  info: {
    fontSize: 16,
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
    width: 75,
    height: 75,
    marginRight: 15,
  },
  clock: {
    fontSize: 44,
    fontWeight: 'bold',
    color: '#111111',
    fontVariant: ['tabular-nums'],
  },
});
