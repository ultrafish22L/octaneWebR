#!/bin/bash
# Package octaneWebR as Electron Desktop Application
# Uses the TypeScript Electron sources in electron/

echo "+===================================================+"
echo "|      Building octaneWebR Electron Desktop App     |"
echo "+===================================================+"
echo ""

# Step 1: Install dependencies
echo "[Package] Installing dependencies..."
npm install

# Step 2: Build client + server
echo "[Build] Building client + server..."
npm run build
if [ $? -ne 0 ]; then
    echo "[Error] Client/server build failed"
    exit 1
fi

# Step 3: Compile Electron TypeScript
echo "[Build] Compiling Electron TypeScript..."
npx tsc -p electron/tsconfig.json
if [ $? -ne 0 ]; then
    echo "[Error] Electron TypeScript compilation failed"
    exit 1
fi

# Step 4: Package with electron-builder
echo "[Package] Building Electron package..."
npx electron-builder --win
if [ $? -ne 0 ]; then
    echo "[Error] Electron packaging failed"
    exit 1
fi

echo ""
echo "[OK] Electron packaging complete!"
echo ""
echo "[Package] Output: dist/electron-build/"
echo ""
echo "[Steps] To test:"
echo "   1. Start Octane with LiveLink enabled"
echo "   2. Run the installer or portable .exe from dist/electron-build/"
echo ""
echo "[Dev] For development testing:"
echo "   npm run electron:dev"
echo ""
