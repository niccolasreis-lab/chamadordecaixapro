// server/services/nativeStatsWorldCupService.js

/**
 * Serviço que interage com a fonte de dados Native Stats.
 * Como validado, a Native Stats (https://native-stats.org) é renderizada via Phoenix LiveView
 * e não possui um endpoint público de JSON/GraphQL oficial ou documentado.
 * 
 * Fazer scraping de HTML dinâmico fere as diretrizes de confiabilidade do projeto.
 * Por isso, este serviço atua como uma estrutura simulada (dummy) que retorna
 * um erro amigável imediato. Isso garante que o orquestrador (worldCupDataService)
 * avance rapidamente para o fallback configurado (ex: Football-Data.org).
 */
class NativeStatsWorldCupService {
  /**
   * Tenta buscar dados agregados da Native Stats
   */
  async buscarDadosCompletos() {
    return {
      ok: false,
      erro: "Native Stats não possui endpoint público confirmado para consumo automático."
    };
  }
}

module.exports = new NativeStatsWorldCupService();
