import express from 'express';
import cors from 'cors';
import fs from 'fs';
import nodePath from 'path';
import { getGrpcClient } from './grpc/client';
import { transformObjectPtrParams } from './grpc/OctaneGrpcClientBase';
import { setupCallbackStreaming } from './api/websocket';
import { CallbackManager, getCallbackManager } from './services/callbackManager';
import type { WebSocketServer } from 'ws';

const RED = '\x1b[31m';
const RESET = '\x1b[0m';

const app = express();
const PORT = parseInt(process.env.SERVER_PORT || '45769');

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow localhost origins (any port) and no-origin requests (same-origin)
      if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        callback(null, origin || true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '50mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

const grpcClient = getGrpcClient();
const callbackManager = getCallbackManager(grpcClient);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const isHealthy = await grpcClient.checkHealth();
    const addr = grpcClient.address;
    const isLocal = /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(addr);
    res.json({
      status: isHealthy ? 'ok' : 'unhealthy',
      octane: isHealthy ? 'connected' : 'disconnected',
      server: 'running',
      isLocal,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      octane: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// System info endpoint - for render stats bar (primitives, GPU, memory, version)
app.get('/api/system/info', async (req, res) => {
  try {
    const systemInfo = await grpcClient.getSystemInfo();
    res.json(systemInfo);
  } catch (error: any) {
    console.error(`${RED}Failed to get system info: ${error.message}${RESET}`);
    res.status(500).json({
      error: error.message || 'Failed to retrieve system info',
      code: error.code || 'UNKNOWN',
    });
  }
});

// Geometry statistics endpoint
app.get('/api/scene/geometry', async (req, res) => {
  try {
    const geometryStats = await grpcClient.getGeometryStatistics();
    res.json(geometryStats);
  } catch (error: any) {
    console.error(`${RED}Failed to get geometry statistics: ${error.message}${RESET}`);
    res.status(500).json({
      error: error.message || 'Failed to retrieve geometry statistics',
      code: error.code || 'UNKNOWN',
    });
  }
});

// Device info endpoint
app.get('/api/device/info', async (req, res) => {
  try {
    const deviceIndex = parseInt((req.query.index as string) || '0', 10) || 0;
    const [name, hasRT, memory] = await Promise.all([
      grpcClient.getDeviceName(deviceIndex),
      grpcClient.deviceUsesHardwareRayTracing(deviceIndex),
      grpcClient.getMemoryUsage(deviceIndex),
    ]);

    res.json({
      index: deviceIndex,
      name,
      hasHardwareRT: hasRT,
      memory: {
        used: memory.usedDeviceMemory,
        free: memory.freeDeviceMemory,
        total: memory.totalDeviceMemory,
        totalGB: parseFloat((memory.totalDeviceMemory / (1024 * 1024 * 1024)).toFixed(1)),
      },
    });
  } catch (error: any) {
    console.error(`${RED}Failed to get device info: ${error.message}${RESET}`);
    res.status(500).json({
      error: error.message || 'Failed to retrieve device info',
      code: error.code || 'UNKNOWN',
    });
  }
});

// File listing endpoint for remote file browser
app.get('/api/files/list', (req, res) => {
  const dirPath = (req.query.path as string) || '';
  try {
    if (!dirPath) {
      const entries: { name: string; isDirectory: boolean; size: number; extension: string }[] = [];
      if (process.platform === 'win32') {
        for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
          const drive = `${letter}:\\`;
          if (fs.existsSync(drive)) {
            entries.push({ name: drive, isDirectory: true, size: 0, extension: '' });
          }
        }
      } else {
        entries.push({ name: '/', isDirectory: true, size: 0, extension: '' });
      }
      res.json({ path: '', parent: null, entries });
    } else {
      const dirents = fs.readdirSync(dirPath, { withFileTypes: true });
      const entries = dirents
        .filter(d => !d.name.startsWith('.'))
        .map(d => {
          const isDir = d.isDirectory();
          let size = 0;
          if (!isDir) {
            try {
              size = fs.statSync(nodePath.join(dirPath, d.name)).size;
            } catch {
              /* ignore */
            }
          }
          const ext = isDir ? '' : nodePath.extname(d.name).toLowerCase();
          return { name: d.name, isDirectory: isDir, size, extension: ext };
        })
        .sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        });
      const parentDir = nodePath.dirname(dirPath);
      // Drive roots (C:\) → parent is '' (root list); filesystem root → null
      const parent = parentDir === dirPath ? (dirPath.length <= 3 ? '' : null) : parentDir;
      res.json({ path: dirPath, parent, entries });
    }
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Cannot read directory', path: dirPath });
  }
});

// Generic gRPC endpoint (matches octaneWeb pattern)
// POST /api/grpc/:service/:method
app.post('/api/grpc/:service/:method', async (req, res) => {
  const { service, method } = req.params;
  const params = transformObjectPtrParams(service, method, req.body || {});

  try {
    const response = await grpcClient.callMethod(service, method, params);

    // Convert response to plain object if needed
    let jsonResponse = response;
    if (response && typeof response.toObject === 'function') {
      jsonResponse = response.toObject();
    } else if (response && typeof response === 'object') {
      // Already a plain object
      jsonResponse = response;
    }

    res.json(jsonResponse);
  } catch (error: any) {
    console.error(`${RED}API error: ${service}.${method}: ${error.message}${RESET}`);
    res.status(500).json({
      error: error.message || 'gRPC call failed',
      service,
      method,
      code: error.code || 'UNKNOWN',
    });
  }
});

// Start server — await gRPC initialization BEFORE accepting requests
async function startServer() {
  try {
    await grpcClient.initialize();
    console.log('gRPC client initialized successfully');
  } catch (error) {
    console.error('Failed to initialize gRPC client:', error);
    process.exit(1);
  }

  const server = app.listen(PORT, '0.0.0.0', async () => {
    console.log(`
╔═══════════════════════════════════════════════════╗
║           OctaneWebR Server Started               ║
╠═══════════════════════════════════════════════════╣
║  HTTP Server:     http://localhost:${PORT}        ║
║  WebSocket:       ws://localhost:${PORT}/api/callbacks  ║
║  Octane gRPC:     ${grpcClient.address}        ║
╚═══════════════════════════════════════════════════╝
    `);

    // Setup WebSocket callback streaming
    wss = setupCallbackStreaming(server, grpcClient, callbackManager);

    // Register for Octane callbacks
    try {
      await callbackManager.registerCallbacks();
      console.log('Octane callback streaming initialized');
    } catch (error: any) {
      console.error('Failed to register callbacks:', error.message);
      console.error('  (Callbacks will not work until Octane is running and LiveLink is enabled)');
    }
  });

  return server;
}

let wss: WebSocketServer | null = null;
const serverPromise = startServer();

// Graceful shutdown
let isShuttingDown = false;
async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`${signal} received, shutting down gracefully...`);
  await callbackManager.unregisterCallbacks();
  // Force exit if graceful shutdown takes too long
  const forceExitTimer = setTimeout(() => {
    console.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 10000);
  forceExitTimer.unref();

  // Close WebSocket server — terminate connected clients then close
  if (wss) {
    for (const client of wss.clients) {
      client.close(1001, 'Server shutting down');
    }
    wss.close();
  }

  const server = await serverPromise;
  server.close(() => {
    grpcClient.close();
    console.log('Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
