#!/bin/bash
# Package octaneWebR for Production Distribution
# Creates a portable package with built files and launcher

echo "╔═══════════════════════════════════════════════════╗"
echo "║     Building octaneWebR Production Package        ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

# Step 1: Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist
rm -rf octaneWebR-production.zip

# Step 2: Install dependencies
echo "📦 Installing dependencies..."
npm install --production=false

# Step 3: Build production bundle
echo "🔨 Building production bundle..."
npm run build

# Step 4: Create distribution package
echo "📦 Creating distribution package..."
mkdir -p dist/production

# Copy built files
cp -r dist/client/* dist/production/

# Create launcher script
cat > dist/production/start-server.sh << 'EOF'
#!/bin/bash
# octaneWebR Production Launcher
# Starts HTTP server on port 43930

echo "╔═══════════════════════════════════════════════════╗"
echo "║              Starting octaneWebR                  ║"
echo "╠═══════════════════════════════════════════════════╣"
echo "║  URL: http://localhost:43930                      ║"
echo "║  Requirements: Octane with LiveLink enabled       ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""
echo "📡 Starting HTTP server..."
echo "🌐 Open http://localhost:43930 in your browser"
echo ""
echo "Press Ctrl+C to stop server"
echo ""

# Check if Python is available
if command -v python3 &> /dev/null; then
    python3 -m http.server 43930
elif command -v python &> /dev/null; then
    python -m http.server 43930
else
    echo "❌ Error: Python not found. Please install Python or use Node.js:"
    echo "   npm install -g serve"
    echo "   serve -s . -p 43930"
    exit 1
fi
EOF

# Make launcher executable
chmod +x dist/production/start-server.sh

# Create Windows launcher
cat > dist/production/start-server.bat << 'EOF'
@echo off
REM octaneWebR Production Launcher for Windows
REM Starts HTTP server on port 43930

echo ╔═══════════════════════════════════════════════════╗
echo ║              Starting octaneWebR                  ║
echo ╠═══════════════════════════════════════════════════╣
echo ║  URL: http://localhost:43930                      ║
echo ║  Requirements: Octane with LiveLink enabled       ║
echo ╚═══════════════════════════════════════════════════╝
echo.
echo 📡 Starting HTTP server...
echo 🌐 Open http://localhost:43930 in your browser
echo.
echo Press Ctrl+C to stop server
echo.

REM Check if Python is available
where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    python -m http.server 43930
) else (
    echo ❌ Error: Python not found. Please install Python or use Node.js:
    echo    npm install -g serve
    echo    serve -s . -p 43930
    pause
    exit /b 1
)
EOF

# Create README
cat > dist/production/README.txt << 'EOF'
╔═══════════════════════════════════════════════════╗
║        octaneWebR - Production Distribution       ║
╚═══════════════════════════════════════════════════╝

QUICK START:
1. Ensure Octane Render is running with LiveLink enabled
   (Help → LiveLink in Octane menu)

2. Run the launcher:
   • Windows: Double-click start-server.bat
   • Linux/Mac: ./start-server.sh

3. Open browser to: http://localhost:43930

REQUIREMENTS:
✓ Octane Render with LiveLink enabled (port 51022)
✓ Modern web browser (Chrome, Firefox, Edge, Safari)
✓ Python 3 (for HTTP server) OR Node.js with 'serve' package

WHAT IS octaneWebR?
A web-based UI clone of Octane Render Studio Standalone Edition.
Full pixel-perfect React/TypeScript implementation with real-time
gRPC API integration to Octane.

FEATURES:
✓ Node Graph Editor with 755+ node types
✓ Scene Outliner with hierarchical tree view
✓ Node Inspector with real-time parameter editing
✓ Render Viewport with live HDR streaming
✓ Full keyboard shortcuts (Ctrl+C, Ctrl+V, Ctrl+F, etc.)
✓ Material Database (LiveDB + LocalDB)
✓ Complete menu system matching Octane SE

TROUBLESHOOTING:
• Cannot connect: Ensure Octane LiveLink is enabled
• Port in use: Change port in launcher script
• Blank screen: Clear browser cache, check console for errors

For more info: https://github.com/ultrafish22L/grpcSamples
EOF

# Step 5: Create ZIP archive
echo "📦 Creating ZIP archive..."
cd dist
zip -r ../octaneWebR-production.zip production/
cd ..

# Step 6: Summary
echo ""
echo "✅ Production package created successfully!"
echo ""
echo "📦 Distribution files:"
echo "   • dist/production/          (ready to deploy)"
echo "   • octaneWebR-production.zip (portable package)"
echo ""
echo "📋 Package contents:"
echo "   • index.html + assets       (built app)"
echo "   • start-server.sh           (Linux/Mac launcher)"
echo "   • start-server.bat          (Windows launcher)"
echo "   • README.txt                (user instructions)"
echo ""
echo "🚀 To test production build:"
echo "   cd dist/production"
echo "   ./start-server.sh           (or start-server.bat on Windows)"
echo "   Open http://localhost:43930"
echo ""
echo "📤 To distribute:"
echo "   Share octaneWebR-production.zip"
echo "   Users extract and run launcher script"
echo ""
