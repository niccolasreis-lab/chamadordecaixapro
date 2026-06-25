# Documento de Requisitos do Produto (PRD) — Chamador de Caixa PRO v2.0 🚀

O **Chamador de Caixa PRO** é uma solução SaaS corporativa robusta e de alta performance desenvolvida para ambientes de varejo e atendimento ao cliente. Este documento descreve a visão geral do produto, seus módulos, requisitos funcionais e não funcionais, regras de negócios e arquitetura para a versão 2.0.

---

## 1. Visão Geral do Produto

### 1.1 Objetivo e Proposta de Valor
Melhorar a experiência de atendimento ao cliente em estabelecimentos varejistas e comerciais por meio de um sistema integrado de chamadas de caixa em tempo real combinada com mídia digital (*digital signage*). A principal proposta de valor é a **resiliência absoluta**: o sistema não pode falhar ou perder chamadas, mesmo em cenários de oscilação total de rede, mantendo a atração visual ativa e fluida para o cliente final.

### 1.2 Público-Alvo
- Supermercados, hipermercados e atacarejos.
- Lojas de conveniência e farmácias.
- Centros de atendimento ao cidadão e clínicas.
- Qualquer estabelecimento comercial com múltiplos caixas/pontos de atendimento e um telão central para clientes.

### 1.3 Indicadores de Sucesso (KPIs)
- **Latência de Chamada**: Menor que 500ms entre o acionamento no PDV e exibição no Telão.
- **Taxa de Sucesso de Entrega de Chamada**: 99.9% (através do mecanismo de fallback).
- **Tempo de Recuperação de Stream (YouTube)**: Menor que 30 segundos em caso de falha de conexão.
- **Facilidade de Instalação**: Setup e inicialização automática via scripts powershell em menos de 5 minutos.

---

## 2. Arquitetura Geral do Sistema

O sistema é baseado em uma arquitetura multimodular distribuída localmente, permitindo operação autônoma sem dependência estrita de servidores em nuvem.

```mermaid
flowchart TD
    subgraph Caixas [Pontos de Venda - PDV]
        A[PDV Client 01<br/>Caixa Operador (Electron)]
        B[PDV Client 02<br/>Caixa Operador (Electron)]
    end

    subgraph Core [Servidor Central Local]
        S[Servidor Unificado<br/>Node.js / Express]
        F[Monitor de Pasta de Contingência<br/>Chokidar]
    end

    subgraph Exibicao [Painel / Telão]
        T[Telão Android TV<br/>React Native / Expo]
    end

    subgraph Externo [APIs Externas / Provedores]
        Y[YouTube Live Stream]
        FD[Football-Data.org API]
    end

    A -->|1. WebSocket CALL / HTTP| S
    B -->|1. WebSocket CALL / HTTP| S
    A -.->|Fallback Off-line| F
    F -->|2. Repassa Chamada| S
    S -->|3. Broadcast WebSocket| T
    T -->|Consome Stream| Y
    S -->|Polling Cache / 60s| FD
    S -->|4. Atualizações de Dados| T
```

---

## 3. Módulos do Sistema

### 3.1 Servidor Unificado (`/server`)
O núcleo do sistema, responsável pela orquestração do estado, API REST, WebSocket, monitoramento de contingência e painel administrativo.
- **Tecnologias**: Node.js, Express, `ws` (WebSockets), `chokidar` (monitoramento de arquivos).
- **Persistência**: Bancos de dados leves baseados em arquivos JSON (`midias.json`, `streams.json`, `copa_mundo.json`, `esportes.json`).
- **Segurança**: Autenticação básica (*Basic Auth*) protegendo o Painel Administrativo.

### 3.2 Cliente PDV (`/pdv-client`)
Aplicativo desktop leve instalado em cada terminal de caixa/operador.
- **Tecnologias**: Electron, `uiohook-napi` (atalhos globais de teclado).
- **Operação**: Atalho de teclado rápido (`Ctrl + Shift + C`) envia sinal ao Servidor via WebSocket. Em caso de perda de conexão, escreve arquivos JSON localmente em um diretório de contingência compartilhado na rede.

### 3.3 Telão Android TV (`/telao-apk`)
Aplicativo exibidor instalado na Smart TV ou TV box voltada para os clientes.
- **Tecnologias**: Expo (SDK 56.0.0), React Native, `react-native-web` (para preview em navegadores), `expo-av` (reprodução de mídias locais), `react-native-youtube-iframe` (transmissão ao vivo do YouTube).
- **Operação**: Conecta via WebSocket ao servidor local, exibe lista de reprodução de mídias (imagens e vídeos) ou stream do YouTube ativo, e sobrepõe as chamadas de caixa instantaneamente.

### 3.4 Instalador e Serviços (`/installer`)
Módulo de automação de infraestrutura.
- **Tecnologias**: Scripts PowerShell e NSSM (Non-Sucking Service Manager).
- **Operação**: Instala dependências do backend, cria e inicializa o serviço Windows do Servidor Unificado para inicialização silenciosa e resiliente com o sistema operacional, e adiciona regras de Firewall para liberar a porta de comunicação (`3001`).

---

## 4. Requisitos Funcionais

### RF01: Prioridade Absoluta das Chamadas (Regra de Ouro)
- **Descrição**: Sempre que um caixa chamar (`CALL`), o Telão deve parar qualquer exibição secundária e focar na chamada.
- **Comportamento**:
  1. O áudio do vídeo ou transmissão ativa do YouTube deve ser imediatamente silenciado/pausado.
  2. Um **Overlay de Chamada** fullscreen em alto contraste (estilo Verde Neon com texto gigante) deve cobrir 100% da tela.
  3. A voz sintetizada (TTS) ou a narração gravada personalizada em formato MP3 deve anunciar a chamada sonoramente (Ex: *"Senha 01, Caixa 01"* ou *"Caixa Livre 01"*).
  4. O número do caixa exibido deve conter preenchimento de dois dígitos (Ex: Caixa 6 exibido como `06`).
  5. Após finalizar o tempo de exibição do Overlay, a mídia/stream deve ser retomada automaticamente do exato ponto em que parou.

### RF02: Mapeamento de Narrações Customizadas em MP3 e Fallback
- **Descrição**: O telão deve tocar arquivos de áudio gravados de forma personalizada (`.mp3`) para cada caixa. Se o arquivo não existir, deve utilizar a síntese de voz (TTS) do navegador como fallback de segurança.
- **Estrutura de Arquivos de Narração**:
  - Normal/Rápido: `caixa livre_[numero].mp3`
  - Preferencial: `caixa livre_[numero]_preferencial.mp3`
- **Lógica de Fallback**: O sistema tenta carregar o arquivo estático via URL HTTP `/narracoes/[arquivo].mp3`. Em caso de erro HTTP (ex: `404 Not Found`), o telão reage chamando a API `window.speechSynthesis`.

### RF03: Contingência e Fallback Off-line
- **Descrição**: Se o servidor central ou a conexão de rede oscilarem, as chamadas do PDV não podem ser perdidas.
- **Comportamento**:
  - O **PDV Client** monitora o status do WebSocket. Se desconectado, grava um arquivo JSON na pasta configurada no disco local/rede (`C:\chamador_fallback`).
  - O **Servidor Unificado** utiliza o `chokidar` para observar esse diretório de forma contínua.
  - Assim que a rede/servidor restabelece, o servidor processa todos os arquivos JSON acumulados por ordem cronológica, envia os eventos de chamada ao Telão via WebSocket e apaga os arquivos consumidos imediatamente.

### RF04: Rotação de Mídias Locais (Digital Signage)
- **Descrição**: O administrador pode fazer upload de vídeos (`.mp4`) e imagens (`.jpg`, `.png`, `.gif`) para exibição em loop de marketing digital no Telão.
- **Comportamento**:
  - Vídeos são reproduzidos por completo antes de passar para a próxima mídia da lista.
  - Imagens possuem tempo de duração configurável individualmente pelo Painel Administrativo.
  - O administrador pode reordenar as mídias usando controles de ordenação (⬆️/⬇️), ativar/desativar mídias, definir uma mídia para "reproduzir primeiro" ou disparar um teste de exibição imediata no telão.
  - **Watchdog de Segurança (Playlist Resiliente)**: Para evitar que o telão congele caso um vídeo falhe silenciosamente ao carregar ou trave em buffering eterno por instabilidades de rede, a playlist possui um temporizador watchdog (safety-net). Se um vídeo exceder sua duração configurada mais uma tolerância de 15 segundos sem emitir os eventos nativos de encerramento (`onFinish`/`onError`), a playlist avança forçadamente para a próxima mídia.

### RF05: Transmissão ao Vivo (YouTube Stream)
- **Descrição**: O administrador pode cadastrar URLs de transmissões do YouTube para serem exibidas continuamente como canal de entretenimento no Telão.
- **Comportamento**:
  - O administrador ativa um stream manualmente. O sistema extrai automaticamente o `videoId` correspondente.
  - O Telão substitui a rotação de mídias locais pelo player do YouTube no formato loop e autoplay.
  - **Persistência de Stream**: O stream ativo permanece no Telão e não rotaciona ou alterna de volta para mídias locais sozinho.
  - **Tratamento de Erros**: Se o player do YouTube falhar ou travar na inicialização (timeout > 20s), ele re-tenta carregar por 2 vezes. Se persistir, exibe uma tela de erro amigável, disparando tentativas automáticas de reconexão a cada 30 segundos, sem exibir tela preta e sem pular para mídias locais se o stream continuar ativo no admin.

### RF06: Módulo Copa do Mundo e Esportes
- **Descrição**: Exibição de painéis temáticos dinâmicos com estatísticas da Copa do Mundo ou campeonatos esportivos para engajamento dos clientes.
- **Comportamento**:
  - O administrador pode ativar o "Modo Evento/Copa do Mundo" e configurar o tema visual.
  - O Servidor Unificado consulta a API do `football-data.org` (ou outro provedor ativo como `WorldCup26Provider`) e utiliza cache JSON local estruturado para respeitar o rate-limit.
  - O Telão exibe o Painel da Copa do Mundo alternado com as mídias locais. A exibição roda de forma assíncrona, trocando blocos de dados (Jogos de Hoje, Próximos Jogos, Classificação) a cada 15 segundos.
  - **Toggles Granulares**: O filtro da playlist do Telão respeita individualmente os toggles de controle do Admin (`mostrarJogosHoje`, `mostrarProximosJogos`, `mostrarClassificacaoGrupos`), removendo ou exibindo as telas em tempo real.
  - **Tabela de Grupos Dinâmica**: Se os dados de classificação estiverem agrupados (como na Copa do Mundo), o telão renderiza a tabela em formato de Bento Grid (2 colunas, 4 grupos por vez) e rotaciona as páginas de grupos a cada 5 segundos de forma automática, evitando quebra ou sobreposição de textos.

### RF07: Painel Administrativo e Gestão de Mídias
- **Descrição**: Interface web intuitiva para controle do sistema de exibição, gerenciada por administradores locais.
- **Comportamento**:
  - Exige credenciais administrativas (`Basic Auth` via variáveis de ambiente `ADMIN_USER` e `ADMIN_PASSWORD`).
  - Permite configurar o cabeçalho institucional (upload de Logo e QRCode para download/visualização dinâmica no telão).
  - Controle de ativação global de som de mídias (`somMidia` - controla se vídeos e YouTube tocarão som ou silenciosos, enquanto o som de chamadas sempre funciona).
  - Dashboard de status em tempo real mostrando número de caixas, conexões ativas de WebSocket e controle total de mídias e transmissões de stream.
  - **Sincronização Ativa de Reconexão (Refetch)**: Quando o cliente do telão reconecta ao WebSocket (após queda do servidor ou flutuação de rede), ele executa um callback de `refetch()` forçado para requisitar do servidor REST todas as configurações e mídias atualizadas. Isso garante a consistência das mídias exibidas mesmo se as atualizações em tempo real ocorrerem durante a inatividade do cliente.

---

## 5. Requisitos Não Funcionais

### RNF01: Performance e Fluidez Visual
- O Telão não deve apresentar barras de rolagem ou quebras de layout em nenhuma resolução. A interface deve ser dinâmica e ajustada a 100% do viewport da TV.
- A rotação de mídias locais deve ignorar mídias corrompidas ou mal formatadas de forma silenciosa, sem travar o telão ou congelar o aplicativo.

### RNF02: Robustez e Autoplay de Som
- Na primeira execução do aplicativo na Android TV, o sistema deve apresentar uma tela de onboarding para capturar o clique inicial do usuário, liberando as permissões de autoplay com áudio dos navegadores modernos.
- O sistema de áudio deve ser estruturado de forma a evitar sobreposição sonora. O som da mídia de fundo é desativado ou pausado antes de tocar o sino e ler a chamada.

### RNF03: Segurança das Chaves de API
- Nenhum token de API pública (ex: token de futebol-data.org) deve ser enviado ou exposto na interface do Telão ou do Painel Administrativo. Todo o consumo de dados externos deve ser centralizado e processado no Servidor Unificado local.

### RNF04: Facilidade de Implantação e Resiliência do Sistema Operacional
- O servidor backend deve rodar como um serviço silencioso do Windows (`ChamadorCaixaPro`), iniciando de forma automática no boot da máquina sem demandar que janelas de Prompt de Comando fiquem abertas e visíveis ao operador.
- O script em PowerShell deve lidar automaticamente com a instalação do serviço e abertura de portas no Windows Defender Firewall.

---

## 6. Regras de Negócio Importantes

1. **Atalhos Globais do Operador**: O `pdv-client` rodando em Electron nos computadores de caixa deve interceptar o atalho `Ctrl + Shift + C` em segundo plano global, mesmo que a janela do Electron esteja minimizada ou o operador esteja com o sistema de PDV/Vendas principal focado.
2. **Exclusividade de Stream Ativo**: Apenas um stream do YouTube pode estar ativo por vez. A ativação de um stream deve desativar automaticamente todos os outros no arquivo `streams.json`.
3. **Cache de API de Esportes**: Consultas a APIs externas de futebol devem possuir cache mínimo de 60 segundos no backend local para evitar bloqueio de IP/Token devido a limites de requisição de planos gratuitos.
4. **Volume Controlado**: Mídias promocionais e lives de entretenimento só reproduzirão áudio se a flag `somMidia` estiver ativada no Painel Admin e o Telão tiver a flag `somAtivado` marcada. Caso contrário, rodam 100% mudas. O som das chamadas de caixa (chime + voz) ignora `somMidia` e toca sempre que a TV estiver com som liberado (`somAtivado = true`).

---

## 7. Próximos Passos e Melhorias Recomendadas (Roadmap)

1. **Migração do Banco de Dados**: Evolução do armazenamento em arquivos JSON para um banco de dados relacional leve embutido (ex: SQLite).
2. **Gerenciador de Atualizações**: Serviço automático de atualização automática (*Auto-Updater*) para o `pdv-client` nos caixas e para o Servidor Central.
3. **Instalador Integrado**: Empacotamento de toda a suíte (Servidor, NSSM, scripts de rede) em um instalador único amigável do Windows via **Inno Setup**.
4. **Relatórios no Painel**: Adição de gráficos e exportação de dados de chamadas e tempos de atendimento dos caixas para fins de gestão de produtividade.
