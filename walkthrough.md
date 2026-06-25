# Walkthrough: Aumento de Fontes no Módulo Copa do Mundo

Ajustamos especificamente o módulo da **Copa do Mundo** para aumentar significativamente a legibilidade de todas as suas informações na tela física do estabelecimento, sem afetar o comportamento de escala responsiva do Telão e a integridade da resolução dos vídeos.

## O que mudou?

1. **Fator de Escala Estático (`scale.ts`)**:
   - Revertido o fator de escala dinâmico `baseFactor` para um valor estático de `1` (100%), garantindo que as dimensões do container do overlay de chamadas, do player de vídeo e de outros elementos sigam a área lógica Full HD 1080p sem alterações na resolução do vídeo.

2. **Copa do Mundo - Títulos e Rodapé (`PainelCompeticao.tsx`)**:
   - Título principal (`mainTitle`): aumentado de `48px` para `64px`.
   - Ano da competição (`yearTitle`): aumentado de `36px` para `48px`.
   - Títulos das seções/blocos (`blockTitle`): aumentado de `24px` para `32px` com ícones proporcionais.
   - Textos decorativos do cabeçalho (`headerTitle`, `headerLabel`, `headerInfo`): aumentados em média 30%.
   - Frases motivacionais do rodapé (`bottomBarText`): aumentadas de `16px` para `22px`.

3. **Copa do Mundo - Tabela de Classificação (`StandingsTable.tsx`)**:
   - Fontes das células de dados da tabela (`tableCell`): aumentadas de `22px` para `28px`.
   - Fontes do cabeçalho da tabela (`tableHeaderCell`): aumentadas de `18px` para `24px`.
   - Espaçamento interno das linhas (`tableRow`, `tableRowHeader`): aumentado o padding vertical para dar mais destaque visual.

4. **Copa do Mundo - Jogos de Hoje / Ao Vivo (`MatchCard.tsx`)**:
   - Nome das equipes (`teamName`): aumentado de `18px` para `24px`.
   - Placar numérico (`score`): aumentado de `48px` para `64px` com grande destaque.
   - Tamanho das bandeiras oficiais dos países (`flagCircle`, `flagImage`): aumentado de `64px` para `88px` de diâmetro.
   - Detalhes adicionais (como horário e minutos de jogo): fontes aumentadas para `24px` e `28px`.

5. **Copa do Mundo - Próximos Jogos (`MatchList.tsx`)**:
   - Data do confronto (`matchDate`): aumentada de `18px` para `24px`.
   - Nome das equipes em formato reduzido (`matchTeamsSmall`): aumentado de `16px` para `22px`.
   - Bandeiras em miniatura (`miniFlag`): tamanho aumentado de `24px` para `36px` de diâmetro.

---

## Resultados da Validação Visual

Abaixo, veja as capturas do Telão exibindo o painel da Copa do Mundo com as novas fontes ampliadas:

### Carrossel de Telas da Copa do Mundo
```carousel
![Jogos de Hoje - Placar e Bandeiras Ampliados](C:/Users/operador/.gemini/antigravity-ide/brain/4670bd67-4ade-4670-a228-745050f3d4c6/copa_jogos_hoje_1781270403836.png)
<!-- slide -->
![Próximos Jogos - Miniaturas e Nomes Maiores](C:/Users/operador/.gemini/antigravity-ide/brain/4670bd67-4ade-4670-a228-745050f3d4c6/copa_proximos_jogos_1781270419004.png)
<!-- slide -->
![Classificação e Grupos - Tabela Sem Sobreposições](C:/Users/operador/.gemini/antigravity-ide/brain/4670bd67-4ade-4670-a228-745050f3d4c6/standings_screen_verified_1781271099874.png)
```

### Vídeo da Sessão de Validação no Navegador
![Gravação da Sessão do Browser](C:/Users/operador/.gemini/antigravity-ide/brain/4670bd67-4ade-4670-a228-745050f3d4c6/verify_border_reduction_1781271062925.webp)

---

### Diagnóstico de Validação:
- **Resolução do Vídeo Preservada**: Nenhuma dimensão dos vídeos, imagens de mídias ou aspect ratio foi afetada pelas mudanças, pois revertemos o fator de escala dinâmico do `scale.ts` e deixamos o `TelaoLayout` lidar com a escala do container lógica Full HD intacta.
- **Destaque Visual**: As informações da Copa do Mundo estão extremamente fáceis de ler de longe, ideal para exibição em TVs de estabelecimentos comerciais.
- **Sem Quebras**: O layout se manteve fluido e proporcional sem cortes ou transbordamentos de textos nas bordas.

---

## 6. Correção das Narrações em MP3 (Zeros à Esquerda)

Identificamos e corrigimos o problema de reprodução das narrações de caixa personalizadas em áudio MP3:

1. **Causa Raiz**:
   - Os arquivos de áudio gravados localmente no diretório `C:\Users\operador\Documents\CHAMADOR DE CAIXA PRO\narrar caixa .mp3` estavam nomeados sem zeros à esquerda (ex: `caixa livre_1.mp3`, `caixa livre_2.mp3`...).
   - No entanto, os PDVs e o painel de chamadas registravam e enviavam o número do caixa formatado com dois dígitos/zeros à esquerda (ex: `"01"`, `"02"`, `"03"`...).
   - Por conta disso, o Telão solicitava URLs como `/narracoes/caixa%20livre_01.mp3`, gerando erro `404 Not Found` no backend por não encontrar o arquivo correspondente no disco, forçando o fallback para a voz sintética (TTS) do navegador.

2. **Solução Aplicada (Server-Side)**:
   - Modificamos a rota `/narracoes/:filename` no servidor em `C:\ChamadorCaixa\index.js` e `server/index.js` para normalizar automaticamente o nome do arquivo solicitado antes de buscá-lo no disco.
   - Adicionamos uma expressão regular `/caixa livre_0*(\d+)/i` para remover os zeros à esquerda do número do caixa. Assim, qualquer requisição para `caixa livre_01.mp3` ou `caixa livre_03_preferencial.mp3` é resolvida de forma transparente no servidor para `caixa livre_1.mp3` ou `caixa livre_3_preferencial.mp3` respectivamente.
   - Isso evitou a necessidade de recompilar e reinstalar o APK nas TVs, resolvendo o problema de forma 100% transparente.

3. **Validação**:
   - Validamos o funcionamento do endpoint realizando requisições diretas via `curl` no servidor:
     - `/narracoes/caixa%20livre_01.mp3` -> **`200 OK`** (resolvido para `caixa livre_1.mp3`, tamanho 89796 bytes).
     - `/narracoes/caixa%20livre_03_preferencial.mp3` -> **`200 OK`** (resolvido para `caixa livre_3_preferencial.mp3`, tamanho 128248 bytes).
     - `/narracoes/caixa%20livre_04_rapido.mp3` -> **`200 OK`** (resolvido para `caixa livre_4_rapido.mp3`, tamanho 125741 bytes).
   - O servidor de produção (`C:\ChamadorCaixa`) foi reiniciado e está servindo a SPA e as narrações normalizadas normalmente na porta `3040`.

## 7. Correção no Módulo da Copa do Mundo e Playlist

Identificamos e corrigimos problemas adicionais no módulo Copa do Mundo e na lógica de playlist de mídias:

1. **Copa do Mundo - Mapeamento de Times e Classificação (`WorldCup26Provider.js`)**:
   - **Problema**: A classificação / tabela de grupos estava exibindo nomes de times genéricos como `"Time 1"`, `"Time 2"` com escudos/bandeiras nulos (`crest: null`). Isso ocorria porque o provedor buscava dados usando nomes de campos camelCase (ex: `t.teamId`), enquanto o payload real da API do World Cup 2026 usa snake_case (ex: `t.team_id`). Além disso, as estatísticas de jogos (`mp`, `w`, `d`, `l`, `pts`, `gf`, `ga`, `gd`) não estavam mapeadas de forma robusta.
   - **Solução**: Ajustamos o provedor para usar corretamente as chaves snake_case da API e fazer o fallback para o dicionário do `CountryService`.
   
2. **Playlist do Telão - Loop com Única Mídia (`useMediaPlaylist.ts`)**:
   - **Problema**: Quando o estabelecimento tinha apenas uma única mídia ativa na playlist (ex: apenas um stream de vídeo, apenas uma imagem ou apenas um bloco da Copa), o temporizador de rotação continuava disparando no loop, chamando `nextMedia()`. Isso reiniciava a chave de renderização (`playbackKey`) da mídia a cada 10-15 segundos, fazendo com que a exibição piscasse ou o stream do YouTube recarregasse desnecessariamente.
   - **Solução**: Adicionamos uma guarda robusta (`playlist.length <= 1`) na lógica do hook para que o temporizador de transição não seja ativado quando há apenas um item na playlist, assegurando reprodução contínua e estável de streams ou imagens únicas.

## 8. Efeito de Som do Painel Customizado (Antes da Narração)

Implementamos a reprodução do arquivo de áudio de efeito de som personalizado antes da narração por voz:

1. **Servidor (Express Static /sons)**:
   - Adicionamos a rota estática `/sons` apontando para o diretório `sons` (tanto no workspace do projeto quanto no diretório do servidor de produção `C:\ChamadorCaixa\sons`).
   - Isso permite que o cliente de Telão acesse de forma confiável o arquivo `/sons/efeito_som_painel_chamada_caixa_livre.mp3`.

2. **Overlay de Chamada (`ChamadaOverlay.tsx`)**:
   - Atualizamos a função `playSound()` para carregar e reproduzir o efeito customizado via HTML5 Audio do arquivo `/sons/efeito_som_painel_chamada_caixa_livre.mp3`.
   - A contagem de **2 segundos** é iniciada **durante a reprodução** (imediatamente no início do play) do efeito de som. Dessa forma, a voz de narração começa a falar enquanto a cauda/eco do efeito sonoro ainda está finalizando, proporcionando uma transição de áudio mais natural e profissional.
   - Mantivemos uma estratégia de contingência (fallback) robusta: se o arquivo de chime customizado não puder ser carregado (como erros de rede 404, arquivos corrompidos ou bloqueios de auto-play do navegador), o sistema utiliza automaticamente o beep eletrônico sintetizado clássico como plano de fundo e inicia a narração imediatamente, garantindo que o sistema nunca fique silencioso.

---

> [!IMPORTANT]
> **Necessário reinício do serviço backend**:
> Como as alterações foram feitas nos serviços backend (`WorldCup26Provider.js` e adição do diretório `/sons`), é necessário reiniciar o serviço do Windows para carregar o novo código.
>
> Para fazer isso, execute o seguinte comando em um terminal **PowerShell como Administrador**:
> ```powershell
> Restart-Service ChamadorCaixaPro
> ```
