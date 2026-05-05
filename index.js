const mineflayer = require('mineflayer')
const readline = require('readline')
const express = require('express')

let bot
let rl
let afkInterval

const config = {
  host: 'play.amorycraft.com',
  port: 25565,
  username: 'EERTO'
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

function createBot() {
  if (afkInterval) clearInterval(afkInterval)

  state.status = 'connecting'
  draw()

  bot = mineflayer.createBot({
    host: config.host,
    port: config.port,
    username: config.username,
    version: false
  })

  bot.once('spawn', () => {
    state.status = 'online'
    state.connectedAt = Date.now()
    setMessage('เข้าเซิร์ฟแล้ว')

    setTimeout(() => {
      if (bot) {
        bot.chat('/smp')
        setMessage('รันคำสั่งอัตโนมัติ: /smp')
      }
    }, 2500)
  })

  bot.on('chat', (username, message) => {
    if (username === bot.username) return
    setMessage(`[CHAT] ${username}: ${message}`)
  })

  bot.on('whisper', (username, message) => {
    if (username === bot.username) return
    setMessage(`[WHISPER] ${username}: ${message}`)
  })

  bot.on('message', (jsonMsg) => {
    setMessage(`[SERVER] ${stringifyMsg(jsonMsg)}`)
  })

  bot.on('messagestr', (msg) => {
    setMessage(`[RAW] ${msg}`)
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
    setMessage(`[KICKED] ${stringifyMsg(reason)}`)
  })

  bot.on('end', () => {
    state.status = 'offline'
    setMessage('หลุดจากเซิร์ฟ กำลัง reconnect ใน 5 วินาที...')
    setTimeout(createBot, 5000)
  })

  bot.on('error', (err) => {
    state.status = 'error'
    setMessage(`[ERROR] ${err?.message || String(err)}`)
  })
}

/* ===========================
   WEB DASHBOARD FOR RENDER
=========================== */

const app = express()
app.use(express.urlencoded({ extended: true }))

app.get('/', (req, res) => {
  res.send(`
    <html>
    <head>
      <title>AFK Bot Dashboard</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        body{
          font-family: Arial;
          max-width: 700px;
          margin: 30px auto;
          padding: 20px;
        }
        input,button{
          padding:10px;
          font-size:16px;
        }
        .box{
          border:1px solid #ccc;
          padding:15px;
          margin-bottom:15px;
          border-radius:8px;
        }
      </style>
    </head>
    <body>
      <h2>Minecraft AFK Bot</h2>

      <div class="box">
        <b>Status:</b> ${state.status}<br>
        <b>Server:</b> ${config.host}:${config.port}<br>
        <b>Username:</b> ${config.username}<br>
        <b>Uptime:</b> ${getUptime()}<br>
        <b>Auto Jump:</b> ${state.autoJump ? 'ON' : 'OFF'}<br>
        <b>Last Message:</b><br>${state.lastMessage}
      </div>

      <div class="box">
        <form method="POST" action="/command">
          <input name="cmd" placeholder="พิมพ์คำสั่ง..." style="width:70%" />
          <button type="submit">Send</button>
        </form>
      </div>

      <div class="box">
        <form method="POST" action="/afk/on" style="display:inline;">
          <button type="submit">AFK ON</button>
        </form>

        <form method="POST" action="/afk/off" style="display:inline;">
          <button type="submit">AFK OFF</button>
        </form>

        <form method="POST" action="/reconnect" style="display:inline;">
          <button type="submit">Reconnect</button>
        </form>
      </div>
    </body>
    </html>
  `)
})

app.post('/command', (req, res) => {
  const msg = String(req.body.cmd || '').trim()

  if (msg && bot && bot.chat) {
    bot.chat(msg)
    setMessage(`ส่งข้อความ: ${msg}`)
  }

  res.redirect('/')
})

app.post('/afk/on', (req, res) => {
  state.autoJump = true
  setMessage('เปิด auto jump แล้ว')
  res.redirect('/')
})

app.post('/afk/off', (req, res) => {
  state.autoJump = false
  setMessage('ปิด auto jump แล้ว')
  res.redirect('/')
})

app.post('/reconnect', (req, res) => {
  try {
    bot.end()
  } catch {}
  createBot()
  res.redirect('/')
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Web dashboard running on port ${PORT}`)
})

/* ===========================
   LOCAL TERMINAL ONLY
=========================== */

if (!process.env.RENDER) {
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
      setMessage('เปิด auto jump แล้ว')
      return
    }

    if (msg === '/afk off') {
      state.autoJump = false
      setMessage('ปิด auto jump แล้ว')
      return
    }

    if (msg === '/reconnect') {
      try {
        bot.end()
      } catch {}
      createBot()
      return
    }

    if (bot && bot.chat) {
      bot.chat(msg)
      setMessage(`ส่งข้อความ: ${msg}`)
    }

    draw()
  })

  draw()
}

createBot()
