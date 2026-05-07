const mineflayer = require('mineflayer')
const readline = require('readline')
const express = require('express')
const http = require('http')
const { Server } = require('socket.io')

/* ===========================
   CONFIG
=========================== */

let bot
let rl
let afkInterval
let drawInterval
let reconnectTimer = null

const config = {
  host: 'play.amorycraft.com',
  port: 25565,
  username: 'EERTO'
}

const state = {
  status: 'starting',
  autoJump: true,
  lastMessage: '-',
  connectedAt: null,
  reconnectCountdown: null
}

// ===== LOG SYSTEM =====
const MAX_LOGS = 200
const logs = []

function addLog(type, msg) {
  const entry = {
    time: new Date().toLocaleTimeString('th-TH', { hour12: false }),
    type,   // 'INFO' | 'CHAT' | 'WHISPER' | 'SERVER' | 'ERROR' | 'SYSTEM'
    msg: String(msg || '')
  }
  logs.push(entry)
  if (logs.length > MAX_LOGS) logs.shift()

  // Push to all connected browsers via Socket.IO
  if (io) io.emit('log', entry)

  return entry
}

/* ===========================
   HELPERS
=========================== */

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
  for (let i = 0; i < msg.length; i += width) lines.push(msg.slice(i, i + width))
  while (lines.length < 2) lines.push('')
  return lines.slice(0, 2)
}

function setMessage(msg) {
  state.lastMessage = msg
  if (rl) draw()
}

/* ===========================
   TERMINAL UI (LOCAL ONLY)
=========================== */

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

/* ===========================
   ANTI-BOT / CAPTCHA HANDLER
=========================== */

// คำที่มักใช้ใน anti-bot challenge
const ANTIBOT_TRIGGERS = [
  /please type/i,
  /type the word/i,
  /enter the code/i,
  /verification/i,
  /captcha/i,
  /anti.?bot/i,
  /กรอก/,
  /ยืนยัน/,
  /พิมพ์/,
  /register/i,
  /\/register/i,
  /\/login/i,
  /\/l /i,
  /password/i
]

function checkAntiBotMessage(msg) {
  const text = String(msg)
  for (const pattern of ANTIBOT_TRIGGERS) {
    if (pattern.test(text)) {
      addLog('SYSTEM', `[ANTI-BOT DETECTED] ${text}`)
      setMessage(`[!] Anti-bot detected! กรุณาส่งคำตอบผ่าน Dashboard`)
      // แจ้งผ่าน Socket.IO ให้หน้าเว็บโชว์ alert
      if (io) io.emit('antibot', { message: text })
      return true
    }
  }
  return false
}

/* ===========================
   BOT CORE
=========================== */

function createBot() {
  if (afkInterval) clearInterval(afkInterval)
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }

  state.status = 'connecting'
  state.connectedAt = null
  addLog('SYSTEM', `กำลังเชื่อมต่อ ${config.host}:${config.port} ...`)
  if (rl) draw()

  bot = mineflayer.createBot({
    host: config.host,
    port: config.port,
    username: config.username,
    version: false,
    hideErrors: false
  })

  bot.once('spawn', () => {
    state.status = 'online'
    state.connectedAt = Date.now()
    addLog('SYSTEM', 'เข้าเซิร์ฟแล้ว!')
    setMessage('เข้าเซิร์ฟแล้ว')

    if (io) io.emit('status', getStatusPayload())

    setTimeout(() => {
      if (bot) {
        bot.chat('/smp')
        addLog('INFO', 'รันคำสั่งอัตโนมัติ: /smp')
        setMessage('รันคำสั่งอัตโนมัติ: /smp')
      }
    }, 2500)
  })

  bot.on('chat', (username, message) => {
    if (username === bot.username) return
    const line = `${username}: ${message}`
    addLog('CHAT', line)
    setMessage(`[CHAT] ${line}`)
    checkAntiBotMessage(message)
  })

  bot.on('whisper', (username, message) => {
    if (username === bot.username) return
    const line = `${username}: ${message}`
    addLog('WHISPER', line)
    setMessage(`[WHISPER] ${line}`)
    checkAntiBotMessage(message)
  })

  bot.on('message', (jsonMsg) => {
    const text = stringifyMsg(jsonMsg)
    addLog('SERVER', text)
    setMessage(`[SERVER] ${text}`)
    checkAntiBotMessage(text)
  })

  // AFK jump loop
  afkInterval = setInterval(() => {
    if (!bot?.entity || !state.autoJump) return
    bot.setControlState('jump', true)
    setTimeout(() => { if (bot) bot.setControlState('jump', false) }, 400)
  }, 30000)

  bot.on('kicked', (reason) => {
    const text = stringifyMsg(reason)
    state.status = 'kicked'
    addLog('ERROR', `KICKED: ${text}`)
    setMessage(`[KICKED] ${text}`)
    if (io) io.emit('status', getStatusPayload())
  })

  bot.on('end', () => {
    state.status = 'offline'
    addLog('SYSTEM', 'หลุดจากเซิร์ฟ กำลัง reconnect ใน 5 วินาที...')
    setMessage('หลุดจากเซิร์ฟ กำลัง reconnect ใน 5 วินาที...')
    if (io) io.emit('status', getStatusPayload())

    let countdown = 5
    state.reconnectCountdown = countdown
    const tick = setInterval(() => {
      countdown--
      state.reconnectCountdown = countdown
      if (io) io.emit('countdown', countdown)
      if (countdown <= 0) clearInterval(tick)
    }, 1000)

    reconnectTimer = setTimeout(() => {
      state.reconnectCountdown = null
      createBot()
    }, 5000)
  })

  bot.on('error', (err) => {
    const msg = err?.message || String(err)
    state.status = 'error'
    addLog('ERROR', msg)
    setMessage(`[ERROR] ${msg}`)
    if (io) io.emit('status', getStatusPayload())
  })
}

/* ===========================
   EXPRESS + SOCKET.IO SERVER
=========================== */

const app = express()
const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })

app.use(express.urlencoded({ extended: true }))
app.use(express.json())

// ---- Socket.IO events ----
io.on('connection', (socket) => {
  // ส่ง state + logs ทันทีที่ browser เชื่อมต่อ
  socket.emit('init', { status: getStatusPayload(), logs })
})

function getStatusPayload() {
  return {
    status: state.status,
    host: config.host,
    port: config.port,
    username: config.username,
    uptime: getUptime(),
    autoJump: state.autoJump,
    lastMessage: state.lastMessage
  }
}

// ---- Push uptime every second ----
setInterval(() => {
  if (io) io.emit('uptime', getUptime())
}, 1000)

// ===== DASHBOARD HTML =====
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>AFK Bot Dashboard</title>
<script src="/socket.io/socket.io.js"></script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@400;600;700&display=swap');

  :root{
    --bg:#0a0e1a;
    --surface:#111827;
    --surface2:#1a2235;
    --border:#1e3a5f;
    --accent:#00d4ff;
    --accent2:#00ff9d;
    --warn:#ff6b35;
    --danger:#ff3b5c;
    --text:#c9d1e0;
    --dim:#4a5568;
    --mono:'Share Tech Mono',monospace;
    --sans:'Rajdhani',sans-serif;
  }

  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--bg);color:var(--text);font-family:var(--sans);min-height:100vh;padding:16px}

  /* Scanline overlay */
  body::before{
    content:'';position:fixed;inset:0;
    background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,212,255,.015) 2px,rgba(0,212,255,.015) 4px);
    pointer-events:none;z-index:999
  }

  h1{
    font-size:1.4rem;letter-spacing:.3em;color:var(--accent);
    text-transform:uppercase;margin-bottom:16px;
    display:flex;align-items:center;gap:10px
  }
  h1 .dot{
    width:10px;height:10px;border-radius:50%;background:var(--accent2);
    animation:blink 1s step-end infinite
  }
  @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}

  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
  @media(max-width:640px){.grid{grid-template-columns:1fr}}

  .card{
    background:var(--surface);border:1px solid var(--border);
    border-radius:6px;padding:14px;position:relative;overflow:hidden
  }
  .card::before{
    content:'';position:absolute;top:0;left:0;right:0;height:1px;
    background:linear-gradient(90deg,transparent,var(--accent),transparent)
  }
  .card-title{
    font-size:.65rem;letter-spacing:.2em;color:var(--dim);
    text-transform:uppercase;margin-bottom:10px
  }

  /* Status badge */
  .status-badge{
    display:inline-block;padding:3px 10px;border-radius:3px;
    font-family:var(--mono);font-size:.8rem;font-weight:600;
    letter-spacing:.1em;text-transform:uppercase
  }
  .s-online{background:rgba(0,255,157,.1);color:var(--accent2);border:1px solid var(--accent2)}
  .s-offline,.s-error,.s-kicked{background:rgba(255,59,92,.1);color:var(--danger);border:1px solid var(--danger)}
  .s-connecting,.s-starting{background:rgba(0,212,255,.1);color:var(--accent);border:1px solid var(--accent);animation:pulse .8s ease-in-out infinite alternate}
  @keyframes pulse{from{opacity:.6}to{opacity:1}}

  .info-row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04)}
  .info-row:last-child{border-bottom:none}
  .info-label{font-size:.75rem;color:var(--dim);letter-spacing:.05em}
  .info-val{font-family:var(--mono);font-size:.8rem;color:var(--text)}

  /* Controls */
  .btn-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
  button{
    font-family:var(--sans);font-weight:600;font-size:.85rem;
    letter-spacing:.05em;padding:8px 16px;border:1px solid;
    border-radius:4px;cursor:pointer;transition:all .15s;
    text-transform:uppercase;background:transparent
  }
  .btn-primary{color:var(--accent);border-color:var(--accent)}
  .btn-primary:hover{background:rgba(0,212,255,.12)}
  .btn-success{color:var(--accent2);border-color:var(--accent2)}
  .btn-success:hover{background:rgba(0,255,157,.12)}
  .btn-danger{color:var(--danger);border-color:var(--danger)}
  .btn-danger:hover{background:rgba(255,59,92,.12)}
  .btn-warn{color:var(--warn);border-color:var(--warn)}
  .btn-warn:hover{background:rgba(255,107,53,.12)}

  /* Chat input */
  .input-row{display:flex;gap:8px;margin-top:8px}
  input[type=text]{
    flex:1;background:var(--surface2);border:1px solid var(--border);
    color:var(--text);font-family:var(--mono);font-size:.85rem;
    padding:8px 12px;border-radius:4px;outline:none;
    transition:border-color .15s
  }
  input[type=text]:focus{border-color:var(--accent)}

  /* LOG PANEL */
  #log-panel{
    background:var(--surface);border:1px solid var(--border);
    border-radius:6px;overflow:hidden
  }
  .log-header{
    display:flex;justify-content:space-between;align-items:center;
    padding:10px 14px;border-bottom:1px solid var(--border)
  }
  .log-header-title{font-size:.65rem;letter-spacing:.2em;color:var(--dim);text-transform:uppercase}
  #log-box{
    height:320px;overflow-y:auto;padding:8px 10px;
    font-family:var(--mono);font-size:.72rem;line-height:1.7;
    scrollbar-width:thin;scrollbar-color:var(--border) transparent
  }
  #log-box::-webkit-scrollbar{width:4px}
  #log-box::-webkit-scrollbar-track{background:transparent}
  #log-box::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}

  .log-entry{display:flex;gap:8px;padding:1px 0}
  .log-time{color:var(--dim);flex-shrink:0;min-width:56px}
  .log-type{flex-shrink:0;min-width:62px;text-align:right}
  .log-msg{color:var(--text);word-break:break-all}

  .t-INFO{color:var(--accent)}
  .t-CHAT{color:var(--accent2)}
  .t-WHISPER{color:#d97bff}
  .t-SERVER{color:#60a5fa}
  .t-ERROR{color:var(--danger)}
  .t-SYSTEM{color:var(--warn)}

  /* Anti-bot alert overlay */
  #antibot-alert{
    display:none;position:fixed;inset:0;background:rgba(0,0,0,.8);
    z-index:1000;align-items:center;justify-content:center
  }
  #antibot-alert.show{display:flex}
  .alert-box{
    background:var(--surface);border:2px solid var(--danger);
    border-radius:8px;padding:24px;max-width:480px;width:90%;
    box-shadow:0 0 40px rgba(255,59,92,.3)
  }
  .alert-box h2{color:var(--danger);font-size:1.1rem;margin-bottom:8px;letter-spacing:.1em}
  .alert-msg{font-family:var(--mono);font-size:.8rem;color:#fca5a5;
    background:rgba(255,59,92,.08);border:1px solid rgba(255,59,92,.2);
    padding:10px;border-radius:4px;margin:10px 0;word-break:break-all}
  .alert-input{display:flex;gap:8px;margin-top:12px}
</style>
</head>
<body>

<!-- Anti-bot alert overlay -->
<div id="antibot-alert">
  <div class="alert-box">
    <h2>⚠ ANTI-BOT DETECTED</h2>
    <p style="font-size:.85rem;color:var(--dim)">เซิร์ฟตรวจจับบอท กรุณาตอบคำถาม/ส่ง command:</p>
    <div class="alert-msg" id="antibot-msg">-</div>
    <div class="alert-input">
      <input type="text" id="antibot-cmd" placeholder="/register pass pass หรือ /login pass"/>
      <button class="btn-warn" onclick="sendAntibotCmd()">SEND</button>
    </div>
    <div style="margin-top:10px">
      <button class="btn-danger" onclick="closeAntibotAlert()" style="font-size:.75rem;padding:5px 12px">ปิด</button>
    </div>
  </div>
</div>

<h1><span class="dot"></span>AFK Bot Dashboard</h1>

<div class="grid">
  <!-- Status card -->
  <div class="card">
    <div class="card-title">Status</div>
    <div style="margin-bottom:12px">
      <span class="status-badge" id="status-badge">-</span>
    </div>
    <div class="info-row">
      <span class="info-label">Server</span>
      <span class="info-val">${config.host}:${config.port}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Username</span>
      <span class="info-val">${config.username}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Uptime</span>
      <span class="info-val" id="uptime-val">-</span>
    </div>
    <div class="info-row">
      <span class="info-label">Auto Jump</span>
      <span class="info-val" id="autojump-val">-</span>
    </div>
    <div class="info-row">
      <span class="info-label">Last Event</span>
      <span class="info-val" id="last-msg" style="font-size:.72rem;max-width:200px;text-align:right;word-break:break-all">-</span>
    </div>
  </div>

  <!-- Controls card -->
  <div class="card">
    <div class="card-title">Controls</div>

    <div style="font-size:.75rem;color:var(--dim);margin-bottom:6px">ส่ง Chat / Command</div>
    <div class="input-row">
      <input type="text" id="cmd-input" placeholder="พิมพ์ข้อความหรือ /command ..." onkeydown="if(event.key==='Enter')sendCmd()"/>
      <button class="btn-primary" onclick="sendCmd()">SEND</button>
    </div>

    <div class="btn-row" style="margin-top:14px">
      <button class="btn-success" onclick="postAction('/afk/on')">AFK ON</button>
      <button class="btn-danger" onclick="postAction('/afk/off')">AFK OFF</button>
      <button class="btn-warn" onclick="postAction('/reconnect')">RECONNECT</button>
      <button class="btn-primary" onclick="clearLogs()">CLEAR LOG</button>
    </div>
  </div>
</div>

<!-- Log panel -->
<div id="log-panel">
  <div class="log-header">
    <span class="log-header-title">Live Log</span>
    <span id="log-count" style="font-family:var(--mono);font-size:.72rem;color:var(--dim)">0 entries</span>
  </div>
  <div id="log-box"></div>
</div>

<script>
  const socket = io()
  const logBox = document.getElementById('log-box')
  let logCount = 0
  let autoScroll = true

  logBox.addEventListener('scroll', () => {
    autoScroll = logBox.scrollTop + logBox.clientHeight >= logBox.scrollHeight - 20
  })

  function typeClass(t){
    return {INFO:'t-INFO',CHAT:'t-CHAT',WHISPER:'t-WHISPER',SERVER:'t-SERVER',ERROR:'t-ERROR',SYSTEM:'t-SYSTEM'}[t]||'t-INFO'
  }

  function appendLog(entry){
    const el = document.createElement('div')
    el.className = 'log-entry'
    el.innerHTML = \`<span class="log-time">\${entry.time}</span><span class="log-type \${typeClass(entry.type)}">\${entry.type}</span><span class="log-msg">\${escHtml(entry.msg)}</span>\`
    logBox.appendChild(el)
    logCount++
    document.getElementById('log-count').textContent = logCount + ' entries'
    if(autoScroll) logBox.scrollTop = logBox.scrollHeight
    // keep max 300 DOM entries
    while(logBox.children.length > 300) logBox.removeChild(logBox.firstChild)
  }

  function escHtml(s){
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  }

  function applyStatus(s){
    const badge = document.getElementById('status-badge')
    badge.textContent = s.status
    badge.className = 'status-badge s-' + s.status
    document.getElementById('uptime-val').textContent = s.uptime
    document.getElementById('autojump-val').textContent = s.autoJump ? 'ON ✓' : 'OFF'
    document.getElementById('last-msg').textContent = s.lastMessage
  }

  socket.on('init', ({status, logs}) => {
    logBox.innerHTML = ''
    logCount = 0
    logs.forEach(appendLog)
    applyStatus(status)
  })

  socket.on('log', appendLog)
  socket.on('status', applyStatus)
  socket.on('uptime', (u) => { document.getElementById('uptime-val').textContent = u })
  socket.on('countdown', (n) => {
    if(n > 0) document.getElementById('uptime-val').textContent = 'reconnect in ' + n + 's'
  })

  // Anti-bot overlay
  socket.on('antibot', ({message}) => {
    document.getElementById('antibot-msg').textContent = message
    document.getElementById('antibot-alert').classList.add('show')
    document.getElementById('antibot-cmd').focus()
  })

  function closeAntibotAlert(){
    document.getElementById('antibot-alert').classList.remove('show')
  }

  function sendAntibotCmd(){
    const v = document.getElementById('antibot-cmd').value.trim()
    if(!v) return
    fetch('/command', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cmd:v})})
    document.getElementById('antibot-cmd').value = ''
    closeAntibotAlert()
  }

  function sendCmd(){
    const inp = document.getElementById('cmd-input')
    const v = inp.value.trim()
    if(!v) return
    fetch('/command', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cmd:v})})
    inp.value = ''
  }

  function postAction(path){
    fetch(path, {method:'POST'})
  }

  function clearLogs(){
    logBox.innerHTML = ''
    logCount = 0
    document.getElementById('log-count').textContent = '0 entries'
  }
</script>
</body>
</html>`)
})

// ---- API endpoints (JSON-friendly) ----
app.post('/command', (req, res) => {
  const msg = String(req.body.cmd || '').trim()
  if (msg && bot && bot.chat) {
    bot.chat(msg)
    addLog('INFO', `ส่ง: ${msg}`)
    setMessage(`ส่ง: ${msg}`)
  }
  res.json({ ok: true })
})

app.post('/afk/on', (req, res) => {
  state.autoJump = true
  addLog('SYSTEM', 'เปิด Auto Jump')
  setMessage('เปิด auto jump แล้ว')
  if (io) io.emit('status', getStatusPayload())
  res.json({ ok: true })
})

app.post('/afk/off', (req, res) => {
  state.autoJump = false
  addLog('SYSTEM', 'ปิด Auto Jump')
  setMessage('ปิด auto jump แล้ว')
  if (io) io.emit('status', getStatusPayload())
  res.json({ ok: true })
})

app.post('/reconnect', (req, res) => {
  addLog('SYSTEM', 'Manual reconnect')
  try { bot.end() } catch {}
  res.json({ ok: true })
})

app.get('/status', (req, res) => res.json(getStatusPayload()))
app.get('/logs', (req, res) => res.json(logs))

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  addLog('SYSTEM', `Web dashboard: http://localhost:${PORT}`)
  console.log(`Web dashboard running on http://localhost:${PORT}`)
})

/* ===========================
   LOCAL TERMINAL (VPS SSH)
=========================== */

if (process.env.NO_TUI !== '1') {
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> '
  })

  // redraw uptime in terminal
  drawInterval = setInterval(draw, 5000)

  rl.on('line', (line) => {
    const msg = line.trim()
    if (!msg) { draw(); return }

    if (msg === '/afk on')  { state.autoJump = true;  setMessage('เปิด auto jump'); return }
    if (msg === '/afk off') { state.autoJump = false; setMessage('ปิด auto jump'); return }
    if (msg === '/reconnect') {
      try { bot.end() } catch {}
      return
    }
    if (msg === '/logs') {
      logs.slice(-20).forEach(l => console.log(`[${l.time}] [${l.type}] ${l.msg}`))
      rl.prompt(true)
      return
    }
    if (bot && bot.chat) {
      bot.chat(msg)
      addLog('INFO', `ส่ง: ${msg}`)
      setMessage(`ส่ง: ${msg}`)
    }
    draw()
  })

  draw()
}

createBot()
