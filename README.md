# 🎓 CampusBot — Setup Guide

## Project Structure
```
Ai chatbot/
├── server.js          ← Express backend (Node.js)
├── package.json       ← Dependencies list
├── .env               ← Your API key goes here
├── .env.example       ← Template for .env
├── .gitignore
└── public/            ← Frontend (served by the server)
    ├── index.html
    ├── style.css
    └── app.js
```

---

## Step 1 — Install Node.js

1. Go to **https://nodejs.org**
2. Download the **LTS version** (recommended)
3. Run the installer (click Next → Next → Install)
4. After install, open a new terminal and verify:
   ```
   node --version
   npm --version
   ```

---

## Step 2 — Install Dependencies

Open **PowerShell** or **Command Prompt** in the project folder:

```bash
cd "C:\Users\razal\Desktop\Ai chatbot"
npm install
```

This installs: `express`, `cors`, `dotenv`, `@google/generative-ai`, `express-rate-limit`

---

## Step 3 — Get a FREE Gemini API Key (optional but recommended)

1. Go to **https://aistudio.google.com/app/apikey**
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy the key
5. Open `.env` and replace `your_gemini_api_key_here` with your key:
   ```
   GEMINI_API_KEY=AIza...your_real_key_here
   ```

> ⚡ **Without a key** the bot still works using the built-in campus knowledge base.

---

## Step 4 — Start the Server

```bash
npm start
```

You'll see:
```
╔══════════════════════════════════════════╗
║  🎓 CampusBot Server Running              ║
║  📡 http://localhost:3000                 ║
║  🤖 Mode: Google Gemini AI               ║
╚══════════════════════════════════════════╝
```

---

## Step 5 — Open the Chatbot

Open your browser and go to:
**http://localhost:3000**

---

## Development Mode (auto-restart on file changes)

```bash
npm run dev
```

---

## API Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/health` | Check server status & mode |
| POST | `/api/chat` | Send a message, get a reply |
| GET | `/api/campus-info` | Get raw campus data (events, schedule) |

### Example API Call
```json
POST /api/chat
{
  "message": "What events are happening this week?",
  "history": []
}
```
