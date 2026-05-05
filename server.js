const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const MinecraftBot = require('./bot');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize bot
const bot = new MinecraftBot({
  host: process.env.MC_HOST || 'play.amorycraft.com',
  port: parseInt(process.env.MC_PORT || '25565'),
  username: process.env.MC_USERNAME || 'EERTO',
});

// Forward bot events to all connected dashboard clients
bot.on('log', (entry) => io.emit('log', entry));
bot.on('connected', () => io.emit('status', bot.getStatus()));
bot.on('disconnected', (reason) => io.emit('status', { ...bot.getStatus(), disconnectReason: reason }));
bot.on('reconnecting', (data) => io.emit('reconnecting', data));
bot.on('chat', (data) => io.emit('chat', data));
bot.on('command', (cmd) => io.emit('command', cmd));

// REST API
app.get('/api/status', (req, res) => res.json(bot.getStatus()));
app.get('/api/logs', (req, res) => res.json(bot.logs));

app.post('/api/connect', (req, res) => {
  const { host, port, username } = req.body;
  if (host || port || username) {
    bot.updateConfig({ host, port: parseInt(port) || 25565, username });
  }
  bot.shouldReconnect = true;
  bot.connect();
  res.json({ success: true, message: 'กำลังเชื่อมต่อ...' });
});

app.post('/api/disconnect', (req, res) => {
  bot.disconnect();
  res.json({ success: true, message: 'ตัดการเชื่อมต่อแล้ว' });
});

app.post('/api/command', (req, res) => {
  const { command } = req.body;
  if (!command) return res.status(400).json({ success: false, message: 'ไม่มีคำสั่ง' });
  const result = bot.runCommand(command);
  res.json({ success: result, message: result ? `รันคำสั่ง: ${command}` : 'ไม่สามารถรันคำสั่งได้' });
});

// Socket.IO
io.on('connection', (socket) => {
  console.log('Dashboard เชื่อมต่อแล้ว:', socket.id);
  socket.emit('status', bot.getStatus());
  socket.emit('logs', bot.logs);

  socket.on('command', (command) => {
    bot.runCommand(command);
  });

  socket.on('disconnect', () => {
    console.log('Dashboard ตัดการเชื่อมต่อ:', socket.id);
  });
});

// Auto-start bot
bot.connect();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🎮 Minecraft AFK Bot Dashboard รันอยู่ที่ http://localhost:${PORT}`);
});
