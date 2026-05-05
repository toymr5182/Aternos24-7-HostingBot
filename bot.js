const mineflayer = require('mineflayer');
const EventEmitter = require('events');

class MinecraftBot extends EventEmitter {
  constructor(config) {
    super();
    this.config = {
      host: config.host || 'play.amorycraft.com',
      port: config.port || 25565,
      username: config.username || 'EERTO',
      version: config.version || false,
      auth: 'offline',
    };
    this.bot = null;
    this.reconnectDelay = 5000;
    this.maxReconnectDelay = 60000;
    this.reconnectAttempts = 0;
    this.isConnected = false;
    this.shouldReconnect = true;
    this.logs = [];
    this.stats = {
      totalReconnects: 0,
      connectedSince: null,
      lastDisconnect: null,
    };
  }

  log(message, type = 'info') {
    const entry = {
      timestamp: new Date().toISOString(),
      message,
      type,
    };
    this.logs.push(entry);
    if (this.logs.length > 500) this.logs.shift();
    this.emit('log', entry);
    console.log(`[${entry.timestamp}] [${type.toUpperCase()}] ${message}`);
  }

  connect() {
    if (this.bot) {
      try { this.bot.quit(); } catch (e) {}
      this.bot = null;
    }

    this.log(`กำลังเชื่อมต่อไปยัง ${this.config.host}:${this.config.port} ในชื่อ ${this.config.username}...`, 'info');

    try {
      this.bot = mineflayer.createBot(this.config);
      this.setupEvents();
    } catch (err) {
      this.log(`ไม่สามารถสร้าง bot ได้: ${err.message}`, 'error');
      this.scheduleReconnect();
    }
  }

  setupEvents() {
    this.bot.on('login', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 5000;
      this.stats.connectedSince = new Date().toISOString();
      this.log(`เชื่อมต่อสำเร็จ! เข้าสู่เซิร์ฟเวอร์แล้ว`, 'success');
      this.emit('connected');

      // Auto-login sequence on reconnect
      if (this.stats.totalReconnects > 0) {
        this.log('กำลังรันคำสั่ง auto-login...', 'info');
        setTimeout(() => {
          this.runCommand('/login a12345');
        }, 2000);
        setTimeout(() => {
          this.runCommand('/smp');
        }, 4000);
      }
    });

    this.bot.on('spawn', () => {
      this.log('Bot spawn แล้ว เริ่ม AFK...', 'info');
      this.emit('spawned');
    });

    this.bot.on('chat', (username, message) => {
      this.log(`[CHAT] <${username}> ${message}`, 'chat');
      this.emit('chat', { username, message });
    });

    this.bot.on('kicked', (reason) => {
      let reasonText = reason;
      try {
        const parsed = JSON.parse(reason);
        reasonText = parsed.text || parsed.translate || reason;
      } catch (e) {}
      this.isConnected = false;
      this.stats.lastDisconnect = new Date().toISOString();
      this.log(`ถูกเตะออก: ${reasonText}`, 'warn');
      this.emit('disconnected', reasonText);
      if (this.shouldReconnect) this.scheduleReconnect();
    });

    this.bot.on('end', (reason) => {
      this.isConnected = false;
      this.stats.lastDisconnect = new Date().toISOString();
      this.log(`การเชื่อมต่อสิ้นสุด: ${reason || 'ไม่ทราบสาเหตุ'}`, 'warn');
      this.emit('disconnected', reason);
      if (this.shouldReconnect) this.scheduleReconnect();
    });

    this.bot.on('error', (err) => {
      this.log(`เกิดข้อผิดพลาด: ${err.message}`, 'error');
      this.emit('error', err.message);
    });
  }

  scheduleReconnect() {
    this.stats.totalReconnects++;
    const delay = Math.min(this.reconnectDelay, this.maxReconnectDelay);
    this.log(`จะ reconnect ใน ${delay / 1000} วินาที... (ครั้งที่ ${this.stats.totalReconnects})`, 'info');
    this.emit('reconnecting', { delay, attempt: this.stats.totalReconnects });
    setTimeout(() => {
      if (this.shouldReconnect) this.connect();
    }, delay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay);
  }

  runCommand(command) {
    if (!this.bot || !this.isConnected) {
      this.log(`ไม่สามารถรันคำสั่ง "${command}": ยังไม่ได้เชื่อมต่อ`, 'error');
      return false;
    }
    try {
      this.bot.chat(command);
      this.log(`รันคำสั่ง: ${command}`, 'command');
      this.emit('command', command);
      return true;
    } catch (err) {
      this.log(`ไม่สามารถรันคำสั่ง: ${err.message}`, 'error');
      return false;
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    this.isConnected = false;
    if (this.bot) {
      try { this.bot.quit('Manual disconnect'); } catch (e) {}
      this.bot = null;
    }
    this.log('ตัดการเชื่อมต่อด้วยตนเอง', 'warn');
    this.emit('disconnected', 'Manual disconnect');
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig, auth: 'offline' };
    this.log(`อัพเดทการตั้งค่า: host=${this.config.host}, username=${this.config.username}`, 'info');
  }

  getStatus() {
    return {
      isConnected: this.isConnected,
      shouldReconnect: this.shouldReconnect,
      config: { host: this.config.host, port: this.config.port, username: this.config.username },
      stats: this.stats,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

module.exports = MinecraftBot;
