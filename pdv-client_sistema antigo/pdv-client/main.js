const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require('electron')
const WebSocket = require('ws')
const dgram = require('dgram')
const path = require('path')
const fs = require('fs')
const { uIOhook, UiohookKey } = require('uiohook-napi')

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
  serverUrl: '',           // vazio = descoberta automática
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

    return { ...DEFAULT_CONFIG, ...stored, sound, cooldown }
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
function sendCall() {
  if (isCooldown) return
  const config = loadConfigWithDefaults()
  const num = String(config.caixa).padStart(2, '0')
  const tipo = config.tipo || 'Normal'

  // Método 1: gravar arquivo na pasta compartilhada (principal)
  const watchDir = config.watchDir || DEFAULT_CONFIG.watchDir
  const filename = path.join(watchDir, `caixa-${num}.txt`)

  try {
    fs.writeFileSync(filename, tipo, 'utf-8')
    console.log(`[PDV] Arquivo gravado: ${filename}`)
    setCooldown(config.cooldown)
    // Feedback sonoro local
    if (soundWin && !soundWin.isDestroyed()) {
      const sound = loadConfigWithDefaults().sound ?? { mode: 'bell', volume: 0.8 }
      soundWin.webContents.send('play-sound', sound)
    }
    return
  } catch (e) {
    console.warn('[PDV] Pasta inacessível, tentando WebSocket:', e.message)
  }

  // Método 2: fallback via WebSocket direto
  if (ws && ws.readyState === WebSocket.OPEN) {
    const hora = new Date().toLocaleTimeString('pt-BR', { hour12: false })
    ws.send(JSON.stringify({ tipo: 'caixa-livre', num, hora, tipoCaixa: tipo }))
    console.log(`[PDV] Chamada via WS: Caixa ${num}`)
    setCooldown(config.cooldown)
    // Feedback sonoro local
    if (soundWin && !soundWin.isDestroyed()) {
      const sound = loadConfigWithDefaults().sound ?? { mode: 'bell', volume: 0.8 }
      soundWin.webContents.send('play-sound', sound)
    }
  } else {
    console.error('[PDV] Sem conexão disponível para enviar chamada')
  }
}

function setCooldown(cooldownSec) {
  isCooldown = true
  const delayMs = (cooldownSec !== undefined ? Number(cooldownSec) : 2) * 1000
  setTimeout(() => { isCooldown = false }, delayMs)
}

// ── Tray ──────────────────────────────────────────────────────────────────────
function getTrayIcon() {
  return nativeImage.createFromPath(path.join(__dirname, 'assets', 'logo.jpeg')).resize({ width: 24, height: 24 })
}

function updateTrayStatus(connected) {
  if (!tray) return
  // Use the logo for the tray
  tray.setImage(getTrayIcon())
  tray.setToolTip(`PDV Caixa ${loadConfigWithDefaults().caixa} — ${connected ? 'Conectado' : 'Desconectado'}`)
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
    title: 'Configuração PDV',
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
const KEY_MAP = {
  'Y': UiohookKey.Y,
  'F1': UiohookKey.F1, 'F2': UiohookKey.F2, 'F3': UiohookKey.F3,
  'F4': UiohookKey.F4, 'F5': UiohookKey.F5, 'F6': UiohookKey.F6,
  'F7': UiohookKey.F7, 'F8': UiohookKey.F8, 'F9': UiohookKey.F9,
  'F10': UiohookKey.F10, 'F11': UiohookKey.F11, 'F12': UiohookKey.F12,
}

function registerHotkey(hotkeyName) {
  const targetKey = KEY_MAP[hotkeyName] ?? UiohookKey.Y
  uIOhook.removeAllListeners('keydown')
  uIOhook.on('keydown', (e) => { if (e.keycode === targetKey) sendCall() })
  uIOhook.start()
  console.log(`[Hotkey] Hook ativo para tecla: ${hotkeyName}`)
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
  uIOhook.stop()
  registerHotkey(config.hotkey || 'Y')
  if (ws) { try { ws.terminate() } catch {} ws = null }
  startConnection()
  updateTrayStatus(false)
  event.reply('config-saved')
})

// ── Lifecycle ─────────────────────────────────────────────────────────────────
app.on('will-quit', () => {
  uIOhook.stop()
  if (ws) { try { ws.terminate() } catch {} }
})

app.on('window-all-closed', (e) => e.preventDefault())
