# ⛏ Minecraft AFK Bot Dashboard

Bot AFK สำหรับ Minecraft พร้อม Web Dashboard รองรับการ deploy บน Render.com

## Features
- ✅ AFK Bot ที่ออนไลน์ตลอดเวลา
- ✅ Web Dashboard สวยงาม (real-time via Socket.IO)
- ✅ ระบบ Auto-Reconnect พร้อมรัน `/login a12345` และ `/smp` อัตโนมัติ
- ✅ Log แบบ real-time
- ✅ รันคำสั่ง Minecraft ผ่านเว็บ
- ✅ ตั้งค่า Host/Port/Username ได้

## วิธี Deploy บน Render.com

### 1. Push ขึ้น GitHub

```bash
git init
git add .
git commit -m "Initial commit: Minecraft AFK Bot"
git remote add origin https://github.com/YOUR_USERNAME/minecraft-afk-bot.git
git push -u origin main
```

### 2. สร้าง Web Service บน Render

1. ไปที่ [render.com](https://render.com) → **New** → **Web Service**
2. เชื่อม GitHub repository ของคุณ
3. ตั้งค่าดังนี้:

| Setting | Value |
|---|---|
| **Name** | minecraft-afk-bot |
| **Environment** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Plan** | Free (หรือ Starter สำหรับไม่หลับ) |

### 3. Environment Variables (ไม่จำเป็น — มีค่า default แล้ว)

| Variable | Default | Description |
|---|---|---|
| `MC_HOST` | `play.amorycraft.com` | IP เซิร์ฟเวอร์ |
| `MC_PORT` | `25565` | พอร์ต |
| `MC_USERNAME` | `EERTO` | ชื่อ bot |
| `PORT` | `3000` | พอร์ต web (Render ตั้งเอง) |

### 4. เปิด Dashboard

หลัง deploy เสร็จ → เปิด URL ที่ Render ให้มา เช่น `https://minecraft-afk-bot.onrender.com`

## ⚠️ หมายเหตุสำคัญ

- **Free Plan ของ Render** จะหลับหลังจากไม่มีคนเข้า 15 นาที → แนะนำใช้ **Starter Plan** ($7/เดือน) หรือใช้บริการ ping เช่น [UptimeRobot](https://uptimerobot.com) ping URL ทุก 5 นาที
- Bot ใช้ `auth: 'offline'` (cracked) เหมาะสำหรับเซิร์ฟเวอร์ที่ไม่ต้องใช้ Mojang auth

## วิธีใช้ Dashboard

1. **CONNECT** — เชื่อมต่อ bot (แก้ host/port/username ก่อนถ้าต้องการ)
2. **DISCONNECT** — ตัดการเชื่อมต่อ
3. **Quick Commands** — กดปุ่มลัดรันคำสั่งด้านซ้าย
4. **Terminal** — พิมพ์คำสั่งเองแล้วกด Enter หรือ SEND

## Auto-Reconnect

เมื่อ bot หลุดจากเซิร์ฟเวอร์:
1. รอ delay (เริ่มที่ 5 วินาที เพิ่มขึ้นเรื่อยๆ สูงสุด 60 วินาที)
2. เชื่อมต่อใหม่
3. รัน `/login a12345` หลังเชื่อมต่อสำเร็จ (2 วินาที)
4. รัน `/smp` ตามหลัง (4 วินาที)
