const mineflayer = require('mineflayer') const express = require('express')

let bot let afkInterval const chatLog = []

const config = { host: 'play.amorycraft.com', port: 25565, username: 'EERTO', password: 'a12345' }

const state = { status: 'starting', autoJump: true, lastMessage: '-', connectedAt: null }

function addLog(msg) { const line = [${new Date().toLocaleTimeString()}] ${msg} chatLog.unshift(line) if (chatLog.length > 80) chatLog.pop() state.lastMessage = msg console.log(line) }

function getUptime() { if (!state.connectedAt) return '-' const sec = Math.floor((Date.now() - state.connectedAt) / 1000) const h = Math.floor(sec / 3600) const m = Math.floor((sec % 3600) / 60) const s = sec % 60 return ${h}h ${m}m ${s}s }

function runLoginSequence() { if (!bot) return setTimeout(() => { if (bot) { bot.chat(/login ${config.password}) addLog(AUTO: /login ${config.password}) } }, 2000)

setTimeout(() => { if (bot) { bot.chat('/smp') addLog('AUTO: /smp') } }, 4500) }

function createBot() { if (afkInterval) clearInterval(afkInterval)

state.status = 'connecting' addLog('กำลังเชื่อมต่อ...')

bot = mineflayer.createBot({ host: config.host, port: config.port, username: config.username, version: false })

bot.once('spawn', () => { state.status = 'online' state.connectedAt = Date.now() addLog('เข้าเซิร์ฟแล้ว') runLoginSequence() })

bot.on('chat', (username, message) => { if (username !== bot.username) addLog([CHAT] ${username}: ${message}) })

bot.on('whisper', (username, message) => { if (username !== bot.username) addLog([WHISPER] ${username}: ${message}) })

bot.on('messagestr', (msg) => addLog([SERVER] ${msg}))

afkInterval = setInterval(() => { if (!bot?.entity || !state.autoJump) return bot.setControlState('jump', true) setTimeout(() => bot && bot.setControlState('jump', false), 400) }, 30000)

bot.on('kicked', (reason) => { state.status = 'kicked' addLog([KICKED] ${String(reason)}) })

bot.on('end', () => { state.status = 'offline' addLog('หลุดจากเซิร์ฟ กำลัง reconnect ใน 5 วินาที...') setTimeout(createBot, 5000) })

bot.on('error', (err) => { state.status = 'error' addLog([ERROR] ${err?.message || String(err)}) }) }

const app = express() app.use(express.urlencoded({ extended: true }))

app.get('/', (req, res) => { res.send(`

  <html>
  <head>
    <title>MC Bot Dashboard</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font-family: Arial; max-width: 900px; margin: 20px auto; padding: 12px; }
      .box { border: 1px solid #ccc; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
      input, button { padding: 10px; font-size: 15px; }
      pre { white-space: pre-wrap; max-height: 400px; overflow: auto; }
    </style>
  </head>
  <body>
    <h2>Minecraft AFK Bot</h2><div class="box">
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
})app.post('/command', (req, res) => { const cmd = String(req.body.cmd || '').trim() if (cmd && bot) { bot.chat(cmd) addLog([YOU] ${cmd}) } res.redirect('/') })

app.post('/afk/on', (req, res) => { state.autoJump = true addLog('เปิด auto jump') res.redirect('/') })

app.post('/afk/off', (req, res) => { state.autoJump = false addLog('ปิด auto jump') res.redirect('/') })

app.post('/reconnect', (req, res) => { try { bot.end() } catch {} createBot() res.redirect('/') })

const PORT = process.env.PORT || 3000 app.listen(PORT, '0.0.0.0', () => { console.log(Dashboard running on ${PORT}) })

createBot()
