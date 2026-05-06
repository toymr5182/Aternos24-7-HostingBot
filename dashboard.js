const express = require('express')
const bot = require('./bot')

const app = express()

app.use(express.urlencoded({ extended: true }))

app.get('/', (req, res) => {
  res.send(`
  <html>
  <head>
    <title>MC Dashboard</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="3" />
    <style>
      body{
        margin:0;
        font-family:Arial,sans-serif;
        background:#0f172a;
        color:#fff;
      }
      .wrap{
        max-width:900px;
        margin:auto;
        padding:20px;
      }
      .card{
        background:#1e293b;
        border-radius:14px;
        padding:16px;
        margin-bottom:16px;
        box-shadow:0 4px 16px rgba(0,0,0,.25);
      }
      h1{
        margin-top:0;
      }
      input{
        width:70%;
        padding:12px;
        border:none;
        border-radius:8px;
      }
      button{
        padding:12px 16px;
        border:none;
        border-radius:8px;
        cursor:pointer;
        margin-right:8px;
      }
      pre{
        white-space:pre-wrap;
        word-wrap:break-word;
        max-height:420px;
        overflow:auto;
        font-size:13px;
        line-height:1.45;
      }
      .status{
        color:#22c55e;
        font-weight:bold;
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>Minecraft AFK Bot</h1>

      <div class="card">
        <div><b>Status:</b> <span class="status">${bot.state.status}</span></div>
        <div><b>Server:</b> ${bot.config.host}:${bot.config.port}</div>
        <div><b>Username:</b> ${bot.config.username}</div>
        <div><b>Uptime:</b> ${bot.getUptime()}</div>
        <div><b>Auto Jump:</b> ${bot.state.autoJump ? 'ON' : 'OFF'}</div>
      </div>

      <div class="card">
        <form method="POST" action="/send">
          <input name="cmd" placeholder="พิมพ์คำสั่งหรือข้อความ" />
          <button type="submit">Send</button>
        </form>
      </div>

      <div class="card">
        <form method="POST" action="/reconnect">
          <button type="submit">Reconnect</button>
        </form>
      </div>

      <div class="card">
        <h3>Live Chat / Server Log</h3>
        <pre>${bot.chatLog.join('\n')}</pre>
      </div>
    </div>
  </body>
  </html>
  `)
})

app.post('/send', (req, res) => {
  const cmd = String(req.body.cmd || '').trim()
  if (cmd) bot.sendChat(cmd)
  res.redirect('/')
})

app.post('/reconnect', (req, res) => {
  bot.reconnect()
  res.redirect('/')
})

app.listen(3000, '0.0.0.0', () => {
  console.log('Dashboard running on port 3000')
})
