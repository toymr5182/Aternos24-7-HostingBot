const express = require('express')

const {
  createBot,
  sendCommand,
  reconnectBot,
  state,
  config,
  chatLog,
  getUptime
} = require('./index')

const app = express()

app.use(express.urlencoded({ extended: true }))

app.get('/', (req, res) => {
  res.send(`
  <html>
  <head>
    <title>MC Bot Dashboard</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="5" />
    <style>
      body {
        margin: 0;
        font-family: Arial, sans-serif;
        background: #0f172a;
        color: white;
        padding: 20px;
      }

      .wrap {
        max-width: 900px;
        margin: auto;
      }

      .card {
        background: #1e293b;
        border-radius: 14px;
        padding: 16px;
        margin-bottom: 16px;
        box-shadow: 0 6px 20px rgba(0,0,0,.25);
      }

      h1 {
        margin-top: 0;
      }

      input {
        width: 72%;
        padding: 12px;
        border: 0;
        border-radius: 10px;
        font-size: 15px;
      }

      button {
        padding: 12px 16px;
        border: 0;
        border-radius: 10px;
        font-size: 15px;
        cursor: pointer;
      }

      .btn {
        margin-right: 8px;
        margin-top: 8px;
      }

      pre {
        white-space: pre-wrap;
        word-break: break-word;
        max-height: 420px;
        overflow: auto;
        background: #020617;
        padding: 12px;
        border-radius: 10px;
      }

      .status {
        color: #22c55e;
      }
    </style>
  </head>

  <body>
    <div class="wrap">

      <h1>Minecraft AFK Bot</h1>

      <div class="card">
        <b>Status:</b> <span class="status">${state.status}</span><br>
        <b>Server:</b> ${config.host}:${config.port}<br>
        <b>Username:</b> ${config.username}<br>
        <b>Uptime:</b> ${getUptime()}<br>
        <b>Auto Jump:</b> ${state.autoJump ? 'ON' : 'OFF'}
      </div>

      <div class="card">
        <form method="POST" action="/command">
          <input name="cmd" placeholder="พิมพ์คำสั่งในเกม" />
          <button type="submit">Send</button>
        </form>
      </div>

      <div class="card">
        <form method="POST" action="/afk/on" style="display:inline">
          <button class="btn">AFK ON</button>
        </form>

        <form method="POST" action="/afk/off" style="display:inline">
          <button class="btn">AFK OFF</button>
        </form>

        <form method="POST" action="/reconnect" style="display:inline">
          <button class="btn">Reconnect</button>
        </form>
      </div>

      <div class="card">
        <b>Live Chat / Server Log</b>
        <pre>${chatLog.join('\n')}</pre>
      </div>

    </div>
  </body>
  </html>
  `)
})

app.post('/command', (req, res) => {
  const cmd = String(req.body.cmd || '').trim()
  if (cmd) sendCommand(cmd)
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
  reconnectBot()
  res.redirect('/')
})

const PORT = process.env.PORT || 3000

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Dashboard running on port ${PORT}`)
})

createBot()
