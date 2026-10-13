const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, globalShortcut } = require('electron')
const WebSocket = require('ws')
const dgram = require('dgram')
const path = require('path')
const fs = require('fs')

let uIOhook = null
let UiohookKey = null
try {
  const hook = require('uiohook-napi')
  uIOhook = hook.uIOhook
  UiohookKey = hook.UiohookKey
} catch (e) {
  console.warn('[uiohook] Biblioteca nativa não carregada, usando fallback globalShortcut:', e.message)
}

// ── Tipos de caixa padrão ─────────────────────────────────────────────────────
const DEFAULT_TIPOS = [
  { key: 'Normal',       icone: String.fromCodePoint(0x1F6D2), titulo: 'CAIXA LIVRE',       label: 'N\u00FAmero' },
  { key: 'Preferencial', icone: '\u267F',                      titulo: 'CAIXA PREFERENCIAL', label: 'N\u00FAmero' },
  { key: 'R\u00E1pido',  icone: '\u26A1',                      titulo: 'CAIXA R\u00C1PIDO',  label: 'At\u00E9 10 itens \u2014 N\u00FAmero' },
]

// ── Config ────────────────────────────────────────────────────────────────────
const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json')

const DEFAULT_CONFIG = {
  caixa: 1,
  tipo: 'Normal',
  serverUrl: 'ws://localhost:3040', // padrão local
  watchDir: '\\\\srvsistema\\GERTEC\\chamada',
  hotkey: 'Y',
  sound: { mode: 'bell', volume: 0.8 },
  cooldown: 2              // tempo de espera em segundos entre chamadas
}

function loadConfigWithDefaults() {
  const VALID_MODES = new Set(['voice', 'bell', 'none'])
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true })
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2))
      return { ...DEFAULT_CONFIG, sound: { ...DEFAULT_CONFIG.sound } }
    }
    const stored = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
    const sound = {
      ...DEFAULT_CONFIG.sound,
      ...(stored.sound ?? {})
    }
    // Sanitizar mode
    if (!VALID_MODES.has(sound.mode)) sound.mode = 'bell'
    // Clampar volume
    sound.volume = Math.max(0, Math.min(1, Number(sound.volume) || 0.8))
    
    // Cooldown default
    const cooldown = stored.cooldown !== undefined ? Number(stored.cooldown) : DEFAULT_CONFIG.cooldown

    const serverUrl = (stored.serverUrl && stored.serverUrl.trim() !== '') ? stored.serverUrl : DEFAULT_CONFIG.serverUrl
    return { ...DEFAULT_CONFIG, ...stored, serverUrl, sound, cooldown }
  } catch {
    return { ...DEFAULT_CONFIG, sound: { ...DEFAULT_CONFIG.sound } }
  }
}

function saveConfig(data) {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true })
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2))
}

// ── Estado global ─────────────────────────────────────────────────────────────
let tray = null
let adminWin = null
let soundWin = null
let ws = null
let isCooldown = false
let reconnectTimer = null
let subscriptionBlocked = false

// ── UDP Discovery ─────────────────────────────────────────────────────────────
const DISCOVERY_PORT = 41234

function discoverServer(callback) {
  const client = dgram.createSocket('udp4')
  let found = false

  const done = (url) => {
    if (found) return
    found = true
    try { client.close() } catch {}
    callback(url)
  }

  client.on('error', (err) => {
    console.error('[Discovery] Erro UDP:', err.message)
    done(null)
  })

  client.on('message', (data) => {
    try {
      const info = JSON.parse(data.toString())
      if (info.type === 'TELAO_SERVER_MERCANTIL') {
        const url = `ws://${info.host}:${info.wsPort}`
        console.log('[Discovery] Servidor encontrado:', url)
        done(url)
      }
    } catch {}
  })

  client.bind(() => {
    client.setBroadcast(true)
    client.send(Buffer.from('TELAO_DISCOVER'), DISCOVERY_PORT, '255.255.255.255', (err) => {
      if (err) console.error('[Discovery] Erro broadcast:', err.message)
    })
  })

  setTimeout(() => {
    console.warn('[Discovery] Timeout — servidor não encontrado')
    done(null)
  }, 3000)
}

// ── WebSocket ─────────────────────────────────────────────────────────────────
function connectWS(url) {
  if (!url) {
    console.error('[WS] Nenhum servidor disponível, tentando novamente em 10s...')
    reconnectTimer = setTimeout(startConnection, 10000)
    return
  }

  if (ws) {
    try { ws.terminate() } catch {}
    ws = null
  }

  ws = new WebSocket(url)

  ws.on('open', () => {
    console.log('[WS] Conectado:', url)
    updateTrayStatus(true)
  })

  ws.on('error', (e) => {
    console.error('[WS] Erro:', e.message)
  })
  ws.on('message', raw => {
    try {
      const message = JSON.parse(raw.toString())
      if (message.type === 'SUBSCRIPTION_STATUS') subscriptionBlocked = !message.data.allowed
    } catch (_) {}
  })

  ws.on('close', () => {
    console.warn('[WS] Desconectado, reconectando em 5s...')
    updateTrayStatus(false)
    reconnectTimer = setTimeout(startConnection, 5000)
  })
}

function startConnection() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
  const config = loadConfigWithDefaults()
  const manual = config.serverUrl && config.serverUrl.trim() !== ''

  if (manual) {
    console.log('[WS] Usando IP manual:', config.serverUrl)
    connectWS(config.serverUrl)
  } else {
    console.log('[Discovery] Procurando servidor na rede...')
    discoverServer(connectWS)
  }
}

// ── Enviar chamada ────────────────────────────────────────────────────────────
async function sendCall() {
  if (subscriptionBlocked) {
    console.warn('[Assinatura] Sistema bloqueado. Contato: www.nexareis.com.br / (11) 93710-5501')
    return
  }
  if (isCooldown) return
  const config = loadConfigWithDefaults()
  const num = String(config.caixa).padStart(2, '0')
  const tipo = config.tipo || 'Normal'
  let callSent = false

  // Feedback sonoro local (executa imediatamente para feedback rápido ao operador)
  const playLocalSound = () => {
    if (soundWin && !soundWin.isDestroyed()) {
      const sound = config.sound ?? { mode: 'bell', volume: 0.8 }
      const serverUrl = config.serverUrl || DEFAULT_CONFIG.serverUrl
      soundWin.webContents.send('play-sound', {
        ...sound,
        caixa: config.caixa,
        tipo: tipo,
        serverUrl: serverUrl
      })
    }
  }

  // Método 1: Tentar chamada via HTTP POST (Mais moderno e direto)
  if (config.serverUrl) {
    const httpUrl = config.serverUrl.replace(/^ws:\/\//, 'http://').replace(/^wss:\/\//, 'https://');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const response = await fetch(`${httpUrl}/api/chamar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caixa: num, tipo })
      });
      clearTimeout(timeout);
      if (response.status === 423) {
        subscriptionBlocked = true;
        console.warn('[Assinatura] Sistema bloqueado. Nenhuma contingência será acionada.');
        return;
      }
      if (response.ok) {
        console.log(`[PDV] Chamada enviada via HTTP: Caixa ${num}`);
        callSent = true;
      }
    } catch (e) {
      console.warn('[PDV] Falha ao enviar via HTTP:', e.message);
    }
  }

  // Método 2: Fallback via WebSocket direto
  if (!callSent && ws && ws.readyState === WebSocket.OPEN) {
    try {
      const hora = new Date().toLocaleTimeString('pt-BR', { hour12: false })
      ws.send(JSON.stringify({ tipo: 'caixa-livre', num, hora, tipoCaixa: tipo }))
      console.log(`[PDV] Chamada enviada via WebSocket: Caixa ${num}`)
      callSent = true;
    } catch (e) {
      console.warn('[PDV] Falha ao enviar via WS:', e.message);
    }
  }

  // Método 3: Fallback via gravação de arquivo na pasta compartilhada
  if (!callSent) {
    const watchDir = config.watchDir || DEFAULT_CONFIG.watchDir
    const filename = path.join(watchDir, `caixa-${num}.txt`)
    try {
      fs.writeFileSync(filename, tipo, 'utf-8')
      console.log(`[PDV] Chamada gravada em arquivo compartilhado: ${filename}`)
      callSent = true;
    } catch (e) {
      console.warn('[PDV] Pasta compartilhada inacessível:', e.message)
    }
  }

  // Método 4: Fallback local para C:\chamador_fallback (JSON)
  if (!callSent) {
    const localFallbackDir = 'C:\\chamador_fallback';
    const filename = path.join(localFallbackDir, `call_${Date.now()}.json`);
    try {
      if (!fs.existsSync(localFallbackDir)) {
        fs.mkdirSync(localFallbackDir, { recursive: true });
      }
      fs.writeFileSync(filename, JSON.stringify({ caixa: num, tipo, timestamp: new Date().toISOString() }));
      console.log(`[PDV] Chamada gravada em fallback local: ${filename}`)
      callSent = true;
    } catch (e) {
      console.error('[PDV] Todos os métodos de chamada falharam:', e.message)
    }
  }

  if (callSent) {
    setCooldown(config.cooldown)
    playLocalSound()
  }
}

function setCooldown(cooldownSec) {
  isCooldown = true
  const delayMs = (cooldownSec !== undefined ? Number(cooldownSec) : 2) * 1000
  setTimeout(() => { isCooldown = false }, delayMs)
}

// ── Tray ──────────────────────────────────────────────────────────────────────
function getTrayIcon() {
  const logoPath = path.join(__dirname, 'assets', 'logo.jpeg')
  try {
    if (fs.existsSync(logoPath)) {
      return nativeImage.createFromPath(logoPath).resize({ width: 24, height: 24 })
    }
  } catch (e) {
    console.warn('[Tray] Falha ao carregar logo:', e.message)
  }
  return nativeImage.createEmpty()
}

function updateTrayStatus(connected) {
  if (!tray) return
  // Use the logo for the tray
  tray.setImage(getTrayIcon())
  tray.setToolTip(`CHAMADOR DE CAIXA PRO - Caixa ${loadConfigWithDefaults().caixa} — ${connected ? 'Conectado' : 'Desconectado'}`)
}

function createSoundWindow() {
  soundWin = new BrowserWindow({
    width: 1,
    height: 1,
    show: false,
    skipTaskbar: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  })
  soundWin.loadFile(path.join(__dirname, 'popup.html'))
  soundWin.on('closed', () => { soundWin = null })
}

function openAdmin() {
  if (adminWin) { adminWin.focus(); return }
  adminWin = new BrowserWindow({
    width: 480,
    height: 680,
    title: 'Configuração - CHAMADOR DE CAIXA PRO',
    icon: path.join(__dirname, 'assets', 'logo.jpeg'),
    resizable: false,
    autoHideMenuBar: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  })
  adminWin.loadFile(path.join(__dirname, 'admin.html'))
  adminWin.on('closed', () => { adminWin = null })
}

// ── App ready ─────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  tray = new Tray(getTrayIcon())
  const menu = Menu.buildFromTemplate([
    { label: 'Configurações', click: openAdmin },
    { type: 'separator' },
    { label: 'Sair', click: () => app.quit() }
  ])
  tray.setContextMenu(menu)
  tray.on('click', openAdmin)

  // Janela oculta dedicada ao som (sempre aberta)
  createSoundWindow()

  // Registrar hotkey via uIOhook
  const config = loadConfigWithDefaults()
  registerHotkey(config.hotkey || 'Y')

  startConnection()
})

// ── Hotkey ────────────────────────────────────────────────────────────────────
const KEY_MAP = UiohookKey ? {
  'Y': UiohookKey.Y,
  'F1': UiohookKey.F1, 'F2': UiohookKey.F2, 'F3': UiohookKey.F3,
  'F4': UiohookKey.F4, 'F5': UiohookKey.F5, 'F6': UiohookKey.F6,
  'F7': UiohookKey.F7, 'F8': UiohookKey.F8, 'F9': UiohookKey.F9,
  'F10': UiohookKey.F10, 'F11': UiohookKey.F11, 'F12': UiohookKey.F12,
} : {}

let hotkeyFallbackActive = false

function registerHotkey(hotkeyName) {
  globalShortcut.unregisterAll()

  if (uIOhook) {
    try {
      uIOhook.removeAllListeners('keydown')
      uIOhook.removeAllListeners('error')
      uIOhook.on('error', (e) => {
        console.warn('[uiohook] Erro no hook nativo, alternando para fallback:', e.message)
        activateGlobalShortcutFallback(hotkeyName)
      })
      uIOhook.on('keydown', (e) => {
        const targetKey = KEY_MAP[hotkeyName] ?? UiohookKey.Y
        if (e.keycode === targetKey) sendCall()
      })
      uIOhook.start()
      console.log(`[Hotkey] uiohook ativo para tecla: ${hotkeyName}`)
      return
    } catch (e) {
      console.warn('[Hotkey] uiohook falhou, usando fallback globalShortcut:', e.message)
    }
  }

  activateGlobalShortcutFallback(hotkeyName)
}

function activateGlobalShortcutFallback(hotkeyName) {
  try {
    const shortcut = `CommandOrControl+Shift+${hotkeyName}`
    const registered = globalShortcut.register(shortcut, () => sendCall())
    if (registered) {
      console.log(`[Hotkey] globalShortcut ativo: ${shortcut}`)
    } else {
      console.error(`[Hotkey] Falha ao registrar atalho: ${shortcut}`)
    }
  } catch (e) {
    console.error('[Hotkey] Falha crítica no registro de hotkey:', e.message)
  }
}

// ── Busca de tipos do servidor ────────────────────────────────────────────────

/**
 * Extrai a URL HTTP base do WebSocket conectado (se houver).
 * Retorna null se não houver conexão ativa.
 */
function getConnectedServerHttpBase() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return null
  try {
    const url = ws.url // ex: "ws://192.168.3.33:8080"
    return url.replace(/^ws:\/\//, 'http://').replace(/^wss:\/\//, 'https://')
  } catch {
    return null
  }
}

/**
 * Busca os tipos de caixa do servidor via HTTP GET /api/tipos.
 * Retorna DEFAULT_TIPOS em qualquer caso de falha (rede, timeout, JSON inválido, validação).
 * Nunca propaga exceções.
 *
 * @param {string} serverUrl - URL base do servidor (ex: "ws://192.168.3.33:8080") ou string vazia
 * @returns {Promise<Array>} - Lista de tipos ou DEFAULT_TIPOS em caso de falha
 */
async function fetchTiposFromServer(serverUrl) {
  // Derivar URL HTTP a partir da URL WebSocket ou da conexão ativa
  let httpBase = null
  if (serverUrl && serverUrl.trim() !== '') {
    httpBase = serverUrl.trim()
      .replace(/^ws:\/\//, 'http://')
      .replace(/^wss:\/\//, 'https://')
  } else {
    httpBase = getConnectedServerHttpBase()
  }

  if (!httpBase) return DEFAULT_TIPOS

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)

    let response
    try {
      response = await fetch(`${httpBase}/api/tipos`, { signal: controller.signal })
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) return DEFAULT_TIPOS

    const tipos = await response.json()

    // Validar: array não-vazio com campos obrigatórios
    if (!Array.isArray(tipos) || tipos.length === 0) return DEFAULT_TIPOS
    if (!tipos.every(t => t.key && t.icone && t.titulo && t.label)) return DEFAULT_TIPOS

    return tipos
  } catch {
    return DEFAULT_TIPOS
  }
}

// ── IPC ───────────────────────────────────────────────────────────────────────
ipcMain.on('get-config', (event) => {
  event.reply('config-data', loadConfigWithDefaults())
})

ipcMain.on('get-tipos', async (event) => {
  const config = loadConfigWithDefaults()
  const tipos = await fetchTiposFromServer(config.serverUrl)
  event.reply('tipos-data', tipos)
})

ipcMain.on('save-config', (event, config) => {
  saveConfig(config)
  globalShortcut.unregisterAll()
  if (uIOhook) {
    try { uIOhook.stop() } catch {}
  }
  registerHotkey(config.hotkey || 'Y')
  if (ws) { try { ws.terminate() } catch {} ws = null }
  startConnection()
  updateTrayStatus(false)
  event.reply('config-saved')
})

// ── Lifecycle ─────────────────────────────────────────────────────────────────
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  if (uIOhook) {
    try { uIOhook.stop() } catch {}
  }
  if (ws) { try { ws.terminate() } catch {} }
})

app.on('window-all-closed', (e) => e.preventDefault())
