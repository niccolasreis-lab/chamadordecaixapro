const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const chokidar = require('chokidar');
require('dotenv').config();

const { initWebSocket } = require('./services/websocket');
const apiRoutes = require('./routes/api');
const { createScheduleRouter } = require('./routes/schedules');
const { VignetteScheduler } = require('./services/vignetteScheduler');
const { SubscriptionService } = require('./services/subscriptionService');
const { managementQrSvg } = require('./services/subscriptionQr');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3001;
const subscription = new SubscriptionService();
app.set('subscription', subscription);
app.get('/api/subscription/status', (req, res) => {
  res.set('Cache-Control', 'no-store').json({...subscription.publicStatus(),managementUrl:subscription.managementUrl()});
});
app.get('/subscription/unlock-qr.svg', (req, res) => {
  const url = subscription.managementUrl();
  if (!url) return res.status(404).send('Esta instalação ainda não está vinculada à central.');
  res.set('Cache-Control', 'no-store').type('image/svg+xml').send(managementQrSvg(url));
});
app.use('/subscription', express.static(path.join(__dirname, 'public', 'subscription')));
app.use((req, res, next) => {
  if (req.path === '/admin/activation') return next();
  if (subscription.isAllowed()) return next();
  res.set('Cache-Control', 'no-store');
  if (req.path.startsWith('/api/') || req.path.startsWith('/midias/') || req.path.startsWith('/uploads/') || req.path.startsWith('/sons/') || req.path.startsWith('/narracoes/')) {
    return res.status(423).json({error:'SUBSCRIPTION_BLOCKED',...subscription.publicStatus()});
  }
  return res.status(200).sendFile(path.join(__dirname, 'public', 'subscription', 'blocked.html'));
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Autenticação Básica para o Painel Admin
const authUser = process.env.ADMIN_USER || 'admin';
const authPass = process.env.ADMIN_PASSWORD || '123456';

const basicAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Painel"');
    return res.status(401).send('Acesso Negado');
  }

  const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
  const user = auth[0];
  const pass = auth[1];

  if (user === authUser && pass === authPass) {
    next();
  } else {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Painel"');
    return res.status(401).send('Acesso Negado');
  }
};

// Serve arquivos estáticos
app.get('/admin/activation', basicAuth, (req, res) => {
  res.set('Cache-Control', 'no-store').sendFile(path.join(__dirname, 'public', 'subscription', 'activation.html'));
});
app.post('/admin/activation', basicAuth, async (req, res) => {
  if (req.headers.origin !== `${req.protocol}://${req.get('host')}`) return res.status(403).json({error:'Origem inválida.'});
  try {
    const state = await subscription.activate(req.body.token, path.join(__dirname, '.env'));
    res.set('Cache-Control', 'no-store').json(state);
  } catch (error) { res.status(400).json({error:error.message}); }
});
app.use('/admin', basicAuth, express.static(path.join(__dirname, 'public', 'admin')));
app.use('/midias', express.static(path.join(__dirname, 'data', 'uploads')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use('/sons', express.static(path.join(__dirname, 'sons')));

// Serve a pasta de narrações de forma segura com fallback local
app.get('/narracoes/:filename', (req, res) => {
  const filename = req.params.filename;
  
  // Mantém o nome solicitado como primeira opção. A API de narrações
  // devolve os nomes reais dos arquivos, que podem conter zeros à esquerda.
  // A versão normalizada permanece como compatibilidade com arquivos antigos.
  const normalizedFilename = filename.replace(/caixa livre_0*(\d+)/i, 'caixa livre_$1');
  
  // 1. Tenta buscar do diretório configurado
  const userNarrarDir = process.env.NARRAR_DIR || 'C:\\Users\\operador\\Documents\\CHAMADOR DE CAIXA PRO\\narrar caixa .mp3';
  const userFilePaths = [filename, normalizedFilename]
    .filter((name, index, names) => names.indexOf(name) === index)
    .map(name => path.join(userNarrarDir, name));
  
  // 2. Tenta buscar do diretório local de fallback
  const localNarrarDir = path.join(__dirname, 'data', 'narracoes');
  const localFilePaths = [filename, normalizedFilename]
    .filter((name, index, names) => names.indexOf(name) === index)
    .map(name => path.join(localNarrarDir, name));
  
  // Função auxiliar para verificar leitura e existência
  const isFileReadable = (filePath) => {
    try {
      fs.accessSync(filePath, fs.constants.R_OK);
      return fs.statSync(filePath).isFile();
    } catch (e) {
      return false;
    }
  };

  const audioPath = [...userFilePaths, ...localFilePaths].find(isFileReadable);
  if (audioPath) return res.sendFile(audioPath);

  // Retorna 404 explicitamente em vez de deixar cair no SPA fallback
  return res.status(404).send('Audio nao encontrado');
});


// Garante que os diretórios de uploads existam
const uploadsDir = path.join(__dirname, 'data', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const instUploadsDir = path.join(__dirname, 'public', 'uploads', 'institucional');
if (!fs.existsSync(instUploadsDir)) {
  fs.mkdirSync(instUploadsDir, { recursive: true });
}

// Inicializa WebSocket
const wss = initWebSocket(server, { subscription });
subscription.on('change', state => wss.broadcast({type:'SUBSCRIPTION_STATUS',data:state}));
app.set('wss', wss);

// Agendamentos usam o servidor como relogio autoritativo e enviam apenas a teloes registrados.
const vignetteScheduler = new VignetteScheduler({
  dataDir: path.join(__dirname, 'data'),
  wss
});
app.set('vignetteScheduler', vignetteScheduler);
app.use('/api/agendamentos', basicAuth, createScheduleRouter(vignetteScheduler));
app.use('/api', apiRoutes);
vignetteScheduler.start();

// ---------------------------------------------------------
// MONITORA PASTA DE FALLBACK (Chokidar)
// ---------------------------------------------------------
const FALLBACK_DIR = process.env.FALLBACK_DIR || 'C:\\chamador_fallback';
if (!fs.existsSync(FALLBACK_DIR)) {
  try {
    fs.mkdirSync(FALLBACK_DIR, { recursive: true });
  } catch (e) {
    console.error(`[Aviso] Nao foi possivel criar diretorio fallback: ${FALLBACK_DIR}`);
  }
}

if (fs.existsSync(FALLBACK_DIR)) {
  console.log(`[Fallback] Monitorando pasta: ${FALLBACK_DIR}`);
  const watcher = chokidar.watch(FALLBACK_DIR, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100
    }
  });

  watcher.on('add', (filePath) => {
    if (path.extname(filePath) === '.json') {
      if (!subscription.isAllowed()) {
        // Descarta chamadas realizadas durante o bloqueio para não reproduzi-las após liberar.
        fs.unlink(filePath, () => {});
        return;
      }
      try {
        console.log(`[Fallback] Arquivo detectado: ${filePath}`);
        const content = fs.readFileSync(filePath, 'utf8');
        const payload = JSON.parse(content);

        // Repassa via WS
        const wssRef = app.get('wss');
        if (wssRef) {
          wssRef.broadcast({ type: 'CALL', data: payload });
          console.log(`[Fallback] Chamada disparada do arquivo:`, payload);
        }

        // Deleta o arquivo apos leitura
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error(`[Fallback] Erro ao processar arquivo:`, err.message);
      }
    }
  });
}

// ---------------------------------------------------------
// AUTO-UPDATE COPA DO MUNDO
// ---------------------------------------------------------
const worldCupDataService = require('./services/worldCupDataService');

// Verifica atualizações a cada X segundos baseados na configuração
let worldCupInterval = null;

function startWorldCupUpdateLoop() {
  const config = worldCupDataService.readConfig();
  const intervalSecs = config && config.intervaloAtualizacaoSegundos ? config.intervaloAtualizacaoSegundos : 120;
  const intervalMs = Math.max(60000, intervalSecs * 1000); // no minimo 60s
  
  if (worldCupInterval) clearInterval(worldCupInterval);
  
  worldCupInterval = setInterval(() => {
    worldCupDataService.atualizarCache(app);
  }, intervalMs);
}

// Primeira chamada e inicializacao do loop
worldCupDataService.atualizarCache(app);
startWorldCupUpdateLoop();
// ---------------------------------------------------------

// Serve o Telão (SPA) a partir de dist/
const DIST_DIR = path.join(__dirname, 'dist');
if (fs.existsSync(DIST_DIR)) {
  const serveTelao = (req, res) => {
    const indexPath = path.join(DIST_DIR, 'index.html');
    if (!fs.existsSync(indexPath)) return res.status(404).send('Telao nao encontrado. Execute o build.');
    const html = fs.readFileSync(indexPath, 'utf8').replace('</head>', '<script src="/subscription/guard.js" defer></script></head>');
    res.set('Cache-Control', 'no-store').type('html').send(html);
  };
  app.get(['/', '/index.html'], serveTelao);
  app.use(express.static(DIST_DIR));
  // SPA fallback — retorna index.html para qualquer rota não encontrada
  app.get('*', (req, res) => {
    serveTelao(req, res);
  });
  console.log(`[Telao] Servindo SPA de: ${DIST_DIR}`);
}

async function startServer() {
await subscription.refresh();
subscription.start();
server.listen(PORT, () => {
  console.log(`[Server] Chamador de Caixa Pro rodando na porta ${PORT}`);
  console.log(`[Server] Telao: http://0.0.0.0:${PORT}`);
  console.log(`[Server] Admin: http://0.0.0.0:${PORT}/admin`);
});
}
startServer().catch(error => { console.error('[Server] Falha na inicialização:',error.message);process.exit(1); });

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('[Server] Encerrando por ' + signal);
  vignetteScheduler.stop();
  subscription.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
