import { API_AREA_MAP, ALIAS_MAP, CONFEDERATION_LOGOS } from './mapping';

// Cache em memória para guardar resoluções bem-sucedidas
const flagResolutionCache = new Map<string, string>();

/**
 * Normaliza o nome do time/país removendo espaços extras e convertendo para lowercase.
 */
function normalizeName(name: string): string {
  if (!name) return '';
  return name.trim().toLowerCase();
}

/**
 * Resolve o código do país a partir do nome do time/país, do código de área ou país personalizado.
 * Prioridade:
 * 1. ISO de 2 letras enviado diretamente
 * 2. Mapeamento do nome via aliases e API_AREA_MAP
 * 3. Mapeamento de código de 3 letras se houver
 */
export function getCountryIsoCode(
  teamName: string,
  areaCode?: string | null,
  countryCode?: string | null
): string | null {
  // 1. Prioriza códigos ISO de 2 letras
  if (countryCode && countryCode.length === 2) {
    return countryCode.toLowerCase();
  }
  if (areaCode && areaCode.length === 2) {
    return areaCode.toLowerCase();
  }

  // 2. Tenta resolver pelo nome normatizado e aliases
  const normalized = normalizeName(teamName);
  const resolvedName = ALIAS_MAP[normalized] || normalized;
  const mappedCode = API_AREA_MAP[resolvedName];
  if (mappedCode) {
    return mappedCode.toLowerCase();
  }

  // 3. Tenta mapear o areaCode de 3 letras
  if (areaCode && areaCode.length === 3) {
    // Busca no mapa o código de 3 letras que estaria associado a alguma área
    const mappedFrom3Letters = Object.values(API_AREA_MAP).find(
      (val) => val.toLowerCase() === areaCode.toLowerCase()
    );
    if (mappedFrom3Letters) {
      return mappedFrom3Letters.toLowerCase();
    }
  }

  // 4. Tenta mapear o countryCode de 3 letras
  if (countryCode && countryCode.length === 3) {
    const mappedFrom3Letters = Object.values(API_AREA_MAP).find(
      (val) => val.toLowerCase() === countryCode.toLowerCase()
    );
    if (mappedFrom3Letters) {
      return mappedFrom3Letters.toLowerCase();
    }
  }

  return null;
}

/**
 * Retorna a lista ordenada de URLs de fallback para uma bandeira.
 * A ordem segue exatamente a diretriz de fallback de bandeiras:
 * 1. Cache local
 * 2. FlagCDN (SVG)
 * 3. FlagCDN (PNG)
 * 4. Biblioteca country-flag-icons (CDN unpkg/jsdelivr)
 * 5. Logo de confederação ou placeholder/crest do time
 */
export function resolveFlagSequence(
  teamName: string,
  areaCode?: string | null,
  countryCode?: string | null,
  crestUrl?: string | null
): string[] {
  const cacheKey = `${teamName}_${areaCode || ''}_${countryCode || ''}`;
  
  // 1. Cache Local: Se já foi resolvido com sucesso na sessão, retorna direto
  const cachedUrl = flagResolutionCache.get(cacheKey);
  if (cachedUrl) {
    return [cachedUrl];
  }

  const urls: string[] = [];
  const iso = getCountryIsoCode(teamName, areaCode, countryCode);

  if (iso) {
    const upperIso = iso.toUpperCase();

    // Se for um código especial de confederação (UEFA, CONMEBOL, etc.)
    if (CONFEDERATION_LOGOS[upperIso]) {
      urls.push(CONFEDERATION_LOGOS[upperIso]);
    } else {
      // 2. FlagCDN (SVG)
      urls.push(`https://flagcdn.com/${iso}.svg`);

      // 3. FlagCDN (PNG)
      urls.push(`https://flagcdn.com/w320/${iso}.png`);

      // 4. Biblioteca country-flag-icons (via unpkg CDN estável)
      urls.push(`https://unpkg.com/country-flag-icons@1.5.0/3x2/${upperIso}.svg`);
      urls.push(`https://purecatamphetamine.github.io/country-flag-icons/3x2/${upperIso}.svg`);
    }
  }

  // 5. Fallback da Confederação baseado na associação geográfica
  const confederationLogo = getConfederationLogoByParentArea(teamName);
  if (confederationLogo) {
    urls.push(confederationLogo);
  }

  // Adiciona o brasão/crest retornado pela API football-data.org como fallback do time
  if (crestUrl) {
    urls.push(crestUrl);
  }

  // Fallback final: Logotipo oficial da FIFA
  urls.push(CONFEDERATION_LOGOS.FIFA);

  return urls;
}

/**
 * Registra no cache que uma URL foi carregada com sucesso para evitar novos fallbacks.
 */
export function cacheResolvedFlag(teamName: string, areaCode: string | null, countryCode: string | null, url: string): void {
  const cacheKey = `${teamName}_${areaCode || ''}_${countryCode || ''}`;
  flagResolutionCache.set(cacheKey, url);
}

/**
 * Tenta inferir o logotipo da confederação baseado no nome ou mapeamentos.
 */
function getConfederationLogoByParentArea(teamName: string): string | null {
  const normalized = normalizeName(teamName);
  const resolvedName = ALIAS_MAP[normalized] || normalized;
  const mappedCode = API_AREA_MAP[resolvedName];

  if (mappedCode && CONFEDERATION_LOGOS[mappedCode.toUpperCase()]) {
    return CONFEDERATION_LOGOS[mappedCode.toUpperCase()];
  }

  return null;
}
