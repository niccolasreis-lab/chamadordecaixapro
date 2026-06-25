const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const chokidar = require('chokidar');
require('dotenv').config();

const { initWebSocket } = require('./services/websocket');
const apiRoutes = require('./routes/api');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3001;

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
app.use('/admin', basicAuth, express.static(path.join(__dirname, 'public', 'admin')));
app.use('/midias', express.static(path.join(__dirname, 'data', 'uploads')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use('/sons', express.static(path.join(__dirname, 'sons')));

// Serve a pasta de narrações de forma segura com fallback local
app.get('/narracoes/:filename', (req, res) => {
  const filename = req.params.filename;
  
  // Normaliza o nome do arquivo removendo zeros à esquerda do número do caixa para compatibilidade com arquivos físicos
  // Ex: "caixa livre_01.mp3" -> "caixa livre_1.mp3"
  // Ex: "caixa livre_03_preferencial.mp3" -> "caixa livre_3_preferencial.mp3"
  const normalizedFilename = filename.replace(/caixa livre_0*(\d+)/i, 'caixa livre_$1');
  
  // 1. Tenta buscar do diretório configurado
  const userNarrarDir = process.env.NARRAR_DIR || 'C:\\Users\\operador\\Documents\\CHAMADOR DE CAIXA PRO\\narrar caixa .mp3';
  const userFilePath = path.join(userNarrarDir, normalizedFilename);
  
  // 2. Tenta buscar do diretório local de fallback
  const localNarrarDir = path.join(__dirname, 'data', 'narracoes');
  const localFilePath = path.join(localNarrarDir, normalizedFilename);
  
  // Função auxiliar para verificar leitura e existência
  const isFileReadable = (filePath) => {
    try {
      fs.accessSync(filePath, fs.constants.R_OK);
      return fs.statSync(filePath).isFile();
    } catch (e) {
      return false;
    }
  };

  if (isFileReadable(userFilePath)) {
    return res.sendFile(userFilePath);
  } else if (isFileReadable(localFilePath)) {
    return res.sendFile(localFilePath);
  } else {
    // Retorna 404 explicitamente em vez de deixar cair no SPA fallback
    return res.status(404).send('Audio nao encontrado');
  }
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

// Rotas da API
app.use('/api', apiRoutes);

// Inicializa WebSocket
const wss = initWebSocket(server);
app.set('wss', wss);

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
  app.use(express.static(DIST_DIR));
  // SPA fallback — retorna index.html para qualquer rota não encontrada
  app.get('*', (req, res) => {
    const indexPath = path.join(DIST_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send('Telao nao encontrado. Execute o build.');
    }
  });
  console.log(`[Telao] Servindo SPA de: ${DIST_DIR}`);
}

server.listen(PORT, () => {
  console.log(`[Server] Chamador de Caixa Pro rodando na porta ${PORT}`);
  console.log(`[Server] Telao: http://0.0.0.0:${PORT}`);
  console.log(`[Server] Admin: http://0.0.0.0:${PORT}/admin`);
});
