@echo off
echo Starting Supply Chain 4.0 Chatbot...
echo.

REM Start Python Backend
echo [1/2] Starting Python Backend on port 5000...
start "Python Backend" cmd /k "cd /d \"Python Backend\" && python enhanced_web_app.py"

REM Wait a moment for backend to start
timeout /t 3 /nobreak >nul

REM Start Frontend
echo [2/2] Starting React Frontend on port 3000...
start "React Frontend" cmd /k "cd /d frontend && npm run dev"

echo.
echo ✅ Both servers are starting!
echo 🐍 Python Backend: http://localhost:5000
echo ⚛️  React Frontend: http://localhost:3000
echo.
echo Press any key to close this window...
pause >nul
