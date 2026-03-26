/**
 * Electron Main Process for octaneWebR
 *
 * Dev mode:   Loads Vite dev server (http://localhost:43929)
 *             The Vite plugin handles gRPC proxy + WebSocket relay.
 *
 * Prod mode:  Starts standalone GrpcProxyServer on port 43930,
 *             serves built static files, and handles all API routes.
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let proxyServer: { close: () => Promise<void> } | null = null;

// dxSS native addon — loaded once, shared with GrpcProxyServer
let dxAddon: any = null;
let dxAddonAvailable = false;

function loadDxAddon(): void {
  try {
    const appRoot = app.getAppPath();
    const addonPath = isDev
      ? path.join(appRoot, 'native/build/Release/dx_shared_surface.node')
      : path.join(process.resourcesPath, 'native/dx_shared_surface.node');
    dxAddon = require(addonPath);
    if (dxAddon && dxAddon.isAvailable()) {
      dxAddonAvailable = true;
      console.log('[Electron] DX shared surface addon loaded and available');
    } else {
      dxAddon = null;
      console.log('[Electron] DX shared surface addon loaded but D3D11 not available');
    }
  } catch (e: any) {
    dxAddon = null;
    console.log('[Electron] DX shared surface addon not found:', e.message);
  }
}

// Sync IPC for preload script to query addon status
ipcMain.on('get-dx-addon-status', event => {
  event.returnValue = dxAddonAvailable;
});

async function createWindow(): Promise<void> {
  let serverPort = 43929; // Vite dev server port

  // Load DX addon before starting server
  loadDxAddon();

  if (!isDev) {
    // Start standalone gRPC proxy server for production
    // Dynamic import since GrpcProxyServer has heavy dependencies
    const appRoot = app.getAppPath();
    const { startGrpcProxyServer } = require(
      path.join(appRoot, 'server/dist/grpc/GrpcProxyServer')
    );

    // Proto and cache paths: packaged app uses extraResources, dev uses source
    const protoServerPath = app.isPackaged
      ? path.join(process.resourcesPath, 'server')
      : path.join(appRoot, 'server');

    const apiCachePath = app.isPackaged
      ? path.join(process.resourcesPath, 'mcp/data/octane-api-cache.json')
      : path.join(appRoot, 'mcp/data/octane-api-cache.json');

    const staticDir = path.join(appRoot, 'dist/client');

    const instance = await startGrpcProxyServer({
      port: 43930,
      protoBasePath: protoServerPath,
      apiCachePath,
      staticDir,
      dxAddon,
    });

    proxyServer = instance;
    serverPort = instance.port;
  }

  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    icon: isDev
      ? path.join(__dirname, '../client/public/octane_icon.ico')
      : path.join(process.resourcesPath, 'icon.ico'),
    title: 'octaneWebR',
    backgroundColor: '#1e1e1e',
    show: false, // Show after ready-to-show to avoid flash
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (isDev) {
    mainWindow.loadURL(`http://localhost:${serverPort}`);
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load through the proxy server so API calls work
    mainWindow.loadURL(`http://127.0.0.1:${serverPort}`);
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

app.on('before-quit', async () => {
  if (proxyServer) {
    await proxyServer.close();
    proxyServer = null;
  }
});
