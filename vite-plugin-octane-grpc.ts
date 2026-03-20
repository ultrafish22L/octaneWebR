/**
 * Vite Plugin for Octane gRPC Integration
 *
 * This plugin integrates gRPC functionality directly into the Vite dev server,
 * eliminating the need for a separate Node.js Express server.
 *
 * Features:
 * - Direct gRPC calls to Octane LiveLink (127.0.0.1:51022)
 * - WebSocket streaming for OnNewImage callbacks
 * - Health check endpoint
 * - All running within the Vite dev server
 */

import { Plugin, ViteDevServer } from 'vite';
import { WebSocketServer, WebSocket } from 'ws';
import * as path from 'path';
import * as fs from 'fs';
import { IncomingMessage } from 'http';

import {
  OctaneGrpcClientBase,
  transformObjectPtrParams,
} from './server/src/grpc/OctaneGrpcClientBase';

// ============================================================================
// SERVER LOGGING CONFIGURATION
// ============================================================================
// Log levels: NONE < ERROR < WARN < INFO < DEBUG < DEBUGV
// ERROR/WARN always print. INFO shows startup & connection events.
// DEBUG shows gRPC calls & callback lifecycle. DEBUGV shows per-request detail.
enum ServerLogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  DEBUGV = 5,
}
const SERVER_LOG_LEVEL: ServerLogLevel = ServerLogLevel.DEBUG;

// ============================================================================
// FILE LOGGING CONFIGURATION
// ============================================================================
// Set to true to log all gRPC request/response pairs to a file
const DEBUG_FILE_LOG = process.env.DEBUG_FILE_LOG !== 'false';
const LOG_FILE_PATH = path.resolve(__dirname, 'log_grpc.log');

// Truncate log file on startup
if (DEBUG_FILE_LOG) {
  fs.writeFileSync(LOG_FILE_PATH, `=== gRPC Debug Log started ${new Date().toISOString()} ===\n`);
}

function fileLog(msg: string) {
  if (!DEBUG_FILE_LOG) return;
  const ts = new Date().toISOString().substring(11, 23);
  fs.appendFile(LOG_FILE_PATH, `[${ts}] ${msg}\n`, err => {
    if (err) console.error('fileLog write failed:', err.message);
  });
}

// ANSI color codes for server-side terminal output
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const MAX_BODY_SIZE = 50 * 1024 * 1024; // 50MB, matches Express server limit

// Server log helpers — leveled output with colors for errors/warnings
const slog = {
  error: (...args: any[]) => {
    if (SERVER_LOG_LEVEL >= ServerLogLevel.ERROR) console.error(RED, ...args, RESET);
  },
  warn: (...args: any[]) => {
    if (SERVER_LOG_LEVEL >= ServerLogLevel.WARN) console.warn(YELLOW, ...args, RESET);
  },
  info: (...args: any[]) => {
    if (SERVER_LOG_LEVEL >= ServerLogLevel.INFO) console.log(...args);
  },
  debug: (...args: any[]) => {
    if (SERVER_LOG_LEVEL >= ServerLogLevel.DEBUG) console.log(...args);
  },
  debugV: (...args: any[]) => {
    if (SERVER_LOG_LEVEL >= ServerLogLevel.DEBUGV) console.log(...args);
  },
};

// ============================================================================
// API CACHE — serves trimmed metadata from mcp/data/octane-api-cache.json
// ============================================================================

const API_CACHE_PATH = path.resolve(__dirname, 'mcp/data/octane-api-cache.json');
let octaneCachePayload: string | null = null;

/** Convert JUCE 0xAARRGGBB packed int to #RRGGBB hex string */
function juceColorToHex(color: number): string {
  const hex = (color >>> 0).toString(16).padStart(8, '0');
  return '#' + hex.substring(2, 8).toUpperCase();
}

/** Build trimmed client-specific cache payload from the full MCP cache */
function buildClientCachePayload(): string | null {
  if (!fs.existsSync(API_CACHE_PATH)) return null;

  const raw = JSON.parse(fs.readFileSync(API_CACHE_PATH, 'utf-8'));

  // Transform pin type colors: numeric JUCE → hex string
  const pinTypes: Record<string, { color: string }> = {};
  for (const [key, val] of Object.entries(raw.pinTypes || {})) {
    pinTypes[key] = { color: juceColorToHex((val as { color: number }).color) };
  }

  // Transform compatible types: string[] → { key, id }[]
  const compatibleTypes: Record<string, { nodes: Array<{ key: string; id: number }> }> = {};
  const nameToId: Record<string, number> = raw.nodeTypesByName || {};
  for (const [pinType, val] of Object.entries(raw.compatibleTypes || {})) {
    const nodes = ((val as { nodes: string[] }).nodes || [])
      .filter((n: string) => nameToId[n] !== undefined)
      .map((n: string) => ({ key: n, id: Number(nameToId[n]) }));
    if (nodes.length > 0) {
      compatibleTypes[pinType] = { nodes };
    }
  }

  // Transform node types: trim to client-needed fields, convert colors
  const nodeTypes: Record<
    string,
    {
      id: number;
      name: string;
      category: string;
      color: string;
      outType: string;
      isHidden: boolean;
      movableInputPinCount: number;
      movableInputName: string;
    }
  > = {};
  for (const [key, val] of Object.entries(raw.nodeTypes || {})) {
    const nt = val as {
      name: string;
      defaultName: string;
      category: string;
      nodeColor: number;
      outType: string;
      isHidden: boolean;
      movableInputPinCount: number;
      movableInputName: string;
    };
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

  const payload = {
    meta: raw.meta,
    pinTypes,
    compatibleTypes,
    nodeTypes,
  };

  slog.info(
    `API cache loaded: ${Object.keys(nodeTypes).length} node types, ${Object.keys(compatibleTypes).length} pin compatibilities`
  );
  return JSON.stringify(payload);
}

// ============================================================================

/**
 * Vite-specific gRPC client.
 * Wraps OctaneGrpcClientBase with Set-based callback management
 * (no EventEmitter since this runs inside the Vite dev server process).
 */
class OctaneGrpcClient {
  private base: OctaneGrpcClientBase;
  private callbacks: Set<(data: any) => void> = new Set();
  private statisticsCallbacks: Set<(data: any) => void> = new Set();
  private renderFailureCallbacks: Set<(data: any) => void> = new Set();
  private projectManagerCallbacks: Set<(data: any) => void> = new Set();
  private callbackId: number = 0;
  private isCallbackRegistered: boolean = false;
  private callbackStream: any = null;
  private streamActive: boolean = false;

  constructor() {
    // Proto base path: the 'server/' directory relative to this file (project root)
    const protoBasePath = path.resolve(__dirname, 'server');
    this.base = new OctaneGrpcClientBase(undefined, undefined, protoBasePath);

    const isSandbox = this.base.address.includes('host.docker.internal');
    slog.info(`Vite gRPC Plugin: Connected to Octane at ${this.base.address}`);
    if (isSandbox) {
      slog.info(`Using Docker networking (sandbox environment detected)`);
    }
  }

  async initialize(): Promise<void> {
    // Vite uses lazy loading — no batch proto loading
    await this.base.initialize();
    slog.info(`Proto files ready for lazy loading`);
  }

  async callMethod(
    serviceName: string,
    methodName: string,
    params: any = {},
    options: any = {}
  ): Promise<any> {
    return this.base.callMethod(serviceName, methodName, params, options);
  }

  async checkHealth(): Promise<boolean> {
    return this.base.checkHealth();
  }

  // ========== Callback Management ==========

  private isRegistering = false;

  async registerOctaneCallbacks(): Promise<void> {
    if (this.isCallbackRegistered || this.isRegistering) return;
    this.isRegistering = true;

    try {
      this.callbackId = (Date.now() % 1000000000) + Math.floor(Math.random() * 1000);
      slog.info(`Registering callbacks with ID: ${this.callbackId}`);

      await this.callMethod('ApiRenderEngine', 'setOnNewImageCallback', {
        callback: { callbackSource: 'grpc', callbackId: this.callbackId },
        userData: 0,
      });
      slog.debug('Image callback registered');

      try {
        await this.callMethod('ApiRenderEngine', 'setOnNewStatisticsCallback', {
          callback: { callbackSource: 'grpc', callbackId: this.callbackId },
          userData: 0,
        });
        slog.debug('Statistics callback registered');
      } catch (statsError: any) {
        slog.warn('Statistics callback registration failed (non-fatal):', statsError.message);
      }

      this.startCallbackStreaming();
      this.isCallbackRegistered = true;
      slog.info('Callback registration complete');
    } catch (error: any) {
      slog.error(`Failed to register callbacks: ${error.message}`);
    } finally {
      this.isRegistering = false;
    }
  }

  async unregisterOctaneCallbacks(): Promise<void> {
    if (!this.isCallbackRegistered) return;

    // Set flag before cancel to prevent the async error event from triggering a reconnect
    this.isCallbackRegistered = false;

    try {
      if (this.callbackStream) {
        this.streamActive = false;
        this.callbackStream.cancel();
        this.callbackStream = null;
        slog.debug('Callback stream closed');
      }

      await this.callMethod('ApiRenderEngine', 'setOnNewImageCallback', {
        callback: null,
        userData: 0,
      });

      slog.info('Callbacks unregistered');
      this.callbackId = 0;
    } catch (error: any) {
      slog.error('Failed to unregister callback:', error.message);
    }
  }

  /**
   * Dispatch a single callback stream response to the appropriate handler.
   */
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
      // Poll render statistics on each image callback
      this.pollRenderStatistics();
    } else if (callbackRequest.renderFailure) {
      slog.error('Render failure callback received');
      this.renderFailureCallbacks.forEach(cb => {
        try {
          cb({ user_data: callbackRequest.renderFailure?.user_data, timestamp: Date.now() });
        } catch (e) {
          slog.error('Error in renderFailure callback:', e);
        }
      });
    } else if (callbackRequest.newStatistics) {
      // Note: Octane never sends newStatistics stream events in practice (see known-issues.md).
      // Kept for forward-compatibility; the newImage handler above is the real stats trigger.
      this.pollRenderStatistics();
    } else if (callbackRequest.projectManagerChanged) {
      slog.debug('Project manager changed callback received');
      this.projectManagerCallbacks.forEach(cb => {
        try {
          cb({
            user_data: callbackRequest.projectManagerChanged?.user_data,
            timestamp: Date.now(),
          });
        } catch (e) {
          slog.error('Error in projectManagerChanged callback:', e);
        }
      });
    }
  }

  private isPollingStatistics = false;
  private lastStatsPollTime = 0;
  private static readonly STATS_POLL_INTERVAL = 250; // ms — throttle to max 4 polls/sec

  private pollRenderStatistics(): void {
    // Serialize: skip if a poll is already in flight to avoid overwhelming the gRPC channel
    if (this.isPollingStatistics) return;
    // Throttle: skip if polled too recently
    const now = Date.now();
    if (now - this.lastStatsPollTime < OctaneGrpcClient.STATS_POLL_INTERVAL) return;
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
      .catch((err: any) => {
        slog.warn('Failed to poll render statistics:', err.message);
      })
      .finally(() => {
        this.isPollingStatistics = false;
      });
  }

  /**
   * Start streaming callbacks from Octane via StreamCallbackService.
   */
  private startCallbackStreaming(): void {
    if (this.callbackStream || this.streamActive) return;

    try {
      this.streamActive = true;
      const streamService = this.base.getService('StreamCallbackService');
      this.callbackStream = streamService.callbackChannel({});

      this.callbackStream.on('data', (callbackRequest: any) => {
        try {
          this.handleCallbackData(callbackRequest);
        } catch (error: any) {
          slog.error('Error processing callback data:', error.message);
        }
      });

      this.callbackStream.on('error', (error: any) => {
        slog.error('Callback stream error:', error.message);
        this.streamActive = false;
        // Cancel the stream before releasing the reference to free server-side resources
        try {
          this.callbackStream?.cancel();
        } catch {
          /* already errored */
        }
        this.callbackStream = null;

        if (this.isCallbackRegistered) {
          setTimeout(() => {
            if (this.isCallbackRegistered) {
              this.startCallbackStreaming();
            }
          }, 5000);
        }
      });

      this.callbackStream.on('end', () => {
        slog.debug('Callback stream ended');
        this.streamActive = false;
        this.callbackStream = null;
      });

      slog.info('Callback streaming active');
    } catch (error: any) {
      slog.error('Failed to start callback streaming:', error.message);
      this.streamActive = false;
      this.callbackStream = null;
    }
  }

  registerCallback(callback: (data: any) => void): void {
    this.callbacks.add(callback);
  }

  unregisterCallback(callback: (data: any) => void): void {
    this.callbacks.delete(callback);
  }

  addStatisticsCallback(callback: (data: any) => void): void {
    this.statisticsCallbacks.add(callback);
  }

  removeStatisticsCallback(callback: (data: any) => void): void {
    this.statisticsCallbacks.delete(callback);
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
    this.callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        slog.error('Error in image callback:', error);
      }
    });
  }

  private notifyStatisticsCallbacks(data: any): void {
    this.statisticsCallbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        slog.error('Error in statistics callback handler:', error);
      }
    });
  }

  close(): void {
    this.base.close();
  }
}

// ============================================================================
// VITE PLUGIN
// ============================================================================

export function octaneGrpcPlugin(): Plugin {
  let grpcClient: OctaneGrpcClient | null = null;
  let wss: WebSocketServer | null = null;

  return {
    name: 'vite-plugin-octane-grpc',

    async configureServer(server: ViteDevServer) {
      // Delete old log file at startup (before logging is initialized)
      const logFilePath = 'log_client.log';
      try {
        if (fs.existsSync(logFilePath)) {
          fs.unlinkSync(logFilePath);
          slog.debug('Deleted old client log file');
        }
      } catch (error: any) {
        slog.warn('Could not delete old log file:', error.message);
      }

      // Initialize gRPC client
      grpcClient = new OctaneGrpcClient();
      await grpcClient.initialize();

      // Register Octane callbacks
      try {
        await grpcClient.registerOctaneCallbacks();
      } catch (error: any) {
        slog.error('Initial callback registration failed:', error.message);
      }

      // Setup WebSocket server for callbacks
      wss = new WebSocketServer({ noServer: true });

      wss.on('connection', (ws: WebSocket) => {
        slog.info('WebSocket client connected');

        // 10 MB backpressure limit (keep in sync with server/src/api/websocket.ts)
        const MAX_WS_BUFFER = 10 * 1024 * 1024;

        const callbackHandler = (data: any) => {
          try {
            if (ws.readyState === WebSocket.OPEN) {
              if (ws.bufferedAmount > MAX_WS_BUFFER) return; // backpressure: drop frame
              ws.send(JSON.stringify({ type: 'newImage', data }));
            }
          } catch (error) {
            slog.error('Error sending WebSocket message:', error);
          }
        };

        const statisticsHandler = (data: any) => {
          try {
            if (ws.readyState === WebSocket.OPEN) {
              if (ws.bufferedAmount > MAX_WS_BUFFER) return;
              ws.send(JSON.stringify({ type: 'newStatistics', data }));
            }
          } catch (error) {
            slog.error('Error sending statistics message:', error);
          }
        };

        const renderFailureHandler = (data: any) => {
          try {
            if (ws.readyState === WebSocket.OPEN) {
              if (ws.bufferedAmount > MAX_WS_BUFFER) return;
              ws.send(JSON.stringify({ type: 'renderFailure', data }));
            }
          } catch (error) {
            slog.error('Error sending renderFailure message:', error);
          }
        };

        const projectManagerHandler = (data: any) => {
          try {
            if (ws.readyState === WebSocket.OPEN) {
              if (ws.bufferedAmount > MAX_WS_BUFFER) return;
              ws.send(JSON.stringify({ type: 'projectManagerChanged', data }));
            }
          } catch (error) {
            slog.error('Error sending projectManagerChanged message:', error);
          }
        };

        grpcClient?.registerCallback(callbackHandler);
        grpcClient?.addStatisticsCallback(statisticsHandler);
        grpcClient?.addRenderFailureCallback(renderFailureHandler);
        grpcClient?.addProjectManagerCallback(projectManagerHandler);

        ws.on('close', () => {
          slog.info('WebSocket client disconnected');
          grpcClient?.unregisterCallback(callbackHandler);
          grpcClient?.removeStatisticsCallback(statisticsHandler);
          grpcClient?.removeRenderFailureCallback(renderFailureHandler);
          grpcClient?.removeProjectManagerCallback(projectManagerHandler);
        });

        ws.on('error', error => {
          slog.error('WebSocket error:', error);
          grpcClient?.unregisterCallback(callbackHandler);
          grpcClient?.removeStatisticsCallback(statisticsHandler);
          grpcClient?.removeRenderFailureCallback(renderFailureHandler);
          grpcClient?.removeProjectManagerCallback(projectManagerHandler);
        });

        ws.on('message', (message: string) => {
          try {
            const data = JSON.parse(message.toString());
            if (data.type === 'ping') {
              ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            }
          } catch (error) {
            slog.warn('Error parsing WebSocket message:', error);
          }
        });
      });

      // Handle WebSocket upgrade (with origin validation matching Express server)
      server.httpServer?.on('upgrade', (request: IncomingMessage, socket, head) => {
        const url = request.url;
        if (url === '/api/callbacks') {
          const origin = request.headers.origin || '';
          if (origin && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
            socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
            socket.destroy();
            return;
          }
          wss?.handleUpgrade(request, socket, head, ws => {
            wss?.emit('connection', ws, request);
          });
        }
      });

      // Add API endpoints
      server.middlewares.use((req, res, next) => {
        const url = req.url;

        // Health check endpoint (5s timeout to prevent hanging if Octane is stuck)
        if (url === '/api/health') {
          const healthTimeout = new Promise<boolean>((_, reject) =>
            setTimeout(() => reject(new Error('Health check timed out')), 5000)
          );
          Promise.race([grpcClient?.checkHealth() ?? Promise.resolve(false), healthTimeout])
            .then(isHealthy => {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(
                JSON.stringify({
                  status: isHealthy ? 'ok' : 'unhealthy',
                  octane: isHealthy ? 'connected' : 'disconnected',
                  server: 'vite',
                  isLocal: true,
                  timestamp: new Date().toISOString(),
                })
              );
            })
            .catch((error: any) => {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(
                JSON.stringify({
                  status: 'error',
                  error: error.message,
                  timestamp: new Date().toISOString(),
                })
              );
            });
          return;
        }
        // File listing endpoint for remote file browser
        // Path restricted to OCTANE_FILE_ROOTS (default: C:\otoyla). Set to "*" for unrestricted.
        if (url?.startsWith('/api/files/list')) {
          const fileRoots: string[] = (process.env.OCTANE_FILE_ROOTS || 'C:\\otoyla')
            .split(',')
            .map(r => path.resolve(r.trim()))
            .filter(Boolean);
          const unrestricted = fileRoots.length === 1 && fileRoots[0] === path.resolve('*');

          const isAllowed = (p: string): boolean => {
            if (unrestricted) return true;
            const resolved = path.resolve(p);
            return fileRoots.some(
              root => resolved === root || resolved.startsWith(root + path.sep)
            );
          };

          const urlObj = new URL(url, 'http://localhost');
          const dirPath = urlObj.searchParams.get('path') || '';
          res.setHeader('Content-Type', 'application/json');

          try {
            if (!dirPath) {
              // No path → show allowed roots (or all drives if unrestricted)
              if (unrestricted) {
                const entries: {
                  name: string;
                  isDirectory: boolean;
                  size: number;
                  extension: string;
                }[] = [];
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
                res.statusCode = 200;
                res.end(JSON.stringify({ path: '', parent: null, entries }));
              } else {
                const entries = fileRoots
                  .filter(r => fs.existsSync(r))
                  .map(r => ({
                    name: r,
                    isDirectory: true,
                    size: 0,
                    extension: '',
                  }));
                res.statusCode = 200;
                res.end(JSON.stringify({ path: '', parent: null, entries }));
              }
            } else {
              const resolved = path.resolve(dirPath);
              if (!isAllowed(resolved)) {
                res.statusCode = 403;
                res.end(
                  JSON.stringify({
                    error: `Access denied. Allowed roots: ${fileRoots.join(', ')}`,
                    path: dirPath,
                  })
                );
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
                      /* ignore */
                    }
                  }
                  const ext = isDir ? '' : path.extname(d.name).toLowerCase();
                  return { name: d.name, isDirectory: isDir, size, extension: ext };
                })
                .sort((a, b) => {
                  if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
                  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
                });
              const parentDir = path.dirname(resolved);
              // If parent is outside allowed roots, navigate back to root list
              const parent = isAllowed(parentDir) ? parentDir : '';
              res.statusCode = 200;
              res.end(JSON.stringify({ path: resolved, parent, entries }));
            }
          } catch (error: any) {
            res.statusCode = 400;
            res.end(
              JSON.stringify({ error: error.message || 'Cannot read directory', path: dirPath })
            );
          }
          return;
        }

        // API cache endpoint — serves trimmed node type metadata to the client.
        // Source: mcp/data/octane-api-cache.json (generated by scripts/fetch-api-cache.js)
        // Transforms server data (JUCE colors, string arrays) into client-ready format.
        if (url === '/api/octane-cache') {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'max-age=3600');
          try {
            if (!octaneCachePayload) {
              octaneCachePayload = buildClientCachePayload();
            }
            if (octaneCachePayload) {
              res.statusCode = 200;
              res.end(octaneCachePayload);
            } else {
              res.statusCode = 404;
              res.end(
                JSON.stringify({
                  error: 'API cache not available. Run: node scripts/fetch-api-cache.js',
                })
              );
            }
          } catch (err: unknown) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: String(err) }));
          }
          return;
        }

        // Scene refresh endpoint — broadcasts to all WebSocket clients to trigger scene tree rebuild.
        // Used by MCP or external tools that modify Octane directly (bypassing octaneWebR's gRPC connection).
        if (url === '/api/refresh-scene' && req.method === 'POST') {
          let broadcastCount = 0;
          wss?.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ type: 'refreshScene' }));
              broadcastCount++;
            }
          });
          slog.info(`Scene refresh broadcast to ${broadcastCount} client(s)`);
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 200;
          res.end(JSON.stringify({ success: true, clients: broadcastCount }));
          return;
        }

        // Smart scene event endpoint — broadcasts targeted events (nodeAdded, nodeDeleted, nodeChanged)
        // to WebSocket clients for incremental UI updates instead of full scene rebuilds.
        if (url === '/api/scene-event' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: Buffer) => {
            body += chunk.toString();
          });
          req.on('end', () => {
            try {
              const event = JSON.parse(body);
              let broadcastCount = 0;
              wss?.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify(event));
                  broadcastCount++;
                }
              });
              slog.info(`Scene event '${event.type}' broadcast to ${broadcastCount} client(s)`);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true, clients: broadcastCount }));
            } catch {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Invalid JSON body' }));
            }
          });
          return;
        }

        // Client log clear endpoint (camelCase to match client call)
        if (url === '/api/logClear' && req.method === 'POST') {
          try {
            fs.rmSync('log_client.log', { force: true });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', message: 'Log cleared' }));
          } catch (error: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'error', error: error.message }));
          }
          return;
        }

        // Client logging endpoint
        if (url === '/api/log' && req.method === 'POST') {
          let body = '';
          let aborted = false;
          req.on('error', () => {
            aborted = true;
          });
          req.on('data', chunk => {
            body += chunk;
            if (body.length > MAX_BODY_SIZE) {
              aborted = true;
              res.statusCode = 413;
              res.end(JSON.stringify({ error: 'Request body too large' }));
              req.destroy();
            }
          });
          req.on('end', () => {
            if (aborted) return;
            try {
              const logData = JSON.parse(body);
              const timestamp = new Date().toISOString();

              // Support both legacy single-message and new per-entry format
              const entries: { level: string; message: string }[] = logData.entries || [
                { level: logData.level || 'info', message: logData.message },
              ];

              let fileContent = '';
              for (const entry of entries) {
                const lvl = entry.level || 'info';
                fileContent += `${timestamp} ${lvl.toUpperCase()} ${entry.message}\n`;
              }

              fs.appendFile('log_client.log', fileContent, err => {
                if (err) slog.warn('Client log write failed:', err.message);
              });

              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true }));
            } catch (error: any) {
              slog.warn('Failed to write client log:', error.message);
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: error.message }));
            }
          });
          return;
        }

        // gRPC proxy endpoint
        const grpcMatch = url?.match(/^\/api\/grpc\/([^\/]+)\/([^\/\?]+)/);
        if (grpcMatch && req.method === 'POST') {
          const [, service, method] = grpcMatch;

          let body = '';
          let aborted = false;
          req.on('error', () => {
            aborted = true;
          });
          req.on('data', chunk => {
            body += chunk.toString();
            if (body.length > MAX_BODY_SIZE) {
              aborted = true;
              res.statusCode = 413;
              res.end(JSON.stringify({ error: 'Request body too large' }));
              req.destroy();
            }
          });

          req.on('end', async () => {
            if (aborted) return;
            try {
              let params = body ? JSON.parse(body) : {};

              // Unified parameter transforms (shared with Express server)
              params = transformObjectPtrParams(service, method, params);

              const isHighFreq = method === 'getValueByAttrID';
              // DEBUG: log mutations (set*, create*, destroy, update, connect, disconnect, etc.)
              const isMutation =
                method.startsWith('set') ||
                method.startsWith('create') ||
                method.startsWith('delete') ||
                method.startsWith('copy') ||
                method === 'destroy' ||
                method === 'update' ||
                method === 'connect' ||
                method === 'disconnect' ||
                method === 'group' ||
                method === 'ungroup' ||
                method === 'replace' ||
                method === 'move';
              if (isMutation) {
                const paramStr = JSON.stringify(params);
                slog.debug(
                  `${service}.${method}${paramStr !== '{}' ? ' ' + paramStr.substring(0, 120) : ''}`
                );
              }
              // DEBUGV: log all calls with params
              slog.debugV(`${service}.${method}`, JSON.stringify(params).substring(0, 100));
              // REQ/RES file logging moved to OctaneGrpcClientBase.callMethod()
              if (!grpcClient) {
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 503;
                res.end(JSON.stringify({ error: 'gRPC client not available' }));
                return;
              }
              const response = await grpcClient.callMethod(service, method, params);
              if (isMutation) {
                const resStr = JSON.stringify(response);
                if (resStr !== '{}') slog.debug(`  → ${resStr.substring(0, 120)}`);
              }
              slog.debugV(`${service}.${method} →`, JSON.stringify(response).substring(0, 100));
              // RES file logging moved to OctaneGrpcClientBase.callMethod()

              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify(response || {}));
            } catch (error: any) {
              // ERR file logging moved to OctaneGrpcClientBase.callMethod()
              slog.error(`API error: ${service}.${method}:`, error.message);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(
                JSON.stringify({
                  error: error.message || 'gRPC call failed',
                  service,
                  method,
                  code: error.code || 'UNKNOWN',
                })
              );
            }
          });

          return;
        }

        next();
      });

      // Ensure cleanup runs when the dev server shuts down (Ctrl+C, etc.)
      // closeBundle() only fires for production builds, not dev server
      server.httpServer?.on('close', () => {
        if (grpcClient) {
          grpcClient.unregisterOctaneCallbacks().catch(() => {});
          grpcClient.close();
          grpcClient = null!;
        }
        if (wss) {
          wss.close();
          wss = null!;
        }
      });

      slog.info('Octane gRPC Plugin configured');
      slog.info('  HTTP API: /api/grpc/:service/:method');
      slog.info('  WebSocket: /api/callbacks');
      slog.info('  Health: /api/health');
    },

    async closeBundle() {
      if (grpcClient) {
        try {
          await grpcClient.unregisterOctaneCallbacks();
        } catch (error) {
          slog.error('Error unregistering callbacks:', error);
        }
        grpcClient.close();
      }
      if (wss) {
        wss.close();
      }
    },
  };
}
