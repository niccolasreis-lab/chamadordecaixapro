/**
 * Script de teste para validação dos Provedores e do CountryService.
 */
require('dotenv').config(); // Carrega o .env se existir
const CountryService = require('./services/CountryService');
const ProviderFactory = require('./services/providers/ProviderFactory');

console.log('=============================================');
console.log('TESTANDO COUNTRY TRANSLATION SERVICE');
console.log('=============================================');

const testesTraducao = [
  'Brazil',
  'South Korea',
  'Czechia',
  'Bosnia-Herzegovina',
  'Germany',
  'England',
  'Unknown Team'
];

testesTraducao.forEach(name => {
  const traduzido = CountryService.translate(name);
  const iso = CountryService.iso(name);
  const emoji = CountryService.emoji(name);
  const confed = CountryService.confederation(name);
  console.log(`Original: "${name}" -> Traduzido: "${traduzido}" | ISO: ${iso} | Emoji: ${emoji} | Confederação: ${confed}`);
});

console.log('\n=============================================');
console.log('TESTANDO CADEIA DE PROVEDORES (ProviderFactory)');
console.log('=============================================');

async function testarFactory() {
  try {
    // 1. Testar buscar jogos hoje
    console.log('\n--- Buscando Jogos de Hoje via Factory ---');
    const resHoje = await ProviderFactory.buscarDados('buscarJogosHoje', 'WC');
    console.log(`Fonte Utilizada: ${resHoje.fonteUsada}`);
    console.log(`Total de partidas hoje: ${resHoje.data.length}`);
    if (resHoje.data.length > 0) {
      console.log('Exemplo partida:', JSON.stringify(resHoje.data[0], null, 2));
    }

    // 2. Testar buscar próximos jogos
    console.log('\n--- Buscando Próximos Jogos via Factory ---');
    const resProximos = await ProviderFactory.buscarDados('buscarProximosJogos', 'WC');
    console.log(`Fonte Utilizada: ${resProximos.fonteUsada}`);
    console.log(`Total de próximos jogos: ${resProximos.data.length}`);

    // 3. Testar buscar classificação
    console.log('\n--- Buscando Classificação via Factory ---');
    const resClassif = await ProviderFactory.buscarDados('buscarClassificacao', 'WC');
    console.log(`Fonte Utilizada: ${resClassif.fonteUsada}`);
    console.log(`Total de grupos: ${resClassif.data.length}`);
    if (resClassif.data.length > 0) {
      console.log('Tabela do Grupo 1:', JSON.stringify(resClassif.data[0].table.slice(0, 2), null, 2));
    }

    console.log('\n✅ Todos os testes de provedores passaram!');
  } catch (err) {
    console.error('❌ Falha nos testes de provedores:', err);
  }
}

testarFactory();
