/**
 * Electron Main Process for octaneWebR
 *
 * Dev mode:   Loads Vite dev server (http://localhost:43929)
 *             The Vite plugin handles gRPC proxy + WebSocket relay.
 *
 * Prod mode:  Starts standalone GrpcProxyServer on port 43930,
 *             serves built static files, and handles all API routes.
 */

import { app, BrowserWindow } from 'electron';
import * as path from 'path';

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let proxyServer: { close: () => Promise<void> } | null = null;

async function createWindow(): Promise<void> {
  let serverPort = 43929; // Vite dev server port

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
