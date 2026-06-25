/**
 * Utilitário de bandeiras oficiais dos países via FlagCDN.
 *
 * Gera URLs de alta qualidade para:
 * - SVG (preferencial, qualidade infinita)
 * - PNG 320px (fallback para React Native nativo)
 *
 * Fonte: https://flagcdn.com
 */

import { getCountryCode } from './countries';

const FLAGCDN_BASE = 'https://flagcdn.com';

/**
 * Gera a URL SVG da bandeira oficial de um país via FlagCDN.
 * Qualidade máxima, ideal para telas Full HD e 4K.
 *
 * @param countryName Nome do país (ex: "Brazil", "México", "South Africa")
 * @returns URL do SVG ou null se país não mapeado
 */
export function getFlagSvgUrl(countryName: string): string | null {
  const code = getCountryCode(countryName);
  if (!code) return null;
  return `${FLAGCDN_BASE}/${code}.svg`;
}

/**
 * Gera a URL PNG da bandeira em alta resolução (320px de largura).
 * Fallback para quando SVG não for suportado.
 *
 * @param countryName Nome do país
 * @param width Largura em pixels (80, 160, 320)
 * @returns URL do PNG ou null se país não mapeado
 */
export function getFlagPngUrl(countryName: string, width: 80 | 160 | 320 = 320): string | null {
  const code = getCountryCode(countryName);
  if (!code) return null;
  return `${FLAGCDN_BASE}/w${width}/${code}.png`;
}

/**
 * Retorna a melhor URL de bandeira disponível para o país.
 * Prioriza SVG para qualidade máxima em telas grandes.
 *
 * @param countryName Nome do país
 * @returns URL da bandeira (SVG preferido, PNG como fallback) ou null
 */
export function getFlagUrl(countryName: string): string | null {
  // SVG é ideal para web (telão) — qualidade infinita
  return getFlagSvgUrl(countryName);
}
