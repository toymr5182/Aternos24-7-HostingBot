const mineflayer = require('mineflayer')
const express = require('express')
const http = require('http')
const { Server } = require('socket.io')

const app = express()
const server = http.createServer(app)
const io = new Server(server)

app.use(express.json())

let bot = null
let reconnectTimer = null

const config = {
  host: 'play.amorycraft.com',
  port: 25565,
  username: 'EERTO',
  version: '1.21.11'
}

const state = {
  status: 'offline',
  lastMessage: '-',
  connectedAt: null
}

function cleanText(text) {
  if (!text) return ''
  return String(text)
    .replace(/\u00a7[0-9A-FK-OR]/gi, '')
    .replace(/\x1b\[[0-9;]*m/g, '')
    .replace(/\[[0-9;]*m/g, '')
    .trim()
}

function stringifyMsg(msg) {
  try {
    if (!msg) return 'Unknown message'

    if (typeof msg === 'string') {
      return cleanText(msg)
    }

    if (msg.text) {
      return cleanText(msg.text)
    }

    if (typeof msg.toString === 'function') {
      const txt = msg.toString()
      if (txt && txt !== '[object Object]') {
        return cleanText(txt)
      }
    }

    return cleanText(JSON.stringify(msg))
  } catch {
    return 'Unknown message'
  }
}

function uptime() {
  if (!state.connectedAt) return '-'

  const sec = Math.floor((Date.now() - state.connectedAt) / 1000)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60

  return `${h}h ${m}m ${s}s`
}

function update(msg) {
  if (msg) {
    state.lastMessage = cleanText(msg)
    console.log(state.lastMessage)
  }

  io.emit('state', {
    ...state,
    uptime: uptime(),
    config
  })
}

function scheduleReconnect(delay = 8000) {
  if (reconnectTimer) clearTimeout(reconnectTimer)

  reconnectTimer = setTimeout(() => {
    createBot()
  }, delay)
}

function createBot() {
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

  state.status = 'connecting'
  state.connectedAt = null
  update('กำลังเชื่อมต่อ...')

  try {
    bot = mineflayer.createBot({
      host: config.host,
      port: config.port,
      username: config.username,
      version: config.version
    })
  } catch (err) {
    state.status = 'error'
    update('ERROR: ' + (err?.message || String(err)))
    scheduleReconnect()
    return
  }

  bot.once('spawn', () => {
    state.status = 'online'
    state.connectedAt = Date.now()
    update('เข้าเซิร์ฟแล้ว')

    setTimeout(() => {
      if (!bot || !bot.entity) return
      bot.chat('/login a12345')
      update('ส่ง /login a12345')
    }, 5000)

    setTimeout(() => {
      if (!bot || !bot.entity) return
      bot.chat('/smp')
      update('ส่ง /smp')
    }, 10000)
  })

  bot.on('chat', (username, message) => {
    if (username === bot.username) return
    update(`${username}: ${message}`)
  })

  bot.on('whisper', (username, message) => {
    if (username === bot.username) return
    update(`[WHISPER] ${username}: ${message}`)
  })

  bot.on('message', (jsonMsg) => {
    update(stringifyMsg(jsonMsg))
  })

  bot.on('messagestr', (msg) => {
    update(cleanText(msg))
  })

  bot.on('kicked', (reason) => {
    state.status = 'kicked'
    update(`KICKED: ${stringifyMsg(reason)}`)
  })

  bot.on('end', () => {
    state.status = 'offline'
    update('หลุดจากเซิร์ฟ กำลัง reconnect...')
    scheduleReconnect()
  })

  bot.on('error', (err) => {
    state.status = 'error'
    update(`ERROR: ${err?.message || String(err)}`)
  })
}

app.get('/', (req, res) => {
  res.send(`
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Minecraft Bot Dashboard</title>
<style>
body{font-family:sans-serif;padding:20px;max-width:900px;margin:auto}
input,button{padding:8px;margin:4px}
#log{border:1px solid #ccc;padding:10px;height:220px;overflow:auto;white-space:pre-wrap}
</style>
</head>
<body>
<h2>Minecraft AFK Bot Dashboard</h2>

<div>
  <b>Status:</b> <span id="status">-</span><br>
  <b>Uptime:</b> <span id="uptime">-</span><br>
  <b>Last:</b> <span id="last">-</span>
</div>

<hr>

<h3>Bot Settings</h3>
<input id="host" placeholder="Host">
<input id="port" placeholder="Port">
<input id="username" placeholder="Username">
<button onclick="save()">Save & Reconnect</button>

<hr>

<h3>Send Command</h3>
<input id="cmd" placeholder="/login ... หรือข้อความแชท" style="width:60%">
<button onclick="sendCmd()">Send</button>

<hr>

<div id="log"></div>

<script src="/socket.io/socket.io.js"></script>
<script>
const socket = io()
let lastLine = ''

socket.on('state', s => {
  document.getElementById('status').textContent = s.status
  document.getElementById('uptime').textContent = s.uptime
  document.getElementById('last').textContent = s.lastMessage

  document.getElementById('host').value = s.config.host
  document.getElementById('port').value = s.config.port
  document.getElementById('username').value = s.config.username

  if (lastLine !== s.lastMessage) {
    lastLine = s.lastMessage
    const log = document.getElementById('log')
    log.textContent += s.lastMessage + "\\n"
    log.scrollTop = log.scrollHeight
  }
})

function sendCmd() {
  fetch('/command', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      command: document.getElementById('cmd').value
    })
  })

  document.getElementById('cmd').value = ''
}

function save() {
  fetch('/config', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      host: document.getElementById('host').value,
      port: document.getElementById('port').value,
      username: document.getElementById('username').value
    })
  })
}
</script>
</body>
</html>
`)
})

app.post('/command', (req, res) => {
  const cmd = (req.body.command || '').trim()

  if (cmd && bot) {
    bot.chat(cmd)
    update('ส่งคำสั่ง: ' + cmd)
  }

  res.json({ ok: true })
})

app.post('/config', (req, res) => {
  config.host = req.body.host || config.host
  config.port = Number(req.body.port || config.port)
  config.username = req.body.username || config.username

  createBot()

  res.json({ ok: true })
})

io.on('connection', () => {
  update()
})

const PORT = process.env.PORT || 3000

server.listen(PORT, () => {
  console.log('Dashboard running on port', PORT)
  createBot()
})
