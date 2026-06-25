const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const footballDataService = require('../services/footballDataService');
const worldCupDataService = require('../services/worldCupDataService');
const ProviderFactory = require('../services/providers/ProviderFactory');

const dataDir = path.join(__dirname, '..', 'data');
const uploadsDir = path.join(dataDir, 'uploads');
const instUploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'institucional');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

const instStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, instUploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, 'inst_' + Date.now() + ext);
  }
});

const uploadInst = multer({
  storage: instStorage,
  fileFilter: (req, file, cb) => {
    const allowedExts = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de arquivo inválido. Permite apenas: png, jpg, jpeg, webp, svg'));
    }
  }
});

function readJsonFile(filename) {
  const filePath = path.join(dataDir, filename);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  return [];
}

function writeJsonFile(filename, data) {
  const filePath = path.join(dataDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Rota de Status
router.get('/status', (req, res) => {
  res.json({ status: 'online', timestamp: new Date().toISOString() });
});

// Rota de Narrações
router.get('/narracoes', (req, res) => {
  const userNarrarDir = process.env.NARRAR_DIR || 'C:\\Users\\operador\\Documents\\CHAMADOR DE CAIXA PRO\\narrar caixa .mp3';
  const localNarrarDir = path.join(__dirname, '..', 'data', 'narracoes');
  
  let files = [];
  try {
    if (fs.existsSync(userNarrarDir)) {
      files = fs.readdirSync(userNarrarDir).filter(f => f.endsWith('.mp3'));
    } else if (fs.existsSync(localNarrarDir)) {
      files = fs.readdirSync(localNarrarDir).filter(f => f.endsWith('.mp3'));
    }
  } catch (e) {
    console.error('[API Narracoes] Erro ao ler pasta:', e.message);
  }
  
  res.json({ arquivos: files });
});

// Rotas de Chamada
router.post('/chamar', (req, res) => {
  const { caixa, tipo } = req.body;
  if (!caixa) return res.status(400).json({ error: 'Caixa obrigatorio' });

  const chamada = { caixa, tipo: tipo || 'Normal', timestamp: new Date().toISOString() };
  
  // Salva no log
  const chamadas = readJsonFile('chamadas.json');
  chamadas.push(chamada);
  writeJsonFile('chamadas.json', chamadas);

  // Envia via WebSocket
  const wss = req.app.get('wss');
  if (wss) {
    wss.broadcast({ type: 'CALL', data: chamada });
  }

  res.json({ success: true, chamada });
});

// Rota Antiga para não quebrar o HTML atual
router.post('/call', (req, res) => {
  // Redireciona lógica para manter compatibilidade com o HTML antigo se existir
  req.url = '/chamar';
  router.handle(req, res);
});

function getNormalizedMidias() {
  let midias = readJsonFile('midias.json');
  let changed = false;
  
  const virtualItems = [
    { id: "copa_jogos_hoje", nome: "Copa do Mundo - Jogos de Hoje", tipo: "copa_jogos_hoje", url: "", ativo: true, ordem: 90, reproduzirPrimeiro: false, duracao: 15, tempo: 15 },
    { id: "copa_proximos_jogos", nome: "Copa do Mundo - Próximos Jogos", tipo: "copa_proximos_jogos", url: "", ativo: true, ordem: 91, reproduzirPrimeiro: false, duracao: 15, tempo: 15 },
    { id: "copa_classificacao", nome: "Copa do Mundo - Classificação / Grupos", tipo: "copa_classificacao", url: "", ativo: true, ordem: 92, reproduzirPrimeiro: false, duracao: 15, tempo: 15 },
    { id: "youtube_stream", nome: "YouTube - Transmissão Ativa", tipo: "youtube_stream", url: "", ativo: true, ordem: 93, reproduzirPrimeiro: false, duracao: 60, tempo: 60 }
  ];

  virtualItems.forEach(vi => {
    if (!midias.some(m => m.id === vi.id)) {
      midias.push(vi);
      changed = true;
    }
  });

  midias = midias.map((m, index) => {
    let updated = { ...m };
    
    if (updated.ativo === undefined) {
      updated.ativo = true;
      changed = true;
    }
    
    if (updated.ordem === undefined) {
      updated.ordem = index + 1;
      changed = true;
    }
    
    if (!updated.tipo) {
      const ext = path.extname(updated.nome || '').toLowerCase();
      updated.tipo = (ext === '.mp4' || ext === '.webm' || ext === '.ogg' || ext === '.mov') ? 'video' : 'imagem';
      changed = true;
    }
    
    if (updated.duracao === undefined) {
      updated.duracao = m.tempo !== undefined ? parseInt(m.tempo) : 10;
      changed = true;
    }
    
    if (updated.tempo === undefined) {
      updated.tempo = updated.duracao;
      changed = true;
    }
    
    if (updated.reproduzirPrimeiro === undefined) {
      updated.reproduzirPrimeiro = false;
      changed = true;
    }
    
    return updated;
  });
  
  if (changed) {
    writeJsonFile('midias.json', midias);
  }
  
  return midias;
}

// Rotas de Mídias
router.get('/midias', (req, res) => {
  const midias = getNormalizedMidias();
  midias.sort((a, b) => {
    if (a.reproduzirPrimeiro && !b.reproduzirPrimeiro) return -1;
    if (!a.reproduzirPrimeiro && b.reproduzirPrimeiro) return 1;
    return (a.ordem || 0) - (b.ordem || 0);
  });
  res.json(midias);
});

router.post('/midias/upload', upload.single('file'), (req, res) => {
  const midias = getNormalizedMidias();
  const maxOrdem = midias.reduce((max, m) => Math.max(max, m.ordem || 0), 0);
  const duracao = req.body.duracao ? parseInt(req.body.duracao) : (req.body.tempo ? parseInt(req.body.tempo) : 10);
  const novaMidia = {
    id: Date.now().toString(),
    nome: req.file.filename,
    tipo: req.file.mimetype.startsWith('video') ? 'video' : 'imagem',
    url: `/midias/${req.file.filename}`,
    ativo: true,
    ordem: maxOrdem + 1,
    reproduzirPrimeiro: false,
    duracao: duracao,
    tempo: duracao
  };
  midias.push(novaMidia);
  writeJsonFile('midias.json', midias);
  
  const wss = req.app.get('wss');
  if (wss) wss.broadcast({ type: 'MEDIA_UPDATE', data: midias });

  res.json({ success: true, midia: novaMidia });
});

router.put('/midias/:id', (req, res) => {
  const midias = getNormalizedMidias();
  const index = midias.findIndex(m => m.id === req.params.id);
  if (index !== -1) {
    if (req.body.ativo !== undefined) midias[index].ativo = req.body.ativo;
    if (req.body.tempo !== undefined) {
      midias[index].tempo = parseInt(req.body.tempo);
      midias[index].duracao = parseInt(req.body.tempo);
    }
    if (req.body.duracao !== undefined) {
      midias[index].duracao = parseInt(req.body.duracao);
      midias[index].tempo = parseInt(req.body.duracao);
    }
    if (req.body.ordem !== undefined) midias[index].ordem = parseInt(req.body.ordem);
    if (req.body.reproduzirPrimeiro !== undefined) midias[index].reproduzirPrimeiro = req.body.reproduzirPrimeiro;
    
    writeJsonFile('midias.json', midias);
    
    const wss = req.app.get('wss');
    if (wss) wss.broadcast({ type: 'MEDIA_UPDATE', data: midias });
    res.json({ success: true, midia: midias[index] });
  } else {
    res.status(404).json({ error: 'Mídia não encontrada' });
  }
});

router.delete('/midias/:id', (req, res) => {
  let midias = getNormalizedMidias();
  const index = midias.findIndex(m => m.id === req.params.id);
  if (index !== -1) {
    const filePath = path.join(uploadsDir, path.basename(midias[index].url));
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) { console.error('Erro ao apagar arquivo', e); }
    }
    midias.splice(index, 1);
    writeJsonFile('midias.json', midias);
    
    const wss = req.app.get('wss');
    if (wss) wss.broadcast({ type: 'MEDIA_UPDATE', data: midias });
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Mídia não encontrada' });
  }
});

router.post('/midias/reordenar', (req, res) => {
  const midias = getNormalizedMidias();
  const { ordem } = req.body;
  if (Array.isArray(ordem)) {
    ordem.forEach((id, index) => {
      const midia = midias.find(m => m.id === id);
      if (midia) midia.ordem = index + 1;
    });
    writeJsonFile('midias.json', midias);
    
    const wss = req.app.get('wss');
    if (wss) wss.broadcast({ type: 'MEDIA_UPDATE', data: midias });
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Array de ordem inválido' });
  }
});

router.post('/midias/:id/reproduzir-primeiro', (req, res) => {
  const midias = getNormalizedMidias();
  midias.forEach(m => m.reproduzirPrimeiro = false);
  const midia = midias.find(m => m.id === req.params.id);
  if (midia) {
    midia.reproduzirPrimeiro = true;
    writeJsonFile('midias.json', midias);
    
    const wss = req.app.get('wss');
    if (wss) wss.broadcast({ type: 'MEDIA_UPDATE', data: midias });
    res.json({ success: true, midia });
  } else {
    res.status(404).json({ error: 'Mídia não encontrada' });
  }
});

router.post('/midias/:id/testar', (req, res) => {
  const midias = getNormalizedMidias();
  const midia = midias.find(m => m.id === req.params.id);
  if (midia) {
    const wss = req.app.get('wss');
    if (wss) {
      wss.broadcast({
        type: 'MEDIA_PLAY_NOW',
        data: { id: midia.id }
      });
    }
    res.json({ success: true, midia });
  } else {
    res.status(404).json({ error: 'Mídia não encontrada' });
  }
});

// Compatibilidade
router.post('/midias', (req, res, next) => {
  req.url = '/midias/upload';
  router.handle(req, res, next);
});

// Rotas de Configuração (somMidia)
router.get('/config', (req, res) => {
  let config = readJsonFile('config.json');
  if (Array.isArray(config) || !config || typeof config !== 'object') {
    config = { somMidia: false };
  }
  res.json(config);
});

router.post('/config', (req, res) => {
  const data = req.body;
  const config = { somMidia: !!data.somMidia };
  writeJsonFile('config.json', config);
  
  const wss = req.app.get('wss');
  if (wss) {
    wss.broadcast({ type: 'CONFIG_UPDATE', data: config });
  }
  res.json({ success: true, config });
});

// Rotas de Streams (YouTube)
router.get('/streams', (req, res) => res.json(readJsonFile('streams.json')));
router.post('/streams', (req, res) => {
  const streams = readJsonFile('streams.json');
  const novoStream = { id: Date.now().toString(), url: req.body.url, ativo: false };
  streams.push(novoStream);
  writeJsonFile('streams.json', streams);

  const wss = req.app.get('wss');
  if (wss) wss.broadcast({ type: 'STREAM_UPDATE', data: streams });

  res.json({ success: true, stream: novoStream });
});

router.post('/streams/:id/ativar', (req, res) => {
  const streams = readJsonFile('streams.json');
  const stream = streams.find(s => s.id === req.params.id);
  if (stream) {
    const isActivating = req.body.ativo;
    if (isActivating) {
      // Desativa todos os outros streams
      streams.forEach(s => s.ativo = false);
    }
    stream.ativo = isActivating;
    writeJsonFile('streams.json', streams);

    const wss = req.app.get('wss');
    if (wss) {
      wss.broadcast({ type: 'STREAM_UPDATE', data: streams });
      wss.broadcast({ type: 'STREAM_CHANGE', data: isActivating ? stream : null });
    }
    res.json({ success: true, stream });
  } else {
    res.status(404).json({ error: 'Stream nao encontrado' });
  }
});

router.delete('/streams/:id', (req, res) => {
  let streams = readJsonFile('streams.json');
  const streamToDelete = streams.find(s => s.id === req.params.id);
  const wasActive = streamToDelete ? streamToDelete.ativo : false;

  streams = streams.filter(s => s.id !== req.params.id);
  writeJsonFile('streams.json', streams);

  const wss = req.app.get('wss');
  if (wss) {
    wss.broadcast({ type: 'STREAM_UPDATE', data: streams });
    if (wasActive) {
      wss.broadcast({ type: 'STREAM_CHANGE', data: null });
    }
  }
  res.json({ success: true });
});


// Rotas Institucionais
const defaultInstitucional = {
  nome: "Supermercado Modelo",
  telefone: "(00) 0000-0000 / 0000-0000",
  site: "www.supermercadomodelo.com.br",
  instagram: "@supermercadomodelo",
  slogan: "Qualidade, economia e confiança todos os dias",
  logo: "",
  qrcode: "",
  mostrarNome: true,
  mostrarTelefone: true,
  mostrarSite: true,
  mostrarInstagram: true,
  mostrarSlogan: true,
  mostrarQRCode: false
};

function readInstitucional() {
  const filePath = path.join(dataDir, 'institucional.json');
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (Array.isArray(data) || typeof data !== 'object') {
        return { ...defaultInstitucional };
      }
      return { ...defaultInstitucional, ...data };
    } catch (e) {
      return { ...defaultInstitucional };
    }
  }
  writeJsonFile('institucional.json', defaultInstitucional);
  return { ...defaultInstitucional };
}

router.get('/institucional', (req, res) => {
  const inst = readInstitucional();
  res.json(inst);
});

router.post('/institucional', (req, res) => {
  const inst = readInstitucional();
  const data = req.body;
  
  const updated = {
    ...inst,
    nome: data.nome !== undefined ? data.nome : inst.nome,
    telefone: data.telefone !== undefined ? data.telefone : inst.telefone,
    site: data.site !== undefined ? data.site : inst.site,
    instagram: data.instagram !== undefined ? data.instagram : inst.instagram,
    slogan: data.slogan !== undefined ? data.slogan : inst.slogan,
    mostrarNome: data.mostrarNome !== undefined ? !!data.mostrarNome : inst.mostrarNome,
    mostrarTelefone: data.mostrarTelefone !== undefined ? !!data.mostrarTelefone : inst.mostrarTelefone,
    mostrarSite: data.mostrarSite !== undefined ? !!data.mostrarSite : inst.mostrarSite,
    mostrarInstagram: data.mostrarInstagram !== undefined ? !!data.mostrarInstagram : inst.mostrarInstagram,
    mostrarSlogan: data.mostrarSlogan !== undefined ? !!data.mostrarSlogan : inst.mostrarSlogan,
    mostrarQRCode: data.mostrarQRCode !== undefined ? !!data.mostrarQRCode : inst.mostrarQRCode,
  };
  
  writeJsonFile('institucional.json', updated);
  
  const wss = req.app.get('wss');
  if (wss) {
    wss.broadcast({ type: 'INSTITUCIONAL_UPDATE', data: updated });
  }

  res.json({ success: true, data: updated });
});

router.post('/institucional/logo', (req, res) => {
  uploadInst.single('file')(req, res, function (err) {
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Nenhum arquivo enviado' });
    }
    
    const inst = readInstitucional();
    if (inst.logo && inst.logo.startsWith('/uploads/institucional/')) {
      const oldPath = path.join(__dirname, '..', 'public', inst.logo);
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch (e) {}
      }
    }

    inst.logo = `/uploads/institucional/${req.file.filename}`;
    writeJsonFile('institucional.json', inst);

    const wss = req.app.get('wss');
    if (wss) {
      wss.broadcast({ type: 'INSTITUCIONAL_UPDATE', data: inst });
    }

    res.json({ success: true, logo: inst.logo, data: inst });
  });
});

router.post('/institucional/qrcode', (req, res) => {
  uploadInst.single('file')(req, res, function (err) {
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Nenhum arquivo enviado' });
    }
    
    const inst = readInstitucional();
    if (inst.qrcode && inst.qrcode.startsWith('/uploads/institucional/')) {
      const oldPath = path.join(__dirname, '..', 'public', inst.qrcode);
      if (fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch (e) {}
      }
    }

    inst.qrcode = `/uploads/institucional/${req.file.filename}`;
    writeJsonFile('institucional.json', inst);

    const wss = req.app.get('wss');
    if (wss) {
      wss.broadcast({ type: 'INSTITUCIONAL_UPDATE', data: inst });
    }

    res.json({ success: true, qrcode: inst.qrcode, data: inst });
  });
});

router.delete('/institucional/logo', (req, res) => {
  const inst = readInstitucional();
  if (inst.logo && inst.logo.startsWith('/uploads/institucional/')) {
    const oldPath = path.join(__dirname, '..', 'public', inst.logo);
    if (fs.existsSync(oldPath)) {
      try { fs.unlinkSync(oldPath); } catch (e) {}
    }
  }
  
  inst.logo = '';
  writeJsonFile('institucional.json', inst);

  const wss = req.app.get('wss');
  if (wss) {
    wss.broadcast({ type: 'INSTITUCIONAL_UPDATE', data: inst });
  }

  res.json({ success: true, data: inst });
});

router.delete('/institucional/qrcode', (req, res) => {
  const inst = readInstitucional();
  if (inst.qrcode && inst.qrcode.startsWith('/uploads/institucional/')) {
    const oldPath = path.join(__dirname, '..', 'public', inst.qrcode);
    if (fs.existsSync(oldPath)) {
      try { fs.unlinkSync(oldPath); } catch (e) {}
    }
  }
  
  inst.qrcode = '';
  writeJsonFile('institucional.json', inst);

  const wss = req.app.get('wss');
  if (wss) {
    wss.broadcast({ type: 'INSTITUCIONAL_UPDATE', data: inst });
  }

  res.json({ success: true, data: inst });
});

// Rotas de Eventos
router.get('/eventos', (req, res) => res.json(readJsonFile('eventos.json')));
router.get('/evento', (req, res) => res.json(readJsonFile('eventos.json'))); // fallback

router.post('/eventos/:id/ativar', (req, res) => {
  // Simplificado, assumimos que id="copa" ou similar. 
  // Na verdade nosso eventos.json era apenas 1 objeto.
  let evento = readJsonFile('eventos.json');
  // Ajuste se for array ou objeto
  if (Array.isArray(evento)) {
    // se for array
    evento = evento[0] || { ativo: false };
  }
  
  evento.ativo = req.body.ativo;
  writeJsonFile('eventos.json', evento);

  const wss = req.app.get('wss');
  if (wss) wss.broadcast({ type: 'EVENT_MODE', data: evento });

  res.json({ success: true, evento });
});

router.post('/evento/ativo', (req, res, next) => {
  req.url = '/eventos/1/ativar'; // fallback dummy id
  router.handle(req, res, next);
});

// Rotas de Esportes
router.get('/esportes/config', (req, res) => {
  const config = footballDataService.readEsportesConfig();
  res.json(config);
});

router.post('/esportes/config', (req, res) => {
  let config = footballDataService.readEsportesConfig();
  if (!config) config = {};
  
  const data = req.body;
  const updated = {
    ...config,
    ativo: data.ativo !== undefined ? data.ativo : config.ativo,
    usarComoFallbackStream: data.usarComoFallbackStream !== undefined ? data.usarComoFallbackStream : config.usarComoFallbackStream,
    mostrarJogosHoje: data.mostrarJogosHoje !== undefined ? data.mostrarJogosHoje : config.mostrarJogosHoje,
    mostrarProximosJogos: data.mostrarProximosJogos !== undefined ? data.mostrarProximosJogos : config.mostrarProximosJogos,
    mostrarClassificacao: data.mostrarClassificacao !== undefined ? data.mostrarClassificacao : config.mostrarClassificacao,
    competicao: data.competicao !== undefined ? data.competicao : config.competicao,
    competicaoNome: data.competicaoNome !== undefined ? data.competicaoNome : config.competicaoNome,
    intervaloAtualizacaoSegundos: data.intervaloAtualizacaoSegundos !== undefined ? data.intervaloAtualizacaoSegundos : config.intervaloAtualizacaoSegundos
  };

  footballDataService.writeEsportesConfig(updated);

  const wss = req.app.get('wss');
  if (wss) {
    wss.broadcast({ type: 'SPORTS_CONFIG_UPDATE', data: updated });
  }

  res.json({ success: true, data: updated });
});

router.get('/esportes/status', (req, res) => {
  res.json(footballDataService.getStatus());
});

router.get('/esportes/jogos-hoje', (req, res) => {
  const config = footballDataService.readEsportesConfig();
  res.json(config && config.cache && config.cache.jogosHoje ? config.cache.jogosHoje : []);
});

router.get('/esportes/proximos-jogos', (req, res) => {
  const config = footballDataService.readEsportesConfig();
  res.json(config && config.cache && config.cache.proximosJogos ? config.cache.proximosJogos : []);
});

router.get('/esportes/classificacao', (req, res) => {
  const config = footballDataService.readEsportesConfig();
  res.json(config && config.cache && config.cache.classificacao ? config.cache.classificacao : []);
});

router.post('/esportes/atualizar', async (req, res) => {
  try {
    await footballDataService.atualizarCacheEsportivo(req.app);
    res.json({ success: true, status: footballDataService.getStatus() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rota de Saúde dos Provedores de Futebol
router.get('/football/provider-health', (req, res) => {
  try {
    const health = ProviderFactory.getProviderHealth();
    res.json(health);
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

// Rotas de Copa do Mundo
router.get('/copa/config', (req, res) => {
  const config = worldCupDataService.readConfig();
  res.json(config);
});

router.post('/copa/config', (req, res) => {
  let config = worldCupDataService.readConfig();
  if (!config) config = {};
  
  const data = req.body;
  const updated = {
    ...config,
    ativo: data.ativo !== undefined ? data.ativo : config.ativo,
    usarComoFallbackStream: data.usarComoFallbackStream !== undefined ? data.usarComoFallbackStream : config.usarComoFallbackStream,
    mostrarJogosHoje: data.mostrarJogosHoje !== undefined ? data.mostrarJogosHoje : config.mostrarJogosHoje,
    mostrarProximosJogos: data.mostrarProximosJogos !== undefined ? data.mostrarProximosJogos : config.mostrarProximosJogos,
    mostrarClassificacaoGrupos: data.mostrarClassificacaoGrupos !== undefined ? data.mostrarClassificacaoGrupos : config.mostrarClassificacaoGrupos,
    fonteDados: data.fonteDados !== undefined ? data.fonteDados : config.fonteDados,
    fontePrimaria: data.fontePrimaria !== undefined ? data.fontePrimaria : config.fontePrimaria,
    fonteSecundaria: data.fonteSecundaria !== undefined ? data.fonteSecundaria : config.fonteSecundaria,
    intervaloAtualizacaoSegundos: data.intervaloAtualizacaoSegundos !== undefined ? data.intervaloAtualizacaoSegundos : config.intervaloAtualizacaoSegundos,
    competicao: data.competicao !== undefined ? data.competicao : config.competicao,
    competicaoNome: data.competicaoNome !== undefined ? data.competicaoNome : config.competicaoNome
  };

  worldCupDataService.writeConfig(updated);

  const wss = req.app.get('wss');
  if (wss) {
    wss.broadcast({ type: 'COPA_CONFIG_UPDATE', data: updated });
  }

  res.json({ success: true, data: updated });
});

router.get('/copa/status', (req, res) => {
  res.json(worldCupDataService.getStatus());
});

router.get('/copa/jogos-hoje', (req, res) => {
  const config = worldCupDataService.readConfig();
  res.json(config && config.cache && config.cache.jogosHoje ? config.cache.jogosHoje : []);
});

router.get('/copa/proximos-jogos', (req, res) => {
  const config = worldCupDataService.readConfig();
  res.json(config && config.cache && config.cache.proximosJogos ? config.cache.proximosJogos : []);
});

router.get('/copa/classificacao', (req, res) => {
  const config = worldCupDataService.readConfig();
  res.json(config && config.cache && config.cache.classificacaoGrupos ? config.cache.classificacaoGrupos : []);
});

router.get('/copa/estatisticas', (req, res) => {
  const config = worldCupDataService.readConfig();
  res.json(config && config.cache && config.cache.estatisticas ? config.cache.estatisticas : []);
});

router.post('/copa/atualizar', async (req, res) => {
  const startTs = Date.now();
  try {
    const refreshResult = await ProviderFactory.forcarAtualizacaoBackground();
    await worldCupDataService.atualizarCache(req.app);
    const status = worldCupDataService.getStatus();
    const config = worldCupDataService.readConfig();
    const cacheCount = config && config.cache ? (
      (config.cache.jogosHoje ? config.cache.jogosHoje.length : 0) +
      (config.cache.proximosJogos ? config.cache.proximosJogos.length : 0) +
      (config.cache.classificacaoGrupos ? config.cache.classificacaoGrupos.length : 0)
    ) : 0;
    res.json({
      success: true,
      provider: refreshResult.provider,
      cacheRecords: cacheCount,
      durationMs: Date.now() - startTs,
      status: status.ok ? 'ok' : 'error',
      details: status
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, durationMs: Date.now() - startTs });
  }
});

module.exports = router;
