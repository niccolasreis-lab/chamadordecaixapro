# Módulo Painel Copa do Mundo - Implementação

## Objetivo
Este módulo foi criado para exibir informações da Copa do Mundo no Telão do sistema Chamador de Caixa PRO.

## Fontes de Dados
O módulo suporta múltiplas fontes de dados, garantindo disponibilidade contínua através de fallbacks:
- **Football-Data.org**: Fonte primária e ativa, que consome a API através de um token protegido apenas no backend.
- **Native Stats**: Adicionada como um provedor estrutural (dummy) no painel administrativo, pois não possui uma API pública e aberta sem o uso de scraping (o qual não é adotado para manter a integridade). Ela provê um erro amigável.
- **Automático**: O sistema tenta primeiro consumir a Native Stats, mas, devido a sua natureza estrutural e de fallback dummy rápido, imediatamente cai de volta para a Football-Data.org.

## Componentes Atualizados

### Backend
- `server/data/copa_mundo.json`: Arquivo de persistência da configuração.
- `server/services/worldCupDataService.js`: Orquestrador central com a lógica das fontes de dados, incluindo a captura e normalização de "Jogos de Hoje", "Próximos Jogos" e "Classificação / Grupos".
- `server/services/nativeStatsWorldCupService.js`: O serviço que engloba a integração nativa, configurado para retornar uma reposta amigável e limpa se solicitado.
- `server/routes/api.js`: Endpoints criados para as informações da Copa, sem a exposição dos tokens em frontend.
- `server/index.js`: Background worker foi atualizado para sincronizar de modo contínuo os dados da Copa via `worldCupDataService`.

### Frontend - Administração
- `server/public/admin/index.html`: UI para controle da Copa, contendo os modais customizados que não quebram o fluxo usando JS vanilla (`alert` / `confirm` foram trocados pelos modais construídos do projeto).

### Frontend - Telão
- `telao-apk/components/PainelCopaMundo.tsx`: Renderizador da interface do painel, inspirado e substituindo o painel esportivo legado.
- `telao-apk/App.tsx` e `telao-apk/components/MediaManager.tsx`: Foram atualizados para ouvir e reagir a eventos do WebSocket (`COPA_CONFIG_UPDATE` e `COPA_UPDATE`), respeitando a ordem de hierarquia visual correta do negócio.
v