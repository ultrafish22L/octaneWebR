#!/bin/bash
# Package octaneWebR as Electron Desktop Application
# Creates native executables for Windows, macOS, and Linux

echo "╔═══════════════════════════════════════════════════╗"
echo "║      Building octaneWebR Electron Desktop App     ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

echo "⚠️  This script will set up Electron packaging."
echo "    Run this script to install Electron dependencies."
echo ""

# Step 1: Install Electron and builder
echo "📦 Installing Electron dependencies..."
npm install --save-dev electron electron-builder

# Step 2: Create Electron main process
echo "📝 Creating Electron configuration..."

mkdir -p electron

cat > electron/main.js << 'EOF'
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
EOF

# Step 3: Update package.json with Electron scripts
echo "📝 Adding Electron scripts to package.json..."

# Create temporary Node.js script to update package.json
node << 'EOF'
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
console.log('✅ package.json updated with Electron configuration');
EOF

# Step 4: Create usage instructions
cat > ELECTRON-PACKAGING.md << 'EOF'
# Electron Desktop App Packaging Guide

## Prerequisites
- Node.js 18+
- npm
- Electron dependencies installed (run package-electron.sh)

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
✅ Native desktop application
✅ No browser required
✅ Auto-updates support (can be added)
✅ Native OS integration (taskbar, dock, etc.)
✅ File system access (for future features)
✅ Native menus and dialogs

## Disadvantages
❌ Large file size (~100MB+ per platform)
❌ More complex build process
❌ Platform-specific builds required

---

**Note**: First build on each platform takes 5-10 minutes to download Electron binaries.
Subsequent builds are faster (~1-2 minutes).
EOF

echo ""
echo "✅ Electron packaging setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Read ELECTRON-PACKAGING.md for detailed instructions"
echo "   2. Test development build:"
echo "      • Terminal 1: npm run dev"
echo "      • Terminal 2: npm run electron:dev"
echo "   3. Build production app:"
echo "      • npm run electron:build        (all platforms)"
echo "      • npm run electron:build:win    (Windows only)"
echo "      • npm run electron:build:mac    (macOS only)"
echo "      • npm run electron:build:linux  (Linux only)"
echo ""
echo "📦 Built apps will be in: dist/electron/"
echo ""
