const mineflayer = require('mineflayer')
const readline = require('readline')

let bot
let rl
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

function addLog(msg) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`
  chatLog.unshift(line)
  if (chatLog.length > 120) chatLog.pop()
  setMessage(msg)
  console.log(line)
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

function getUptime() {
  if (!state.connectedAt) return '-'

  const sec = Math.floor((Date.now() - state.connectedAt) / 1000)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60

  return `${h}h ${m}m ${s}s`
}

function splitMessage(text, width = 42) {
  const msg = String(text || '')
  const lines = []

  for (let i = 0; i < msg.length; i += width) {
    lines.push(msg.slice(i, i + width))
  }

  while (lines.length < 2) lines.push('')

  return lines.slice(0, 2)
}

function draw() {
  if (!rl) return

  process.stdout.write('\x1Bc')

  const lines = splitMessage(state.lastMessage, 42)

  console.log('┌────────────────────────────────────────────┐')
  console.log('│              MINECRAFT AFK BOT             │')
  console.log('├────────────────────────────────────────────┤')
  console.log(`│ STATUS    : ${state.status}`.padEnd(45) + '│')
  console.log(`│ SERVER    : ${config.host}:${config.port}`.padEnd(45) + '│')
  console.log(`│ USERNAME  : ${config.username}`.padEnd(45) + '│')
  console.log(`│ UPTIME    : ${getUptime()}`.padEnd(45) + '│')
  console.log(`│ AUTO JUMP : ${state.autoJump ? 'ON' : 'OFF'}`.padEnd(45) + '│')
  console.log('├────────────────────────────────────────────┤')
  console.log(`│ ${lines[0]}`.padEnd(45) + '│')
  console.log(`│ ${lines[1]}`.padEnd(45) + '│')
  console.log('└────────────────────────────────────────────┘')

  rl.prompt(true)
}

function setMessage(msg) {
  state.lastMessage = msg
  draw()
}

function runAutoCommands() {
  setTimeout(() => {
    if (bot) {
      bot.chat(`/login ${config.password}`)
      addLog(`AUTO: /login ${config.password}`)
    }
  }, 2500)

  setTimeout(() => {
    if (bot) {
      bot.chat('/smp')
      addLog('AUTO: /smp')
    }
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
    runAutoCommands()
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
    if (msg && msg.trim()) addLog(`[SERVER] ${msg}`)
  })

  afkInterval = setInterval(() => {
    if (!bot?.entity || !state.autoJump) return

    bot.setControlState('jump', true)

    setTimeout(() => {
      if (bot) bot.setControlState('jump', false)
    }, 400)
  }, 30000)

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

function sendChat(msg) {
  if (bot && bot.chat) {
    bot.chat(msg)
    addLog(`[YOU] ${msg}`)
  }
}

function reconnect() {
  try {
    bot.end()
  } catch {}
  createBot()
}

rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> '
})

rl.on('line', (line) => {
  const msg = line.trim()

  if (!msg) {
    draw()
    return
  }

  if (msg === '/afk on') {
    state.autoJump = true
    addLog('เปิด auto jump แล้ว')
    return
  }

  if (msg === '/afk off') {
    state.autoJump = false
    addLog('ปิด auto jump แล้ว')
    return
  }

  if (msg === '/reconnect') {
    reconnect()
    return
  }

  sendChat(msg)
})

draw()
createBot()

module.exports = {
  state,
  config,
  chatLog,
  sendChat,
  reconnect,
  getUptime
}
