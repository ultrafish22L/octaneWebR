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
const DEBUG_FILE_LOG = true;
const LOG_FILE_PATH = path.resolve(__dirname, 'grpc-debug.log');

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

/**
 * Vite-specific gRPC client.
 * Wraps OctaneGrpcClientBase with Set-based callback management
 * (no EventEmitter since this runs inside the Vite dev server process).
 */
class OctaneGrpcClient {
  private base: OctaneGrpcClientBase;
  private callbacks: Set<(data: any) => void> = new Set();
  private statisticsCallbacks: Set<(data: any) => void> = new Set();
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

  async registerOctaneCallbacks(): Promise<void> {
    if (this.isCallbackRegistered) return;
    this.isCallbackRegistered = true; // Set immediately to prevent concurrent calls

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
      slog.info('Callback registration complete');
    } catch (error: any) {
      this.isCallbackRegistered = false; // Reset on failure
      slog.error(`Failed to register callbacks: ${error.message}`);
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
    } else if (callbackRequest.newStatistics) {
      // Note: Octane never sends newStatistics stream events in practice (see known-issues.md).
      // Kept for forward-compatibility; the newImage handler above is the real stats trigger.
      this.pollRenderStatistics();
    } else if (callbackRequest.projectManagerChanged) {
      slog.debug('Project manager changed callback received');
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
        slog.debug('Failed to poll render statistics:', err.message);
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
      const logFilePath = 'octaneWebR_client.log';
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

        const MAX_WS_BUFFER = 10 * 1024 * 1024; // 10 MB backpressure limit

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

        grpcClient?.registerCallback(callbackHandler);
        grpcClient?.addStatisticsCallback(statisticsHandler);

        ws.on('close', () => {
          slog.info('WebSocket client disconnected');
          grpcClient?.unregisterCallback(callbackHandler);
          grpcClient?.removeStatisticsCallback(statisticsHandler);
        });

        ws.on('error', error => {
          slog.error('WebSocket error:', error);
          grpcClient?.unregisterCallback(callbackHandler);
          grpcClient?.removeStatisticsCallback(statisticsHandler);
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

        // Health check endpoint
        if (url === '/api/health') {
          grpcClient
            ?.checkHealth()
            .then(isHealthy => {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(
                JSON.stringify({
                  status: isHealthy ? 'ok' : 'unhealthy',
                  octane: isHealthy ? 'connected' : 'disconnected',
                  server: 'vite',
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
        // Client log clear endpoint (camelCase to match client call)
        if (url === '/api/logClear' && req.method === 'POST') {
          try {
            fs.rmSync('octaneWebR_client.log', { force: true });
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

              fs.appendFile('octaneWebR_client.log', fileContent, err => {
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

              const isHighFreq = method === 'getByAttrID' || method === 'getValueByAttrID';
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
              if (!isHighFreq) {
                fileLog(` REQ ${service}.${method} ${JSON.stringify(params)}`);
              }
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
              if (!isHighFreq) {
                fileLog(` RES ${service}.${method} ${JSON.stringify(response).substring(0, 500)}`);
              }

              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify(response || {}));
            } catch (error: any) {
              fileLog(` ERR ${service}.${method} ${error.message}`);
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
          grpcClient = null as any;
        }
        if (wss) {
          wss.close();
          wss = null as any;
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
