# Relatório - Módulo Painel Esportivo

Este documento descreve a implementação do Painel Esportivo no projeto **Chamador de Caixa PRO**, utilizando a API externa `football-data.org`.

## Funcionalidades

O Módulo Esportivo permite exibir placares ao vivo, partidas futuras e a classificação da competição desejada. Ele é integrado com as seguintes regras de negócio:

1.  **Prioridade Flexível:** O Painel Esportivo pode atuar como fallback de segurança caso o stream de vídeo do YouTube fique inacessível (ex: erro 150), preenchendo o Telão sem quebrar o layout. Ele também pode assumir prioridade acima de mídias locais quando ativado de forma independente.
2.  **Segurança do Token:** O token da API (`FOOTBALL_DATA_TOKEN`) é lido estritamente pelo backend Node.js (`server/services/footballDataService.js`) através de variáveis de ambiente (`.env`). Ele nunca é exposto ao front-end ou ao Telão.
3.  **Cache Inteligente:** As requisições são rate-limited pela API (10 req/min). O backend gerencia o polling de forma segura (a cada 60 segundos por padrão) e salva os dados num arquivo de cache `server/data/esportes.json`.
4.  **Resiliência a Erros:** Em caso de `429 Too Many Requests` ou `403 Forbidden`, o sistema preserva o cache antigo para evitar que a tela fique preta.
5.  **Configuração Local:** O Admin panel (`admin/index.html`) foi atualizado com botões de configuração intuitivos que persistem no cache local e propagam os dados ao Telão via WebSocket instantaneamente (`SPORTS_CONFIG_UPDATE`).
6.  **Experiência do TV:** O front-end React Native TV (`PainelEsportivo.tsx`) não possui "scroll". O conteúdo que exceder as linhas da tabela/cards faz um "swap" por blocos a cada 15 segundos para melhor legibilidade a longas distâncias.
