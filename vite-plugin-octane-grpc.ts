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
// Set to true to enable detailed server-side logging
// Set to false (default) to suppress server logs for cleaner console output
const DEBUG_SERVER_LOGS = false;

// ============================================================================
// FILE LOGGING CONFIGURATION
// ============================================================================
// Set to true to log all gRPC request/response pairs to a file
const DEBUG_FILE_LOG = false;
const LOG_FILE_PATH = path.resolve(__dirname, 'grpc-debug.log');

// Truncate log file on startup
if (DEBUG_FILE_LOG) {
  fs.writeFileSync(LOG_FILE_PATH, `=== gRPC Debug Log started ${new Date().toISOString()} ===\n`);
}

function fileLog(msg: string) {
  if (!DEBUG_FILE_LOG) return;
  const ts = new Date().toISOString().substring(11, 23);
  fs.appendFileSync(LOG_FILE_PATH, `[${ts}] ${msg}\n`);
}

// ANSI color codes for server-side terminal output
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

// Server log helpers — colors for errors/warnings, plain for info/debug
const serverLog = (...args: any[]) => {
  if (DEBUG_SERVER_LOGS) console.log(...args);
};
const serverError = (...args: any[]) => {
  if (DEBUG_SERVER_LOGS) console.error(RED, ...args, RESET);
};
const serverWarn = (...args: any[]) => {
  if (DEBUG_SERVER_LOGS) console.warn(YELLOW, ...args, RESET);
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
    serverLog(` Vite gRPC Plugin: Connected to Octane at ${this.base.address}`);
    if (isSandbox) {
      serverLog(` Using Docker networking (sandbox environment detected)`);
    }
  }

  async initialize(): Promise<void> {
    // Vite uses lazy loading — no batch proto loading
    await this.base.initialize();
    serverLog(` Proto files ready for lazy loading`);
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

    try {
      this.callbackId = (Date.now() % 1000000000) + Math.floor(Math.random() * 1000);
      console.log(`Registering callbacks with ID: ${this.callbackId}`);

      await this.callMethod('ApiRenderEngine', 'setOnNewImageCallback', {
        callback: { callbackSource: 'grpc', callbackId: this.callbackId },
        userData: 0,
      });

      await this.callMethod('ApiRenderEngine', 'setOnNewStatisticsCallback', {
        callback: { callbackSource: 'grpc', callbackId: this.callbackId },
        userData: 0,
      });

      this.isCallbackRegistered = true;
      this.startCallbackStreaming();
      console.log('Callback registration complete');
    } catch (error: any) {
      console.error(`${RED}Failed to register callbacks: ${error.message}${RESET}`);
    }
  }

  async unregisterOctaneCallbacks(): Promise<void> {
    if (!this.isCallbackRegistered) return;

    try {
      if (this.callbackStream) {
        this.streamActive = false;
        this.callbackStream.cancel();
        this.callbackStream = null;
        serverLog(` Callback stream closed`);
      }

      await this.callMethod('ApiRenderEngine', 'setOnNewImageCallback', {
        callback: null,
        userData: 0,
      });

      serverLog(` Callbacks unregistered`);
      this.isCallbackRegistered = false;
      this.callbackId = 0;
    } catch (error: any) {
      serverError(` Failed to unregister callback:`, error.message);
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
    } else if (callbackRequest.renderFailure) {
      console.error(`${RED}Render failure callback received${RESET}`);
    } else if (callbackRequest.newStatistics) {
      this.notifyStatisticsCallbacks({
        callback_source: 'grpc',
        callback_id: this.callbackId,
        user_data: callbackRequest.newStatistics.user_data,
        statistics: callbackRequest.newStatistics.statistics,
      });
    } else if (callbackRequest.projectManagerChanged) {
      console.log('Project manager changed callback received');
    }
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
          serverError(' Error processing callback data:', error.message);
        }
      });

      this.callbackStream.on('error', (error: any) => {
        serverError(' Callback stream error:', error.message);
        this.streamActive = false;
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
        serverLog(' Callback stream ended');
        this.streamActive = false;
        this.callbackStream = null;
      });

      serverLog(' Callback streaming active');
    } catch (error: any) {
      serverError(' Failed to start callback streaming:', error.message);
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
        console.error(`${RED}Error in image callback:${RESET}`, error);
      }
    });
  }

  private notifyStatisticsCallbacks(data: any): void {
    this.statisticsCallbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        serverError(' Error in statistics callback handler:', error);
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
          serverLog(' Deleted old client log file');
        }
      } catch (error: any) {
        serverWarn(' Could not delete old log file:', error.message);
      }

      // Initialize gRPC client
      grpcClient = new OctaneGrpcClient();
      await grpcClient.initialize();

      // Register Octane callbacks
      try {
        await grpcClient.registerOctaneCallbacks();
      } catch (error: any) {
        serverError(' Initial callback registration failed:', error.message);
      }

      // Setup WebSocket server for callbacks
      wss = new WebSocketServer({ noServer: true });

      wss.on('connection', (ws: WebSocket) => {
        console.log('WebSocket client connected');

        const callbackHandler = (data: any) => {
          try {
            ws.send(JSON.stringify({ type: 'newImage', data }));
          } catch (error) {
            console.error(`${RED}Error sending WebSocket message:${RESET}`, error);
          }
        };

        const statisticsHandler = (data: any) => {
          try {
            // ws.send(JSON.stringify({ type: 'newStatistics', data }));
          } catch (error) {
            console.error(`${RED}Error sending statistics message:${RESET}`, error);
          }
        };

        grpcClient?.registerCallback(callbackHandler);
        grpcClient?.addStatisticsCallback(statisticsHandler);

        ws.on('close', () => {
          console.log('WebSocket client disconnected');
          grpcClient?.unregisterCallback(callbackHandler);
          grpcClient?.removeStatisticsCallback(statisticsHandler);
        });

        ws.on('message', (message: string) => {
          try {
            JSON.parse(message.toString()); // validate
          } catch (error) {
            console.error(`${RED}Error parsing WebSocket message:${RESET}`, error);
          }
        });
      });

      // Handle WebSocket upgrade
      server.httpServer?.on('upgrade', (request: IncomingMessage, socket, head) => {
        const url = request.url;
        if (url === '/api/callbacks') {
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
          (async () => {
            try {
              const isHealthy = await grpcClient?.checkHealth();
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
            } catch (error: any) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(
                JSON.stringify({
                  status: 'error',
                  error: error.message,
                  timestamp: new Date().toISOString(),
                })
              );
            }
          })();
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
          req.on('data', chunk => (body += chunk));
          req.on('end', () => {
            try {
              const logData = JSON.parse(body);
              const timestamp = new Date().toISOString();
              const logLine = `${timestamp} ${logData.level.toUpperCase()} ${logData.message}\n`;

              fs.appendFileSync('octaneWebR_client.log', logLine);

              // Console output with ANSI colors for errors/warnings
              const logLevel = logData.level.toLowerCase();
              if (logLevel === 'error') {
                console.error(`${RED}${logData.message}${RESET}`);
              } else if (logLevel === 'warn') {
                console.warn(`${YELLOW}${logData.message}${RESET}`);
              } else {
                console.log(logData.message);
              }

              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true }));
            } catch (error: any) {
              serverError(' Failed to write client log:', error.message);
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
          req.on('data', chunk => {
            body += chunk.toString();
          });

          req.on('end', async () => {
            try {
              let params = body ? JSON.parse(body) : {};

              // Unified parameter transforms (shared with Express server)
              params = transformObjectPtrParams(service, method, params);

              // Verbose API logging
              serverLog(` ${service}.${method}`, JSON.stringify(params).substring(0, 100));
              const isHighFreq = method === 'getByAttrID' || method === 'getValueByAttrID';
              if (!isHighFreq) {
                fileLog(` REQ ${service}.${method} ${JSON.stringify(params)}`);
              }
              const response = await grpcClient?.callMethod(service, method, params);
              serverLog(` ${service}.${method} → ${JSON.stringify(response).substring(0, 100)}`);
              if (!isHighFreq) {
                fileLog(` RES ${service}.${method} ${JSON.stringify(response).substring(0, 500)}`);
              }

              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify(response || {}));
            } catch (error: any) {
              fileLog(` ERR ${service}.${method} ${error.message}`);
              serverError(` API error: ${service}.${method}:`, error.message);
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

      serverLog(' Octane gRPC Plugin configured');
      serverLog('   • HTTP API: /api/grpc/:service/:method');
      serverLog('   • WebSocket: /api/callbacks');
      serverLog('   • Health: /api/health');
    },

    async closeBundle() {
      if (grpcClient) {
        try {
          await grpcClient.unregisterOctaneCallbacks();
        } catch (error) {
          serverError(' Error unregistering callbacks:', error);
        }
        grpcClient.close();
      }
      if (wss) {
        wss.close();
      }
    },
  };
}
