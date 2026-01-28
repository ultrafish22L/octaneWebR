#!/bin/bash
# OctaneWebR Launch Script
# Starts both Node.js backend and Vite frontend

echo "╔═══════════════════════════════════════════════════╗"
echo "║              Starting OctaneWebR                  ║"
echo "╠═══════════════════════════════════════════════════╣"
echo "║  Frontend: http://localhost:5173                  ║"
echo "║  Backend:  http://localhost:51024                 ║"
echo "║  WebSocket: ws://localhost:51024/api/callbacks    ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""
echo "📦 Installing dependencies (if needed)..."
npm install --silent

echo ""
echo "🚀 Starting servers (press Ctrl+C to stop)..."
echo ""

npm run dev
