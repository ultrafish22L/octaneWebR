# Package octaneWebR as Electron Desktop Application
# Uses the TypeScript Electron sources in electron/

Write-Host "+===================================================+" -ForegroundColor Cyan
Write-Host "|      Building octaneWebR Electron Desktop App     |" -ForegroundColor Cyan
Write-Host "+===================================================+" -ForegroundColor Cyan
Write-Host ""

# Step 1: Install dependencies (including Electron)
Write-Host "[Package] Installing dependencies..." -ForegroundColor Green
npm install

# Step 2: Build everything
Write-Host "[Build] Building client + server + Electron..." -ForegroundColor Green
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[Error] Client/server build failed" -ForegroundColor Red
    exit 1
}

# Step 3: Compile Electron TypeScript
Write-Host "[Build] Compiling Electron TypeScript..." -ForegroundColor Green
npx tsc -p electron/tsconfig.json
if ($LASTEXITCODE -ne 0) {
    Write-Host "[Error] Electron TypeScript compilation failed" -ForegroundColor Red
    exit 1
}

# Step 4: Package with electron-builder
Write-Host "[Package] Building Electron package..." -ForegroundColor Green
npx electron-builder --win
if ($LASTEXITCODE -ne 0) {
    Write-Host "[Error] Electron packaging failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[OK] Electron packaging complete!" -ForegroundColor Green
Write-Host ""
Write-Host "[Package] Output: dist/electron-build/" -ForegroundColor Cyan
Write-Host ""
Write-Host "[Steps] To test:" -ForegroundColor Cyan
Write-Host "   1. Start Octane with LiveLink enabled"
Write-Host "   2. Run the installer or portable .exe from dist/electron-build/"
Write-Host ""
Write-Host "[Dev] For development testing:" -ForegroundColor Yellow
Write-Host "   npm run electron:dev"
Write-Host ""
