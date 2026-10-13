# Controle de assinaturas NexaReis

Central publicada: https://chamador-assinaturas.nicolas-santapaula.workers.dev/

O acesso do proprietário está em `.secrets/acesso-assinaturas.txt`. Esse arquivo e a pasta `.secrets` **não devem ser enviados a clientes**. O usuário do painel remoto é `admin`, com a senha de gestão definida pelo proprietário. O provisionamento inicial gera uma senha aleatória; alterações posteriores não são publicadas no repositório.

## Bloquear e liberar

No painel remoto, localize a instalação, escolha **Bloqueada** ou **Ativa**, informe o vencimento se necessário e clique em **Salvar assinatura**. O servidor consulta a central a cada 30 segundos. O telão web consulta o servidor a cada 5 segundos e recebe notificações por WebSocket; considere até 35 segundos para a atualização completa no navegador. Um bloqueio já recebido persiste quando a loja perde a internet ou reinicia.

O telão web bloqueado exibe um QR code gerado localmente para abrir o painel remoto já filtrado para aquela instalação. Após entrar como proprietário, use **Desbloquear este telão**. O código contém apenas a URL e a identificação da instalação, sem senha, chave de ativação ou credencial Cloudflare; escanear sozinho não libera o sistema. A autenticação é do painel NexaReis hospedado na conta Cloudflare, não um login automático da conta Cloudflare.

Um cliente ativo pode ficar sem internet até 24 horas desde a última validação assinada; o vencimento da assinatura prevalece quando ocorre antes. Na primeira ativação, sem cache válido, o sistema fica bloqueado até conseguir validar. Nenhum dado de pagamento é processado: esta versão faz gestão manual de assinatura e vencimento.

## Nova chave

**Emitir nova chave** invalida a chave anterior. Copie a nova chave quando ela for exibida e entregue somente à loja correspondente. Na loja, abra `http://localhost:3040/admin/activation` ou o link **Já recebeu uma chave? Ativar sistema** no telão bloqueado. Entre com o usuário e a senha de administração **local** definidos no `server/.env`, informe a chave e salve. A chave é validada com a central antes de atualizar o arquivo local; não é necessário reiniciar para trocar a chave.

A chave correta não libera uma assinatura marcada como bloqueada: a liberação é realizada pelo proprietário no painel remoto. Não distribua a senha do painel de assinaturas.

## Instalações novas

1. Cadastre a loja na central e guarde sua identificação e chave de ativação.
2. Distribua o servidor atualizado, o cliente PDV atualizado e o telão correspondente. Configure em `server/.env`: `SUBSCRIPTION_ENABLED=true`, `SUBSCRIPTION_URL`, `SUBSCRIPTION_CUSTOMER_ID`, `SUBSCRIPTION_TOKEN` e `SUBSCRIPTION_PUBLIC_KEY`. Use a mesma chave pública desta central; a chave privada permanece com o proprietário/Worker.
3. Inicie o servidor da loja. Ele precisa de HTTPS de saída para a central; não é necessário expor o servidor local por Tunnel.
4. Libere a assinatura e configure seu vencimento no painel remoto.

Instalações sem `SUBSCRIPTION_ENABLED=true` mantêm o comportamento antigo. Na instalação atual, o controle está habilitado e o estado final solicitado é **bloqueado**. O nome cadastrado contém o nome deste computador.

## Cobertura e limites

O servidor nega chamadas HTTP atuais e antigas, mensagens de chamada WebSocket, mídia local e transmissões de vinhetas enquanto bloqueado. Arquivos de contingência detectados durante o bloqueio são descartados, para evitar chamadas acumuladas ao liberar. Os arquivos de mídia e o histórico já existente são preservados. O cliente PDV atualizado não aciona contingência ao receber bloqueio.

A versão web já compilada recebe a proteção pelo servidor sem modificar o bundle. O código-fonte do APK tem a tela de bloqueio; **APKs anteriormente instalados precisam ser recompilados e atualizados para mostrar essa mensagem**, embora suas chamadas ao servidor já sejam negadas. Nenhum APK novo foi compilado nesta alteração.

A resposta da central é assinada com Ed25519 e o servidor verifica cliente, assinatura e validade. Esta proteção controla o uso normal de instalações gerenciadas; não impede um administrador da máquina de alterar o código ou desativar a configuração local. Cada cadastro/chave corresponde a uma instalação; não há vínculo antifraude com hardware nesta versão.

## Validação e manutenção

Execute `node --test server/test/*.test.js subscriptions/worker.test.mjs` na raiz usando Node 24 ou superior (os testes do Worker usam SQLite integrado). O Worker usa D1 sem réplica de leitura, consultas parametrizadas, alterações com histórico em lote e autenticação do proprietário separada das chaves das lojas.

`provision-local.cjs` gera credenciais somente na máquina do proprietário e preserva arquivos existentes. `configure-current.cjs` vincula a instalação atual. `verify-live.cjs` testa a liberação e restaura o bloqueio **desta instalação**, com registros no histórico; não executar contra outra loja sem intenção de fazer esse teste.

`wrangler.jsonc` descreve os recursos publicados. Ao republicar, preserve os segredos `ADMIN_PASSWORD_HASH` (SHA-256 da senha de gestão) e `LICENSE_SIGNING_KEY` (chave Ed25519 privada PKCS8 em base64), além da associação D1. Não gere outra chave de assinatura sem atualizar a chave pública das lojas.

O serviço Windows anterior ainda precisa ter seu runtime Node e inicialização automática corrigidos. Nesta sessão, o servidor foi iniciado em segundo plano, não por esse serviço.
