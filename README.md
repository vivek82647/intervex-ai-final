# INTERVEX AI - v2 (No Docker, Free AI)

AI-powered mock interview & assessment platform.  
**No Docker, no paid services, runs locally!**

---

## ✅ What Changed in v2

| Feature | Before | Now |
|---|---|---|
| AI | Ollama (needs Docker) | **Groq API (Free)** |
| Database | PostgreSQL (needs Docker) | **SQLite (auto-created)** |
| Voice Input | ❌ None | ✅ **Browser mic (Web Speech API)** |
| Voice Output | ❌ None | ✅ **Browser TTS (reads questions aloud)** |
| Code execution | Judge0 (external) | Python runs locally |
| Setup | Complex | **2 commands** |

---

## 🚀 Quick Start

### Step 1 — Get Free Groq API Key
1. Go to **https://console.groq.com**
2. Sign up (free)
3. Create an API key
4. Copy it

### Step 2 — Set API Key
Edit `backend/.env`:
```
GROQ_API_KEY=gsk_your_actual_key_here
```

### Step 3 — Run

**Windows:**
```
start.bat
```

**Mac/Linux:**
```bash
chmod +x start.sh
./start.sh
```

That's it! Open http://localhost:3000

---

## 🔑 Default Login

| Role | Email | Password |
|---|---|---|
| Admin | admin@intervex.ai | Admin@123! |

---

## 🎤 Voice Features

- **Read Aloud button** (🔊) — reads any question aloud
- **Speaker toggle** — auto-reads each question as you navigate
- **Speak button** (🎤) — for descriptive answers, speak your answer and it transcribes
- Works in: Chrome, Edge, Safari (not Firefox for mic)

---

## 📁 Project Structure

```
intervex-ai/
├── backend/          FastAPI + SQLite + Groq
│   ├── .env         ← Set GROQ_API_KEY here
│   ├── requirements.txt
│   └── app/
├── frontend/         Next.js + TailwindCSS
│   └── .env.local   (auto-configured)
├── start.bat        Windows one-click start
└── start.sh         Mac/Linux one-click start
```

---

## 🛠️ Manual Start (if scripts fail)

**Backend:**
```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
# Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:asgi_app --port 8000 --reload
```

**Frontend (new terminal):**
```bash
cd frontend
npm install
npm run dev
```

---

## 🤖 AI Models (Groq — all free)

Change `GROQ_MODEL` in `backend/.env`:

| Model | Speed | Quality |
|---|---|---|
| `llama-3.1-8b-instant` | ⚡ Fast | Good (default) |
| `llama-3.1-70b-versatile` | Medium | Great |
| `mixtral-8x7b-32768` | Fast | Good |

---

## Requirements

- **Python 3.10+** — python.org
- **Node.js 18+** — nodejs.org
- **Chrome or Edge** (for voice features)
- Internet (for Groq API calls)
