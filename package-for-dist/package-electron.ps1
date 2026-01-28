# Package octaneWebR as Electron Desktop Application
# Creates native executables for Windows, macOS, and Linux

Write-Host "+===================================================+" -ForegroundColor Cyan
Write-Host "|      Building octaneWebR Electron Desktop App     |" -ForegroundColor Cyan
Write-Host "+===================================================+" -ForegroundColor Cyan
Write-Host ""

Write-Host "[Warning]  This script will set up Electron packaging." -ForegroundColor Yellow
Write-Host "    Run this script to install Electron dependencies." -ForegroundColor Yellow
Write-Host ""

# Step 1: Install Electron and builder
Write-Host "[Package] Installing Electron dependencies..." -ForegroundColor Green
npm install --save-dev electron electron-builder

# Step 2: Create Electron main process
Write-Host "[Config] Creating Electron configuration..." -ForegroundColor Green

New-Item -ItemType Directory -Force -Path "electron" | Out-Null

$mainJsContent = @'
const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    icon: path.join(__dirname, '../client/public/favicon.ico'),
    title: 'octaneWebR - Octane Render Studio',
  });

  // Load the built app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:43930');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/client/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
'@

Set-Content -Path "electron/main.js" -Value $mainJsContent

# Step 3: Update package.json with Electron scripts
Write-Host "[Config] Adding Electron scripts to package.json..." -ForegroundColor Green

$updatePackageJson = @'
const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(process.cwd(), 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Add Electron main entry
packageJson.main = 'electron/main.js';

// Add Electron scripts
packageJson.scripts = {
  ...packageJson.scripts,
  'electron:dev': 'electron .',
  'electron:build': 'npm run build && electron-builder',
  'electron:build:win': 'npm run build && electron-builder --win',
  'electron:build:mac': 'npm run build && electron-builder --mac',
  'electron:build:linux': 'npm run build && electron-builder --linux',
};

// Add Electron builder config
packageJson.build = {
  appId: 'com.octane.webr',
  productName: 'octaneWebR',
  directories: {
    output: 'dist/electron',
    buildResources: 'electron/resources',
  },
  files: [
    'dist/client/**/*',
    'electron/main.js',
  ],
  win: {
    target: ['nsis', 'portable'],
    icon: 'client/public/favicon.ico',
  },
  mac: {
    target: ['dmg', 'zip'],
    icon: 'client/public/favicon.ico',
    category: 'public.app-category.graphics-design',
  },
  linux: {
    target: ['AppImage', 'deb'],
    icon: 'client/public/favicon.ico',
    category: 'Graphics',
  },
};

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
console.log('[OK] package.json updated with Electron configuration');
'@

$updatePackageJson | node

# Step 4: Create usage instructions
$electronPackagingMd = @'
# Electron Desktop App Packaging Guide

## Prerequisites
- Node.js 18+
- npm
- Electron dependencies installed (run package-electron.ps1 or package-electron.sh)

## Build Commands

### Development (Test Electron wrapper)
```bash
npm run dev              # Start Vite dev server
npm run electron:dev     # In separate terminal, start Electron
```

### Production Build (All Platforms)
```bash
npm run electron:build
```

Output: `dist/electron/`

### Platform-Specific Builds

**Windows (NSIS installer + portable .exe):**
```bash
npm run electron:build:win
```

Output:
- `dist/electron/octaneWebR Setup X.X.X.exe` (installer)
- `dist/electron/octaneWebR X.X.X.exe` (portable)

**macOS (DMG + ZIP):**
```bash
npm run electron:build:mac
```

Output:
- `dist/electron/octaneWebR-X.X.X.dmg`
- `dist/electron/octaneWebR-X.X.X-mac.zip`

**Linux (AppImage + deb):**
```bash
npm run electron:build:linux
```

Output:
- `dist/electron/octaneWebR-X.X.X.AppImage`
- `dist/electron/octaneWebR_X.X.X_amd64.deb`

## Distribution

### Windows
Distribute the `.exe` installer or portable `.exe` file.
Users double-click to install/run.

### macOS
Distribute the `.dmg` file.
Users drag to Applications folder.

### Linux
Distribute `.AppImage` (no install needed) or `.deb` (for Debian/Ubuntu).

```bash
# AppImage (universal)
chmod +x octaneWebR-X.X.X.AppImage
./octaneWebR-X.X.X.AppImage

# Debian/Ubuntu
sudo dpkg -i octaneWebR_X.X.X_amd64.deb
```

## File Sizes (Approximate)
- Windows installer: ~80-120 MB
- macOS DMG: ~100-150 MB
- Linux AppImage: ~90-130 MB

## Requirements for End Users
- Octane Render installed with LiveLink enabled
- No browser needed (Electron includes Chromium)
- No Node.js/npm needed (bundled with app)

## Advantages of Electron Distribution
[OK] Native desktop application
[OK] No browser required
[OK] Auto-updates support (can be added)
[OK] Native OS integration (taskbar, dock, etc.)
[OK] File system access (for future features)
[OK] Native menus and dialogs

## Disadvantages
[Error] Large file size (~100MB+ per platform)
[Error] More complex build process
[Error] Platform-specific builds required

---

**Note**: First build on each platform takes 5-10 minutes to download Electron binaries.
Subsequent builds are faster (~1-2 minutes).
'@

Set-Content -Path "ELECTRON-PACKAGING.md" -Value $electronPackagingMd

Write-Host ""
Write-Host "[OK] Electron packaging setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "[Steps] Next steps:" -ForegroundColor Cyan
Write-Host "   1. Read ELECTRON-PACKAGING.md for detailed instructions"
Write-Host "   2. Test development build:"
Write-Host "      - Terminal 1: npm run dev"
Write-Host "      - Terminal 2: npm run electron:dev"
Write-Host "   3. Build production app:"
Write-Host "      - npm run electron:build        (all platforms)"
Write-Host "      - npm run electron:build:win    (Windows only)"
Write-Host "      - npm run electron:build:mac    (macOS only)"
Write-Host "      - npm run electron:build:linux  (Linux only)"
Write-Host ""
Write-Host "[Package] Built apps will be in: dist/electron/" -ForegroundColor Yellow
Write-Host ""
