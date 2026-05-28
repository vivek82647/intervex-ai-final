#!/bin/bash
set -e

echo ""
echo "=========================================="
echo "  INTERVEX AI - Starting Up"
echo "  SQLite + Groq (No Docker needed!)"
echo "=========================================="
echo ""

# Check tools
for cmd in python3 node npm; do
  command -v $cmd >/dev/null 2>&1 || { echo "[ERROR] $cmd not found. Please install it."; exit 1; }
done

# Check Groq key
if grep -q "GROQ_API_KEY=your-groq" backend/.env 2>/dev/null; then
  echo "[WARNING] GROQ_API_KEY not set in backend/.env"
  echo "  Get FREE key at: https://console.groq.com"
  echo "  Edit backend/.env and set GROQ_API_KEY=sk-..."
  echo ""
fi

# Backend
echo "[1/4] Setting up backend..."
cd backend
[ ! -d venv ] && python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt -q
echo "  Backend packages ready!"

echo "[2/4] Starting backend on port 8000..."
uvicorn app.main:asgi_app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..

# Frontend
echo "[3/4] Setting up frontend..."
cd frontend
[ ! -d node_modules ] && npm install --silent
echo "  Frontend packages ready!"

echo "[4/4] Starting frontend on port 3000..."
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "=========================================="
echo "  INTERVEX AI is running!"
echo ""
echo "  Frontend:  http://localhost:3000"
echo "  Backend:   http://localhost:8000"
echo "  API Docs:  http://localhost:8000/api/docs"
echo ""
echo "  Admin: admin@intervex.ai / Admin@123!"
echo "  Press Ctrl+C to stop all services"
echo "=========================================="
echo ""

trap "echo 'Shutting down...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
