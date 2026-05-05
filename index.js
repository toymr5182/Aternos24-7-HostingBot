const mineflayer = require('mineflayer')
const readline = require('readline')

let bot
let rl
let afkInterval
let reconnectTimer = null
let connecting = false

const config = {
  host: 'play.amorycraft.com',
  port: 25565,
  username: 'EERTO',
  version: '1.21.11'
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

function log(msg) {
  if (!rl) {
    process.stdout.write(msg + '\n')
    return
  }

  readline.clearLine(process.stdout, 0)
  readline.cursorTo(process.stdout, 0)
  process.stdout.write(msg + '\n')
  rl.prompt(true)
}

function scheduleReconnect(delay = 10000) {
  if (reconnectTimer) return

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    createBot()
  }, delay)
}

function createBot() {
  if (connecting) return
  connecting = true

  if (afkInterval) clearInterval(afkInterval)

  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  if (bot) {
    try {
      bot.removeAllListeners()
      bot.quit()
    } catch {}
    bot = null
  }

  log('[BOT] กำลังเชื่อมต่อ...')

  bot = mineflayer.createBot({
    host: config.host,
    port: config.port,
    username: config.username,
    version: config.version
  })

  bot.once('spawn', () => {
    connecting = false
    log('[BOT] เข้าเซิร์ฟแล้ว')

    setTimeout(() => {
      if (!bot) return
      bot.chat('/login a12345')
      log('[SEND] /login a12345')
    }, 2500)

    setTimeout(() => {
      if (!bot) return
      bot.chat('/smp')
      log('[SEND] /smp')
    }, 4500)
  })

  bot.on('chat', (username, message) => {
    if (username === bot.username) return
    log(`[CHAT] ${username}: ${message}`)
  })

  bot.on('whisper', (username, message) => {
    if (username === bot.username) return
    log(`[WHISPER] ${username}: ${message}`)
  })

  bot.on('message', (jsonMsg) => {
    log(`[SERVER] ${stringifyMsg(jsonMsg)}`)
  })

  bot.on('messagestr', (msg) => {
    log(`[RAW] ${msg}`)
  })

  afkInterval = setInterval(() => {
    if (!bot?.entity) return

    bot.setControlState('jump', true)

    setTimeout(() => {
      if (bot) bot.setControlState('jump', false)
    }, 400)
  }, 30000)

  bot.on('kicked', (reason) => {
    connecting = false

    const msg = stringifyMsg(reason)
    log(`[KICKED] ${msg}`)

    if (msg.includes('already connected')) {
      log('[BOT] ยังมี session เก่าค้างอยู่ รอ reconnect 15 วินาที...')
      scheduleReconnect(15000)
    }
  })

  bot.on('end', () => {
    connecting = false
    log('[BOT] หลุดจากเซิร์ฟ กำลัง reconnect...')
    scheduleReconnect(10000)
  })

  bot.on('error', (err) => {
    connecting = false
    log(`[ERROR] ${err?.message || String(err)}`)
  })
}

rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> '
})

rl.prompt()

rl.on('line', (line) => {
  const msg = line.trim()

  if (!msg) {
    rl.prompt()
    return
  }

  if (bot && bot.chat) {
    bot.chat(msg)
    log(`[SEND] ${msg}`)
  }

  rl.prompt()
})

createBot()
