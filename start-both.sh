#!/bin/bash

echo "Starting Supply Chain 4.0 Chatbot..."
echo ""

# Start Python Backend in background
echo "[1/2] Starting Python Backend on port 5000..."
cd "Python Backend"
python enhanced_web_app.py &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Start Frontend
echo "[2/2] Starting React Frontend on port 3000..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ Both servers are running!"
echo "🐍 Python Backend: http://localhost:5000 (PID: $BACKEND_PID)"
echo "⚛️  React Frontend: http://localhost:3000 (PID: $FRONTEND_PID)"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for user to stop
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT
wait
