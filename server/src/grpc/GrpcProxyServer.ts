/**
 * Standalone gRPC Proxy Server
 *
 * Provides the same HTTP + WebSocket API surface as vite-plugin-octane-grpc.ts
 * but runs as an independent Node.js HTTP server. Used by:
 * - Electron production builds (no Vite dev server available)
 * - Standalone server deployments
 *
 * Routes:
 *   POST /api/grpc/:service/:method  — gRPC proxy
 *   GET  /api/health                 — health check
 *   GET  /api/octane-cache           — node type metadata cache
 *   POST /api/refresh-scene          — broadcast scene refresh to WS clients
 *   POST /api/scene-event            — broadcast scene events to WS clients
 *   POST /api/log                    — client logging
 *   POST /api/logClear               — clear client log
 *   GET  /api/files/list?path=       — file browser
 *   WS   /api/callbacks              — render image + statistics streaming
 */

import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import {
  OctaneGrpcClientBase,
  transformObjectPtrParams,
  initGrpcLog,
} from './OctaneGrpcClientBase';
import { CallbackStreamManager } from '../../../mcp/src/shared/CallbackStreamManager';

// ============================================================================
// LOGGING
// ============================================================================

enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
}

const LOG_LEVEL = LogLevel.INFO;

const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

const log = {
  error: (...args: any[]) => {
    if (LOG_LEVEL >= LogLevel.ERROR) console.error(RED, '[GrpcProxy]', ...args, RESET);
  },
  warn: (...args: any[]) => {
    if (LOG_LEVEL >= LogLevel.WARN) console.warn(YELLOW, '[GrpcProxy]', ...args, RESET);
  },
  info: (...args: any[]) => {
    if (LOG_LEVEL >= LogLevel.INFO) console.log('[GrpcProxy]', ...args);
  },
  debug: (...args: any[]) => {
    if (LOG_LEVEL >= LogLevel.DEBUG) console.log('[GrpcProxy]', ...args);
  },
};

// ============================================================================
// API CACHE
// ============================================================================

function juceColorToHex(color: number): string {
  const hex = (color >>> 0).toString(16).padStart(8, '0');
  return '#' + hex.substring(2, 8).toUpperCase();
}

function buildClientCachePayload(cachePath: string): string | null {
  if (!fs.existsSync(cachePath)) return null;

  const raw = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));

  const pinTypes: Record<string, { color: string }> = {};
  for (const [key, val] of Object.entries(raw.pinTypes || {})) {
    pinTypes[key] = { color: juceColorToHex((val as { color: number }).color) };
  }

  const compatibleTypes: Record<string, { nodes: Array<{ key: string; id: number }> }> = {};
  const nameToId: Record<string, number> = raw.nodeTypesByName || {};
  for (const [pinType, val] of Object.entries(raw.compatibleTypes || {})) {
    const nodes = ((val as { nodes: string[] }).nodes || [])
      .filter((n: string) => nameToId[n] !== undefined)
      .map((n: string) => ({ key: n, id: Number(nameToId[n]) }));
    if (nodes.length > 0) compatibleTypes[pinType] = { nodes };
  }

  const nodeTypes: Record<string, any> = {};
  for (const [key, val] of Object.entries(raw.nodeTypes || {})) {
    const nt = val as any;
    nodeTypes[key] = {
      id: Number(nameToId[key]) || 0,
      name: nt.defaultName || nt.name.replace(/^NT_/, '').replace(/_/g, ' '),
      category: nt.category,
      color: juceColorToHex(nt.nodeColor),
      outType: nt.outType,
      isHidden: nt.isHidden,
      movableInputPinCount: nt.movableInputPinCount,
      movableInputName: nt.movableInputName,
    };
  }

  return JSON.stringify({ meta: raw.meta, pinTypes, compatibleTypes, nodeTypes });
}

// ============================================================================
// GRPC CLIENT WRAPPER (mirrors vite plugin's OctaneGrpcClient)
// ============================================================================

class GrpcClient {
  private base: OctaneGrpcClientBase;
  private callbacks: Set<(data: any) => void> = new Set();
  private statisticsCallbacks: Set<(data: any) => void> = new Set();
  private renderFailureCallbacks: Set<(data: any) => void> = new Set();
  private projectManagerCallbacks: Set<(data: any) => void> = new Set();
  private sharedStream: CallbackStreamManager;
  private callbackId: number = 0;
  private isCallbackRegistered: boolean = false;
  private isRegistering = false;
  private callbackStream: any = null;
  private streamActive: boolean = false;
  private isPollingStatistics = false;
  private lastStatsPollTime = 0;
  private static readonly STATS_POLL_INTERVAL = 250;
  private static readonly CALLBACK_STREAM_DEADLINE_MS = 60_000;

  constructor(protoBasePath: string) {
    this.base = new OctaneGrpcClientBase(undefined, undefined, protoBasePath);
    log.info(`Connected to Octane at ${this.base.address}`);

    this.sharedStream = new CallbackStreamManager((name: string) => this.base.getService(name), {
      log: (msg: string) => log.debug(`[CallbackStream] ${msg}`),
      onConnectionLost: () => {
        log.warn('Octane connection lost via callback stream');
        this.isCallbackRegistered = false;
        this.base.close();
      },
    });

    this.sharedStream.on('renderFailure', event => {
      this.renderFailureCallbacks.forEach(cb => {
        try {
          cb({ user_data: event.userData, timestamp: event.timestamp });
        } catch (e) {
          log.error('renderFailure callback error:', e);
        }
      });
    });
    this.sharedStream.on('projectManagerChanged', event => {
      this.projectManagerCallbacks.forEach(cb => {
        try {
          cb({ user_data: event.userData, timestamp: event.timestamp });
        } catch (e) {
          log.error('projectManagerChanged callback error:', e);
        }
      });
    });
    this.sharedStream.on('newStatistics', () => this.pollRenderStatistics());
  }

  async initialize(): Promise<void> {
    await this.base.initialize();
    log.info('Proto files ready');
  }

  async callMethod(serviceName: string, methodName: string, params: any = {}): Promise<any> {
    return this.base.callMethod(serviceName, methodName, params);
  }

  async checkHealth(): Promise<boolean> {
    return this.base.checkHealth();
  }

  get isCallbackActive(): boolean {
    return this.isCallbackRegistered;
  }

  async registerOctaneCallbacks(): Promise<void> {
    if (this.isCallbackRegistered || this.isRegistering) return;
    this.isRegistering = true;
    try {
      this.callbackId = (Date.now() % 1000000000) + Math.floor(Math.random() * 1000);
      await this.callMethod('ApiRenderEngine', 'setOnNewImageCallback', {
        callback: { callbackSource: 'grpc', callbackId: this.callbackId },
        userData: 0,
      });
      try {
        await this.callMethod('ApiRenderEngine', 'setOnNewStatisticsCallback', {
          callback: { callbackSource: 'grpc', callbackId: this.callbackId },
          userData: 0,
        });
      } catch {
        /* non-fatal */
      }
      this.sharedStream.start();
      this.startCallbackStreaming();
      this.isCallbackRegistered = true;
      log.info('Callbacks registered');
    } catch (error: any) {
      log.error(`Failed to register callbacks: ${error.message}`);
    } finally {
      this.isRegistering = false;
    }
  }

  async unregisterOctaneCallbacks(): Promise<void> {
    if (!this.isCallbackRegistered) return;
    this.isCallbackRegistered = false;
    try {
      this.sharedStream.stop();
      if (this.callbackStream) {
        this.streamActive = false;
        this.callbackStream.cancel();
        this.callbackStream = null;
      }
      await this.callMethod('ApiRenderEngine', 'setOnNewImageCallback', {
        callback: null,
        userData: 0,
      });
      log.info('Callbacks unregistered');
    } catch (error: any) {
      log.error('Failed to unregister callback:', error.message);
    }
  }

  private handleCallbackData(callbackRequest: any): void {
    if (callbackRequest.newImage) {
      const renderImages = callbackRequest.newImage.render_images;
      if (renderImages?.data?.length > 0) {
        this.notifyCallbacks({
          callback_source: callbackRequest.newImage.callback_source || 'grpc',
          callback_id: callbackRequest.newImage.callback_id || this.callbackId,
          user_data: callbackRequest.newImage.user_data,
          render_images: renderImages,
        });
      }
      this.pollRenderStatistics();
    }
  }

  private pollRenderStatistics(): void {
    if (this.isPollingStatistics) return;
    const now = Date.now();
    if (now - this.lastStatsPollTime < GrpcClient.STATS_POLL_INTERVAL) return;
    this.isPollingStatistics = true;
    this.lastStatsPollTime = now;
    this.callMethod('ApiRenderEngine', 'getRenderStatistics', {})
      .then((response: any) => {
        if (response?.statistics) {
          this.notifyStatisticsCallbacks({
            callback_source: 'grpc',
            callback_id: this.callbackId,
            user_data: 0,
            statistics: response.statistics,
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        this.isPollingStatistics = false;
      });
  }

  private startCallbackStreaming(): void {
    if (this.callbackStream || this.streamActive) return;
    try {
      this.streamActive = true;
      const streamService = this.base.getService('StreamCallbackService');
      const deadline = Date.now() + GrpcClient.CALLBACK_STREAM_DEADLINE_MS;
      this.callbackStream = streamService.callbackChannel({}, null, { deadline });

      this.callbackStream.on('data', (req: any) => {
        try {
          this.handleCallbackData(req);
        } catch (e: any) {
          log.error('Callback data error:', e.message);
        }
      });
      this.callbackStream.on('error', (error: any) => {
        this.streamActive = false;
        try {
          this.callbackStream?.cancel();
        } catch {
          /* */
        }
        this.callbackStream = null;
        const msg = String(error?.message || '');
        if (/DEADLINE_EXCEEDED/i.test(msg) && this.isCallbackRegistered) {
          this.startCallbackStreaming();
        } else if (this.isCallbackRegistered && !/ECONNRESET|ECONNREFUSED|CANCELLED/i.test(msg)) {
          setTimeout(() => {
            if (this.isCallbackRegistered) this.startCallbackStreaming();
          }, 5000);
        } else if (/ECONNRESET|ECONNREFUSED|CANCELLED/i.test(msg)) {
          this.isCallbackRegistered = false;
          this.base.close();
        }
      });
      this.callbackStream.on('end', () => {
        this.streamActive = false;
        this.callbackStream = null;
        if (this.isCallbackRegistered) this.startCallbackStreaming();
      });
      log.info('Callback streaming active');
    } catch (error: any) {
      log.error('Failed to start callback streaming:', error.message);
      this.streamActive = false;
      this.callbackStream = null;
    }
  }

  registerCallback(cb: (data: any) => void): void {
    this.callbacks.add(cb);
  }
  unregisterCallback(cb: (data: any) => void): void {
    this.callbacks.delete(cb);
  }
  addStatisticsCallback(cb: (data: any) => void): void {
    this.statisticsCallbacks.add(cb);
  }
  removeStatisticsCallback(cb: (data: any) => void): void {
    this.statisticsCallbacks.delete(cb);
  }
  addRenderFailureCallback(cb: (data: any) => void): void {
    this.renderFailureCallbacks.add(cb);
  }
  removeRenderFailureCallback(cb: (data: any) => void): void {
    this.renderFailureCallbacks.delete(cb);
  }
  addProjectManagerCallback(cb: (data: any) => void): void {
    this.projectManagerCallbacks.add(cb);
  }
  removeProjectManagerCallback(cb: (data: any) => void): void {
    this.projectManagerCallbacks.delete(cb);
  }

  private notifyCallbacks(data: any): void {
    this.callbacks.forEach(cb => {
      try {
        cb(data);
      } catch (e) {
        log.error('Image callback error:', e);
      }
    });
  }
  private notifyStatisticsCallbacks(data: any): void {
    this.statisticsCallbacks.forEach(cb => {
      try {
        cb(data);
      } catch (e) {
        log.error('Statistics callback error:', e);
      }
    });
  }

  close(): void {
    this.sharedStream.stop();
    this.isCallbackRegistered = false;
    if (this.callbackStream) {
      this.streamActive = false;
      try {
        this.callbackStream.cancel();
      } catch {
        /* */
      }
      this.callbackStream = null;
    }
    this.base.close();
  }
}

// ============================================================================
// HTTP + WEBSOCKET SERVER
// ============================================================================

export interface GrpcProxyServerOptions {
  port?: number;
  /** Path to server/ directory containing proto/ */
  protoBasePath?: string;
  /** Path to mcp/data/octane-api-cache.json */
  apiCachePath?: string;
  /** Path to serve static files from (production mode) */
  staticDir?: string;
  /** File root restrictions for /api/files/list */
  fileRoots?: string[];
}

export interface GrpcProxyServerInstance {
  port: number;
  close: () => Promise<void>;
}

const MAX_BODY_SIZE = 50 * 1024 * 1024;

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
      if (body.length > MAX_BODY_SIZE) {
        req.destroy();
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function sendJson(res: http.ServerResponse, statusCode: number, data: any): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

export async function startGrpcProxyServer(
  options: GrpcProxyServerOptions = {}
): Promise<GrpcProxyServerInstance> {
  const port = options.port || 43930;
  const protoBasePath = options.protoBasePath || path.resolve(__dirname, '../../../server');
  const apiCachePath =
    options.apiCachePath || path.resolve(__dirname, '../../../mcp/data/octane-api-cache.json');
  const fileRoots = (options.fileRoots || [process.env.OCTANE_FILE_ROOTS || 'C:\\otoyla'])
    .flatMap(r => r.split(','))
    .map(r => path.resolve(r.trim()))
    .filter(Boolean);
  const unrestricted = fileRoots.length === 1 && fileRoots[0] === path.resolve('*');

  // Initialize gRPC client
  initGrpcLog();
  const grpcClient = new GrpcClient(protoBasePath);
  await grpcClient.initialize();

  try {
    await grpcClient.registerOctaneCallbacks();
  } catch (error: any) {
    log.error('Initial callback registration failed:', error.message);
  }

  // API cache
  let cachePayload: string | null = null;

  // WebSocket server
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws: WebSocket) => {
    log.info('WebSocket client connected');
    const MAX_WS_BUFFER = 10 * 1024 * 1024;

    const callbackHandler = (data: any) => {
      if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount <= MAX_WS_BUFFER) {
        ws.send(JSON.stringify({ type: 'newImage', data }));
      }
    };
    const statisticsHandler = (data: any) => {
      if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount <= MAX_WS_BUFFER) {
        ws.send(JSON.stringify({ type: 'newStatistics', data }));
      }
    };
    const renderFailureHandler = (data: any) => {
      if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount <= MAX_WS_BUFFER) {
        ws.send(JSON.stringify({ type: 'renderFailure', data }));
      }
    };
    const projectManagerHandler = (data: any) => {
      if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount <= MAX_WS_BUFFER) {
        ws.send(JSON.stringify({ type: 'projectManagerChanged', data }));
      }
    };

    grpcClient.registerCallback(callbackHandler);
    grpcClient.addStatisticsCallback(statisticsHandler);
    grpcClient.addRenderFailureCallback(renderFailureHandler);
    grpcClient.addProjectManagerCallback(projectManagerHandler);

    const cleanup = () => {
      grpcClient.unregisterCallback(callbackHandler);
      grpcClient.removeStatisticsCallback(statisticsHandler);
      grpcClient.removeRenderFailureCallback(renderFailureHandler);
      grpcClient.removeProjectManagerCallback(projectManagerHandler);
    };

    ws.on('close', () => {
      log.info('WebSocket client disconnected');
      cleanup();
    });
    ws.on('error', () => cleanup());
    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      } catch {
        /* ignore */
      }
    });
  });

  // HTTP server
  const server = http.createServer(async (req, res) => {
    // CORS headers for localhost
    const origin = req.headers.origin || '';
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = req.url || '';
    const urlObj = new URL(url, `http://localhost:${port}`);
    const pathname = urlObj.pathname;

    try {
      // Health check
      if (pathname === '/api/health') {
        const isHealthy = await grpcClient.checkHealth().catch(() => false);
        if (isHealthy && !grpcClient.isCallbackActive) {
          grpcClient.registerOctaneCallbacks().catch(() => {});
        }
        sendJson(res, 200, {
          status: isHealthy ? 'ok' : 'unhealthy',
          octane: isHealthy ? 'connected' : 'disconnected',
          server: 'electron',
          isLocal: true,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // API cache
      if (pathname === '/api/octane-cache') {
        res.setHeader('Cache-Control', 'max-age=3600');
        if (!cachePayload) cachePayload = buildClientCachePayload(apiCachePath);
        if (cachePayload) {
          sendJson(res, 200, JSON.parse(cachePayload));
        } else {
          sendJson(res, 404, { error: 'API cache not available' });
        }
        return;
      }

      // Scene refresh broadcast
      if (pathname === '/api/refresh-scene' && req.method === 'POST') {
        let count = 0;
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'refreshScene' }));
            count++;
          }
        });
        sendJson(res, 200, { success: true, clients: count });
        return;
      }

      // Scene event broadcast
      if (pathname === '/api/scene-event' && req.method === 'POST') {
        const body = await readBody(req);
        const event = JSON.parse(body);
        let count = 0;
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(event));
            count++;
          }
        });
        sendJson(res, 200, { success: true, clients: count });
        return;
      }

      // Client log clear
      if (pathname === '/api/logClear' && req.method === 'POST') {
        fs.rmSync('log_client.log', { force: true });
        sendJson(res, 200, { status: 'ok', message: 'Log cleared' });
        return;
      }

      // Client logging
      if (pathname === '/api/log' && req.method === 'POST') {
        const body = await readBody(req);
        const logData = JSON.parse(body);
        const timestamp = new Date().toISOString();
        const entries: { level: string; message: string }[] = logData.entries || [
          { level: logData.level || 'info', message: logData.message },
        ];
        let content = '';
        for (const entry of entries) {
          content += `${timestamp} ${(entry.level || 'info').toUpperCase()} ${entry.message}\n`;
        }
        fs.appendFile('log_client.log', content, () => {});
        sendJson(res, 200, { success: true });
        return;
      }

      // File listing
      if (pathname === '/api/files/list') {
        const dirPath = urlObj.searchParams.get('path') || '';
        const isAllowed = (p: string): boolean => {
          if (unrestricted) return true;
          const resolved = path.resolve(p);
          return fileRoots.some(root => resolved === root || resolved.startsWith(root + path.sep));
        };

        if (!dirPath) {
          if (unrestricted) {
            const entries: any[] = [];
            if (process.platform === 'win32') {
              for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
                const drive = `${letter}:\\`;
                if (fs.existsSync(drive))
                  entries.push({ name: drive, isDirectory: true, size: 0, extension: '' });
              }
            } else {
              entries.push({ name: '/', isDirectory: true, size: 0, extension: '' });
            }
            sendJson(res, 200, { path: '', parent: null, entries });
          } else {
            const entries = fileRoots
              .filter(r => fs.existsSync(r))
              .map(r => ({ name: r, isDirectory: true, size: 0, extension: '' }));
            sendJson(res, 200, { path: '', parent: null, entries });
          }
          return;
        }

        const resolved = path.resolve(dirPath);
        if (!isAllowed(resolved)) {
          sendJson(res, 403, {
            error: `Access denied. Allowed roots: ${fileRoots.join(', ')}`,
            path: dirPath,
          });
          return;
        }
        const dirents = fs.readdirSync(resolved, { withFileTypes: true });
        const entries = dirents
          .filter(d => !d.name.startsWith('.'))
          .map(d => {
            const isDir = d.isDirectory();
            let size = 0;
            if (!isDir) {
              try {
                size = fs.statSync(path.join(resolved, d.name)).size;
              } catch {
                /* */
              }
            }
            return {
              name: d.name,
              isDirectory: isDir,
              size,
              extension: isDir ? '' : path.extname(d.name).toLowerCase(),
            };
          })
          .sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
            return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
          });
        const parentDir = path.dirname(resolved);
        sendJson(res, 200, {
          path: resolved,
          parent: isAllowed(parentDir) ? parentDir : '',
          entries,
        });
        return;
      }

      // gRPC proxy
      const grpcMatch = pathname.match(/^\/api\/grpc\/([^\/]+)\/([^\/]+)/);
      if (grpcMatch && req.method === 'POST') {
        const [, service, method] = grpcMatch;
        const body = await readBody(req);
        let params = body ? JSON.parse(body) : {};
        params = transformObjectPtrParams(service, method, params);
        const response = await grpcClient.callMethod(service, method, params);
        sendJson(res, 200, response || {});
        return;
      }

      // Static file serving (production Electron)
      if (options.staticDir) {
        const filePath = pathname === '/' ? '/index.html' : pathname;
        const fullPath = path.join(options.staticDir, filePath);
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
          const ext = path.extname(fullPath).toLowerCase();
          const mimeTypes: Record<string, string> = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.woff2': 'font/woff2',
            '.woff': 'font/woff',
            '.ttf': 'font/ttf',
          };
          res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
          fs.createReadStream(fullPath).pipe(res);
          return;
        }
        // SPA fallback — serve index.html for non-API, non-file routes
        if (!pathname.startsWith('/api/')) {
          const indexPath = path.join(options.staticDir, 'index.html');
          if (fs.existsSync(indexPath)) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            fs.createReadStream(indexPath).pipe(res);
            return;
          }
        }
      }

      sendJson(res, 404, { error: 'Not found' });
    } catch (error: any) {
      log.error('Request error:', error.message);
      sendJson(res, 500, { error: error.message || 'Internal server error' });
    }
  });

  // WebSocket upgrade
  server.on('upgrade', (request, socket, head) => {
    if (request.url === '/api/callbacks') {
      const origin = request.headers.origin || '';
      if (origin && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }
      wss.handleUpgrade(request, socket, head, ws => {
        wss.emit('connection', ws, request);
      });
    }
  });

  return new Promise((resolve, reject) => {
    server.listen(port, '127.0.0.1', () => {
      log.info(`gRPC Proxy Server listening on http://127.0.0.1:${port}`);
      log.info('  HTTP API: /api/grpc/:service/:method');
      log.info('  WebSocket: /api/callbacks');
      log.info('  Health: /api/health');

      resolve({
        port,
        close: async () => {
          try {
            await grpcClient.unregisterOctaneCallbacks();
          } catch {
            /* */
          }
          grpcClient.close();
          wss.close();
          return new Promise<void>(res => server.close(() => res()));
        },
      });
    });

    server.on('error', reject);
  });
}
