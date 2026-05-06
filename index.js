const mineflayer = require('mineflayer')
const express = require('express')

let bot
let afkInterval
let reconnectTimer = null
let loginInterval = null
let smpTimer = null

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
  connectedAt: null
}

function addLog(msg) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`
  chatLog.unshift(line)
  if (chatLog.length > 120) chatLog.pop()
  console.log(line)
}

function clearTimers() {
  if (loginInterval) clearInterval(loginInterval)
  if (smpTimer) clearTimeout(smpTimer)
  loginInterval = null
  smpTimer = null
}

function getUptime() {
  if (!state.connectedAt) return '-'
  const sec = Math.floor((Date.now() - state.connectedAt) / 1000)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return `${h}h ${m}m ${s}s`
}

function scheduleReconnect() {
  if (reconnectTimer) return

  addLog('หลุดจากเซิร์ฟ กำลัง reconnect ใน 5 วินาที...')

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    createBot()
  }, 5000)
}

function runLoginSequence() {
  clearTimers()

  let tries = 0

  loginInterval = setInterval(() => {
    if (!bot || state.status !== 'online') return

    tries++
    bot.chat(`/login ${config.password}`)
    addLog(`AUTO LOGIN ${tries}`)

    if (tries >= 5) {
      clearInterval(loginInterval)
      loginInterval = null
    }
  }, 350)

  smpTimer = setTimeout(() => {
    if (!bot || state.status !== 'online') return
    bot.chat('/smp')
    addLog('AUTO: /smp')
  }, 4500)
}

function createBot() {
  clearTimers()

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
    if (username !== bot.username) {
      addLog(`[CHAT] ${username}: ${message}`)
    }
  })

  bot.on('whisper', (username, message) => {
    if (username !== bot.username) {
      addLog(`[WHISPER] ${username}: ${message}`)
    }
  })

  bot.on('messagestr', (msg) => {
    if (msg) addLog(`[SERVER] ${msg}`)
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

    let text = ''
    try {
      text = typeof reason === 'string' ? reason : JSON.stringify(reason)
    } catch {
      text = String(reason)
    }

    addLog(`[KICKED] ${text}`)
  })

  bot.on('end', () => {
    state.status = 'offline'
    clearTimers()
    scheduleReconnect()
  })

  bot.on('error', (err) => {
    state.status = 'error'
    addLog(`[ERROR] ${err?.message || String(err)}`)
  })
}

const app = express()
app.use(express.urlencoded({ extended: true }))

app.get('/', (req, res) => {
  res.send(`
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="4" />
    <style>
      body { font-family: Arial; max-width: 900px; margin: 20px auto; padding: 12px; }
      .box { border: 1px solid #ccc; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
      input, button { padding: 10px; font-size: 15px; }
      pre { white-space: pre-wrap; max-height: 450px; overflow: auto; }
    </style>
  </head>
  <body>
    <h2>Minecraft AFK Bot</h2>

    <div class="box">
      <b>Status:</b> ${state.status}<br>
      <b>Server:</b> ${config.host}:${config.port}<br>
      <b>Username:</b> ${config.username}<br>
      <b>Uptime:</b> ${getUptime()}<br>
      <b>Auto Jump:</b> ${state.autoJump ? 'ON' : 'OFF'}
    </div>

    <div class="box">
      <form method="POST" action="/command">
        <input name="cmd" placeholder="พิมพ์คำสั่ง" style="width:70%" />
        <button type="submit">Send</button>
      </form>
    </div>

    <div class="box">
      <form method="POST" action="/afk/on" style="display:inline"><button>AFK ON</button></form>
      <form method="POST" action="/afk/off" style="display:inline"><button>AFK OFF</button></form>
      <form method="POST" action="/reconnect" style="display:inline"><button>Reconnect</button></form>
    </div>

    <div class="box">
      <b>Live Chat / Server Log</b>
      <pre>${chatLog.join('\n')}</pre>
    </div>
  </body>
  </html>
  `)
})

app.post('/command', (req, res) => {
  const cmd = String(req.body.cmd || '').trim()
  if (cmd && bot && state.status === 'online') {
    bot.chat(cmd)
    addLog(`[YOU] ${cmd}`)
  }
  res.redirect('/')
})

app.post('/afk/on', (req, res) => {
  state.autoJump = true
  res.redirect('/')
})

app.post('/afk/off', (req, res) => {
  state.autoJump = false
  res.redirect('/')
})

app.post('/reconnect', (req, res) => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  try { bot.end() } catch {}

  setTimeout(createBot, 1000)
  res.redirect('/')
})

const PORT = process.env.PORT || 3000

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Dashboard running on ${PORT}`)
})

createBot()
