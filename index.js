const mineflayer = require('mineflayer')

let bot
let afkInterval

const chatLog = []

const config = {
  host: 'play.amorycraft.com',
  port: 25565,
  username: 'EERTO',
  password: 'a12345'
}

const state = {
  status: 'starting',
  autoJump: true,
  lastMessage: '-',
  connectedAt: null
}

function stringifyMsg(msg) {
  try {
    if (typeof msg === 'string') return msg
    if (msg && typeof msg.toString === 'function') return msg.toString()
    return JSON.stringify(msg)
  } catch {
    return 'Unknown message'
  }
}

function addLog(msg) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`
  chatLog.unshift(line)
  if (chatLog.length > 150) chatLog.pop()
  state.lastMessage = msg
  console.log(line)
}

function getUptime() {
  if (!state.connectedAt) return '-'

  const sec = Math.floor((Date.now() - state.connectedAt) / 1000)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60

  return `${h}h ${m}m ${s}s`
}

function runLoginSequence() {
  setTimeout(() => {
    if (!bot) return
    bot.chat(`/login ${config.password}`)
    addLog(`AUTO: /login ${config.password}`)
  }, 2500)

  setTimeout(() => {
    if (!bot) return
    bot.chat('/smp')
    addLog('AUTO: /smp')
  }, 5000)
}

function createBot() {
  if (afkInterval) clearInterval(afkInterval)

  state.status = 'connecting'
  addLog('กำลังเชื่อมต่อ...')

  bot = mineflayer.createBot({
    host: config.host,
    port: config.port,
    username: config.username,
    version: false
  })

  bot.once('spawn', () => {
    state.status = 'online'
    state.connectedAt = Date.now()
    addLog('เข้าเซิร์ฟแล้ว')

    runLoginSequence()
  })

  bot.on('chat', (username, message) => {
    if (username === bot.username) return
    addLog(`[CHAT] ${username}: ${message}`)
  })

  bot.on('whisper', (username, message) => {
    if (username === bot.username) return
    addLog(`[WHISPER] ${username}: ${message}`)
  })

  bot.on('messagestr', (msg) => {
    if (!msg) return
    addLog(`[SERVER] ${msg}`)
  })

  afkInterval = setInterval(() => {
    if (!bot?.entity || !state.autoJump) return

    bot.setControlState('jump', true)

    setTimeout(() => {
      if (bot) bot.setControlState('jump', false)
    }, 180)
  }, 60000)

  bot.on('kicked', (reason) => {
    state.status = 'kicked'
    addLog(`[KICKED] ${stringifyMsg(reason)}`)
  })

  bot.on('end', () => {
    state.status = 'offline'
    addLog('หลุดจากเซิร์ฟ กำลัง reconnect ใน 5 วินาที...')
    setTimeout(createBot, 5000)
  })

  bot.on('error', (err) => {
    state.status = 'error'
    addLog(`[ERROR] ${err?.message || String(err)}`)
  })
}

function sendCommand(cmd) {
  if (!cmd || !bot) return false

  bot.chat(cmd)
  addLog(`[YOU] ${cmd}`)
  return true
}

function reconnectBot() {
  try {
    bot.end()
  } catch {}

  setTimeout(createBot, 1000)
}

module.exports = {
  createBot,
  sendCommand,
  reconnectBot,
  state,
  config,
  chatLog,
  getUptime
}
