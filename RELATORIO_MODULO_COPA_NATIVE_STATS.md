# Análise de Viabilidade: Native Stats para Copa do Mundo

## 1. Objetivo
Analisar a viabilidade da utilização da plataforma `native-stats.org` (exemplo: https://native-stats.org/competition/WC/) como fonte secundária de dados estruturados em tempo real para o módulo "Painel Copa do Mundo".

## 2. Metodologia
A plataforma foi inspecionada para descobrir pontos de entrada como APIs REST, JSON ou GraphQL que pudessem ser consultados diretamente do backend em Node.js de forma autorizada ou pública.

## 3. Conclusões
- **Ausência de API Pública Confirmada**: A plataforma Native Stats não disponibiliza (publicamente) um endpoint JSON limpo ou RESTful para consumo programático.
- **Renderização via Phoenix LiveView**: O site é fortemente baseado em Server-Side Rendering reativo, utilizando Phoenix LiveView e WebSockets ofuscados para atualização em tempo real do DOM.
- **Limitação de Scraping**: Para obter os dados, seria necessário construir um web scraper (ex: usando Puppeteer, Playwright ou Cheerio). Isso é considerado uma prática "agressiva", instável a longo prazo (pois o layout pode mudar) e quebra os preceitos de robustez do `Chamador de Caixa PRO`.

## 4. Decisão Implementada
A Native Stats **não será usada como fonte funcional de consumo automático via scraping**.

Em vez disso:
- A Native Stats foi adicionada como uma provedora "dummy" de dados no painel administrativo e backend para fim estrutural (fallback de demonstração/erro).
- Sempre que solicitada, o serviço `nativeStatsWorldCupService.js` retorna o seguinte erro amigável de forma imediata:
  `"Native Stats não possui endpoint público confirmado para consumo automático."`
- O orquestrador detecta essa falha de forma instantânea e aciona imediatamente o fallback de segurança, mudando a fonte de dados provisória para a **football-data.org**.
- Essa implementação preserva a modularidade (se um dia a Native Stats lançar uma API, basta trocar o dummy service pela integração de endpoints) e a estabilidade da aplicação, garantindo que o telão nunca quebre por causa de web scraping agressivo.
