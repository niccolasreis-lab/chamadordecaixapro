const fs = require('fs');
const path = require('path');

const paisesFile = path.join(__dirname, '..', 'data', 'paises.json');
let paisesDb = [];

try {
  if (fs.existsSync(paisesFile)) {
    paisesDb = JSON.parse(fs.readFileSync(paisesFile, 'utf8'));
  }
} catch (e) {
  console.error('[CountryService] Erro ao carregar paises.json:', e.message);
}

/**
 * Normaliza strings para comparação robusta
 */
function normalize(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .trim();
}

/**
 * Localiza um país pelo nome, sigla ISO2, ISO3 ou aliases.
 */
function findCountry(query) {
  if (!query) return null;
  const normalizedQuery = normalize(query);

  return paisesDb.find(p => {
    if (normalize(p.iso2) === normalizedQuery) return true;
    if (normalize(p.iso3) === normalizedQuery) return true;
    if (normalize(p.en) === normalizedQuery) return true;
    if (normalize(p.ptBR) === normalizedQuery) return true;
    if (p.aliases && p.aliases.some(alias => normalize(alias) === normalizedQuery)) return true;
    return false;
  }) || null;
}

const CountryService = {
  /**
   * Traduz o nome de um país/time para português do Brasil (pt-BR)
   */
  translate(name) {
    if (!name) return name;
    const country = findCountry(name);
    return country ? country.ptBR : name;
  },

  /**
   * Retorna os metadados completos do país
   */
  getMetadata(nameOrCode) {
    return findCountry(nameOrCode);
  },

  /**
   * Retorna o código ISO2 (ou ISO3) do país
   */
  iso(nameOrCode, format = 'iso2') {
    const country = findCountry(nameOrCode);
    if (!country) return null;
    return format === 'iso3' ? country.iso3 : country.iso2;
  },

  /**
   * Retorna o nome do arquivo de bandeira associado
   */
  flag(nameOrCode) {
    const country = findCountry(nameOrCode);
    return country ? country.flag : null;
  },

  /**
   * Retorna a confederação de futebol do país (ex: CONMEBOL, UEFA)
   */
  confederation(nameOrCode) {
    const country = findCountry(nameOrCode);
    return country ? country.confederation : null;
  },

  /**
   * Retorna o caractere Emoji de bandeira correspondente
   */
  emoji(nameOrCode) {
    const country = findCountry(nameOrCode);
    return country ? country.emoji : null;
  },

  /**
   * Busca países que batem com uma query
   */
  search(query) {
    if (!query) return [];
    const normalizedQuery = normalize(query);
    return paisesDb.filter(p => 
      normalize(p.ptBR).includes(normalizedQuery) ||
      normalize(p.en).includes(normalizedQuery) ||
      (p.aliases && p.aliases.some(alias => normalize(alias).includes(normalizedQuery)))
    );
  }
};

module.exports = CountryService;
