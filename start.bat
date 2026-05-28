@echo off
title INTERVEX AI - Startup
color 0A
echo.
echo  ==========================================
echo   INTERVEX AI - Starting Up
echo   SQLite + Groq (No Docker needed!)
echo  ==========================================
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found! Install from python.org
    pause
    exit /b 1
)

:: Check Node
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found! Install from nodejs.org
    pause
    exit /b 1
)

:: Check GROQ key in .env
findstr /C:"GROQ_API_KEY=your-groq" backend\.env >nul 2>&1
if not errorlevel 1 (
    echo.
    echo [WARNING] GROQ_API_KEY not set in backend\.env
    echo  Get FREE key at: https://console.groq.com
    echo  Then edit backend\.env and set GROQ_API_KEY=sk-...
    echo.
    pause
)

:: Install backend deps
echo [1/4] Installing backend packages...
cd backend
if not exist venv (
    python -m venv venv
)
call venv\Scripts\activate.bat
pip install -r requirements.txt -q
echo  Backend packages ready!

:: Start backend in background
echo [2/4] Starting backend (port 8000)...
start "INTERVEX Backend" cmd /k "call venv\Scripts\activate.bat && uvicorn app.main:asgi_app --host 0.0.0.0 --port 8000 --reload"
cd ..

:: Install frontend deps
echo [3/4] Installing frontend packages...
cd frontend
if not exist node_modules (
    npm install --silent
)
echo  Frontend packages ready!

:: Start frontend
echo [4/4] Starting frontend (port 3000)...
start "INTERVEX Frontend" cmd /k "npm run dev"
cd ..

echo.
echo  ==========================================
echo   INTERVEX AI is starting!
echo.
echo   Frontend:  http://localhost:3000
echo   Backend:   http://localhost:8000
echo   API Docs:  http://localhost:8000/api/docs
echo.
echo   Admin login:
echo   Email:    admin@intervex.ai
echo   Password: Admin@123!
echo  ==========================================
echo.
timeout /t 5
start http://localhost:3000
