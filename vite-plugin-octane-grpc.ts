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

import { OctaneGrpcClientBase, initGrpcLog } from './server/src/grpc/OctaneGrpcClientBase';
import { CallbackStreamManager, NewImageEvent } from './mcp/src/shared/CallbackStreamManager';

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

// ANSI color codes for server-side terminal output
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const MAX_BODY_SIZE = 50 * 1024 * 1024; // 50MB, matches Express server limit

// Server log helpers — leveled output with colors for errors/warnings
// Also writes to log_grpc.log so ALL server-side logs are captured in files.
let slogStream: fs.WriteStream | null = null;
function slogToFile(level: string, args: any[]): void {
  if (!slogStream) {
    try {
      const logPath = path.resolve(__dirname, 'log_grpc.log');
      slogStream = fs.createWriteStream(logPath, { flags: 'a' });
    } catch {
      return;
    }
  }
  const msg = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  slogStream.write(`${new Date().toISOString()} [${level}] ${msg}\n`);
}

const slog = {
  level: SERVER_LOG_LEVEL,
  error: (...args: any[]) => {
    if (SERVER_LOG_LEVEL >= ServerLogLevel.ERROR) console.error(RED, ...args, RESET);
    slogToFile('ERR', args);
  },
  warn: (...args: any[]) => {
    if (SERVER_LOG_LEVEL >= ServerLogLevel.WARN) console.warn(YELLOW, ...args, RESET);
    slogToFile('WRN', args);
  },
  info: (...args: any[]) => {
    if (SERVER_LOG_LEVEL >= ServerLogLevel.INFO) console.log(...args);
    slogToFile('INF', args);
  },
  debug: (...args: any[]) => {
    if (SERVER_LOG_LEVEL >= ServerLogLevel.DEBUG) console.log(...args);
    slogToFile('DBG', args);
  },
  debugV: (...args: any[]) => {
    if (SERVER_LOG_LEVEL >= ServerLogLevel.DEBUGV) console.log(...args);
    slogToFile('VRB', args);
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
  // newImage callbacks — kept inline (tightly coupled to render viewport data pipeline)
  private callbacks: Set<(data: any) => void> = new Set();
  private statisticsCallbacks: Set<(data: any) => void> = new Set();
  // Single callback stream manager — handles ALL callback types including newImage
  private sharedStream: CallbackStreamManager;
  // Legacy Sets wired to the shared manager for backward compat with WebSocket handlers
  private renderFailureCallbacks: Set<(data: any) => void> = new Set();
  private projectManagerCallbacks: Set<(data: any) => void> = new Set();
  private callbackId: number = 0;
  private isCallbackRegistered: boolean = false;
  private mcpRelayWs: any = null;
  private usingRelay = false;
  private relayProbeTimer: ReturnType<typeof setTimeout> | null = null;
  private grabFrameTimestamp = 0;
  private static readonly MCP_RELAY_URL = 'ws://127.0.0.1:51023';
  private static readonly GRAB_TIMEOUT_MS = 5000;

  constructor() {
    // Proto base path: the 'server/' directory relative to this file (project root)
    const protoBasePath = path.resolve(__dirname, 'server');
    this.base = new OctaneGrpcClientBase(undefined, undefined, protoBasePath);

    const isSandbox = this.base.address.includes('host.docker.internal');
    slog.info(`Vite gRPC Plugin: Connected to Octane at ${this.base.address}`);
    if (isSandbox) {
      slog.info(`Using Docker networking (sandbox environment detected)`);
    }

    // Single callback stream manager — handles ALL callback types.
    // handleNewImage: true enables newImage dispatching for the render viewport.
    // MCP leaves this false (it uses save_render on demand).
    this.sharedStream = new CallbackStreamManager((name: string) => this.base.getService(name), {
      handleNewImage: true,
      log: (msg: string, level?: string) => {
        const lvl =
          level === 'error'
            ? ServerLogLevel.ERROR
            : level === 'warn'
              ? ServerLogLevel.WARN
              : level === 'info'
                ? ServerLogLevel.INFO
                : ServerLogLevel.DEBUG;
        if (lvl <= slog.level) slog.info(`[CallbackStream] ${msg}`);
      },
      onConnectionLost: () => {
        slog.warn('Octane connection lost via callback stream — resetting gRPC channels');
        this.isCallbackRegistered = false;
        this.base.close();
      },
      onReconnected: () => {
        slog.info('Octane reconnected — re-registering callbacks');
        this.registerGrpcCallbacks().catch((e: any) => {
          slog.error(`Callback re-registration failed: ${e.message}`);
        });
      },
    });

    // Wire shared manager events to legacy callback Sets
    this.sharedStream.on('renderFailure', event => {
      slog.error('Render failure callback received');
      this.renderFailureCallbacks.forEach(cb => {
        try {
          cb({ user_data: event.userData, timestamp: event.timestamp });
        } catch (e) {
          slog.error('Error in renderFailure callback:', e);
        }
      });
    });
    this.sharedStream.on('projectManagerChanged', event => {
      slog.debug('Project manager changed callback received');
      this.projectManagerCallbacks.forEach(cb => {
        try {
          cb({ user_data: event.userData, timestamp: event.timestamp });
        } catch (e) {
          slog.error('Error in projectManagerChanged callback:', e);
        }
      });
    });
    this.sharedStream.on('newStatistics', () => {
      this.pollRenderStatistics();
    });
    this.sharedStream.on('newImage', (event: NewImageEvent) => {
      this.handleNewImageEvent(event);
    });
  }

  async initialize(): Promise<void> {
    // Vite uses lazy loading — no batch proto loading
    await this.base.initialize();
    slog.info(`Proto files ready for lazy loading`);

    // Auto-detect API version from connected Octane instance.
    // Switches compat layer (method names, field transforms, proto dir)
    // so the Vite proxy works with Alpha 5, Beta 2, or 2026.2.
    try {
      const { detectedVersion, changed } = await this.base.detectAndSetApiVersion();
      if (changed) {
        slog.info(`API version auto-detected: ${detectedVersion} — reloading protos`);
      } else {
        slog.info(`API version confirmed: ${detectedVersion}`);
      }
    } catch (e: any) {
      slog.warn(`API version detection failed (using default 2026.2): ${e.message}`);
    }
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

  get isCallbackActive(): boolean {
    return this.isCallbackRegistered;
  }

  // ========== Callback Management ==========

  private isRegistering = false;

  /** Register image + stats callback RPCs with Octane. Reusable for reconnection. */
  private async registerGrpcCallbacks(): Promise<void> {
    try {
      if (!this.callbackId) {
        this.callbackId = (Date.now() % 1000000000) + Math.floor(Math.random() * 1000);
      }
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
      this.isCallbackRegistered = true;
    } catch (error: any) {
      slog.error(`Failed to register gRPC callbacks: ${error.message}`);
    }
  }

  async registerOctaneCallbacks(): Promise<void> {
    if (this.isCallbackRegistered || this.isRegistering) return;
    this.isRegistering = true;

    try {
      slog.info(`Registering callbacks with ID: ${this.callbackId || '(new)'}`);
      await this.registerGrpcCallbacks();

      // Try MCP relay first (single shared stream), fall back to own gRPC stream
      this.connectToMcpRelay();
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
      this.stopRelayProbe();
      this.disconnectMcpRelay();
      this.sharedStream.stop();

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
   * Try connecting to MCP's callback relay on ws://127.0.0.1:51023.
   * If MCP is running, we consume its single gRPC callback stream — no duplicate.
   * If MCP isn't there, fall back to our own gRPC stream.
   */
  private connectToMcpRelay(): void {
    if (this.usingRelay || this.mcpRelayWs) return; // already connected or connecting
    // Use dynamic import() — Vite plugin runs in ESM context where require() fails
    import('ws')
      .then(({ WebSocket: WsClient }) => {
        slog.debug(`Attempting MCP relay connection to ${OctaneGrpcClient.MCP_RELAY_URL}`);
        const ws = new WsClient(OctaneGrpcClient.MCP_RELAY_URL, { handshakeTimeout: 2000 });
        let settled = false; // prevent double fallback from error+close
        let relayConfirmed = false;
        let watchdog: ReturnType<typeof setTimeout> | null = null;

        const clearWatchdog = () => {
          if (watchdog) {
            clearTimeout(watchdog);
            watchdog = null;
          }
        };

        ws.on('open', () => {
          settled = true;
          slog.info('Connected to MCP callback relay — waiting for first message');
          this.mcpRelayWs = ws;

          // Don't stop own stream yet — wait until relay proves it's alive.
          // Watchdog: if relay sends no messages within 3s, it's stale.
          watchdog = setTimeout(() => {
            if (!relayConfirmed) {
              slog.warn('MCP relay connected but silent for 3s — falling back to own stream');
              this.disconnectMcpRelay();
              this.fallbackToOwnStream('MCP relay silent');
            }
          }, 3000);
        });

        const confirmRelay = () => {
          if (relayConfirmed || this.mcpRelayWs !== ws) return;
          relayConfirmed = true;
          clearWatchdog();
          slog.info('MCP relay confirmed alive — switching from own stream');
          this.usingRelay = true;
          this.sharedStream.stop();
          this.stopRelayProbe();
        };

        ws.on('message', (raw: Buffer | string) => {
          confirmRelay();
          try {
            // Binary wire format: [4B headerLen LE] [JSON header] [optional pixel payload]
            const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
            if (buf.length < 4) return;
            const headerLen = buf.readUInt32LE(0);
            if (buf.length < 4 + headerLen) return;
            const msg = JSON.parse(buf.slice(4, 4 + headerLen).toString('utf8'));
            const pixelPayload = buf.length > 4 + headerLen ? buf.slice(4 + headerLen) : null;

            if (msg.type === 'heartbeat') {
              // Heartbeat proves relay is alive — nothing else to do
              return;
            }

            if (msg.type === 'newImage') {
              if (pixelPayload && msg.renderImage) {
                // Pixel data in binary payload
                const ri = msg.renderImage;
                this.notifyCallbacks({
                  callback_source: ri.callback_source || 'grpc',
                  callback_id: ri.callback_id || this.callbackId,
                  user_data: ri.user_data ?? 0,
                  render_images: {
                    data: [
                      {
                        buffer: { data: pixelPayload, size: pixelPayload.length },
                        size: { x: ri.width, y: ri.height },
                        type: ri.format,
                        pitch: ri.pitch,
                        sharedSurface: ri.sharedSurface,
                      },
                    ],
                  },
                });
              } else {
                // No pixels in callback — fetch via grabRenderResult (with gate timeout)
                this.grabFrameIfReady();
              }
              this.pollRenderStatistics();
            } else if (msg.type === 'newStatistics') {
              this.pollRenderStatistics();
            } else if (msg.type === 'renderFailure') {
              this.renderFailureCallbacks.forEach(cb => {
                try {
                  cb({ user_data: msg.userData, timestamp: msg.timestamp });
                } catch {
                  /* */
                }
              });
            } else if (msg.type === 'projectManagerChanged') {
              this.projectManagerCallbacks.forEach(cb => {
                try {
                  cb({ user_data: msg.userData, timestamp: msg.timestamp });
                } catch {
                  /* */
                }
              });
            }
          } catch (e: any) {
            slog.error('MCP relay message error:', e.message);
          }
        });

        ws.on('error', (err: any) => {
          clearWatchdog();
          if (!settled) {
            settled = true;
            slog.debug(`MCP relay error: ${err?.message || 'unknown'}`);
            this.fallbackToOwnStream('MCP relay unavailable');
          }
        });

        ws.on('close', () => {
          clearWatchdog();
          if (this.usingRelay) {
            this.usingRelay = false;
            this.mcpRelayWs = null;
            this.fallbackToOwnStream('MCP relay disconnected');
          } else if (!settled) {
            settled = true;
            this.fallbackToOwnStream('MCP relay closed before open');
          }
        });
      })
      .catch((e: any) => {
        slog.debug(`MCP relay import failed: ${e?.message}`);
        this.fallbackToOwnStream('ws module unavailable');
      });
  }

  /** Grab a frame if the gate is open, with 5s stuck-gate timeout. */
  private grabFrameIfReady(): void {
    // Reset stuck gate
    if (
      this.isGrabbingFrame &&
      Date.now() - this.grabFrameTimestamp > OctaneGrpcClient.GRAB_TIMEOUT_MS
    ) {
      slog.warn('grabRenderResult gate stuck for 5s — resetting');
      this.isGrabbingFrame = false;
    }
    if (this.isGrabbingFrame) return;
    this.isGrabbingFrame = true;
    this.grabFrameTimestamp = Date.now();
    this.callMethod('ApiRenderEngine', 'grabRenderResult', {})
      .then((result: any) => {
        if (result?.result && result.renderImages?.data?.length > 0) {
          this.notifyCallbacks({
            callback_source: 'grpc',
            callback_id: this.callbackId,
            user_data: 0,
            render_images: result.renderImages,
          });
        }
      })
      .catch(() => {
        /* non-fatal */
      })
      .finally(() => {
        this.isGrabbingFrame = false;
      });
  }

  private disconnectMcpRelay(): void {
    this.usingRelay = false;
    if (this.mcpRelayWs) {
      try {
        this.mcpRelayWs.close();
      } catch {
        /* */
      }
      this.mcpRelayWs = null;
    }
  }

  /** Probe for MCP relay with exponential backoff (10s → 20s → 40s → 60s cap). */
  private relayProbeAttempt = 0;
  private probeForRelay(delay = 10_000): void {
    if (this.relayProbeTimer) return; // probe already scheduled
    this.relayProbeTimer = setTimeout(() => {
      this.relayProbeTimer = null;
      if (this.usingRelay || !this.isCallbackRegistered) return;
      this.connectToMcpRelay();
    }, delay);
  }

  private stopRelayProbe(): void {
    if (this.relayProbeTimer) {
      clearTimeout(this.relayProbeTimer);
      this.relayProbeTimer = null;
    }
    this.relayProbeAttempt = 0;
  }

  private fallbackToOwnStream(reason: string): void {
    if (this.usingRelay) return; // still on relay, no fallback needed
    this.mcpRelayWs = null;
    if (!this.isCallbackRegistered) {
      slog.debug(`${reason} — but callbacks not registered, skipping fallback`);
      return;
    }
    // Only log first fallback at info level; subsequent probe failures are debug noise
    if (this.relayProbeAttempt === 0) {
      slog.info(`${reason} — falling back to own gRPC callback stream`);
    } else {
      slog.debug(`${reason} — still on own stream (probe #${this.relayProbeAttempt})`);
    }
    if (!this.sharedStream.isActive) {
      this.sharedStream.start();
    }
    // Probe for relay: first retry quick (2s — MCP may still be starting),
    // then exponential backoff (10s, 20s, 40s, 60s cap)
    this.relayProbeAttempt++;
    const delay =
      this.relayProbeAttempt === 1
        ? 2_000
        : Math.min(10_000 * Math.pow(2, this.relayProbeAttempt - 2), 60_000);
    this.probeForRelay(delay);
  }

  /**
   * Handle newImage events from the shared CallbackStreamManager.
   * Feeds render image data into the WebSocket pipeline for the browser viewport.
   *
   * When Octane provides a DXGI shared surface (sharedSurface non-null on ApiRenderImage),
   * extracts the adapter LUID and sends a lightweight descriptor alongside the pixel buffer.
   * The browser can use the descriptor for GPU-to-GPU rendering in Electron (Phase 2+).
   */
  private isGrabbingFrame = false;

  private handleNewImageEvent(event: NewImageEvent): void {
    const raw = event.raw;
    const renderImages = raw?.render_images;
    if (renderImages?.data?.length > 0) {
      // Alpha 5 path: pixel data included in the callback stream
      const payload: Record<string, any> = {
        callback_source: raw.callback_source || 'grpc',
        callback_id: raw.callback_id || this.callbackId,
        user_data: raw.user_data,
        render_images: renderImages,
      };

      // Detect DXGI shared surface (Phase 1: detection + metadata extraction)
      const firstImage = renderImages.data[0];
      if (firstImage.sharedSurface?.handle) {
        this.extractSharedSurfaceMetadata(firstImage, payload);
      }

      this.notifyCallbacks(payload);
    } else {
      // Our server path: callback is notification-only, fetch pixels on demand.
      this.grabFrameIfReady();
    }
    // Poll render statistics on each image callback
    this.pollRenderStatistics();
  }

  /** Log tracking for shared surface detection */
  private sharedSurfaceLogCount = 0;

  /**
   * Extract DXGI shared surface metadata and add to the WebSocket payload.
   * Runs async (fire-and-forget) to avoid blocking the image callback pipeline.
   * The pixel buffer (render_images) is always sent as fallback.
   */
  private extractSharedSurfaceMetadata(imageData: any, payload: Record<string, any>): void {
    this.sharedSurfaceLogCount++;
    if (this.sharedSurfaceLogCount === 1) {
      slog.info(
        '[SharedSurface] Detected non-null sharedSurface on render image — DXGI fast path available'
      );
    }

    // Extract LUID async — don't block the render pipeline
    this.callMethod('ApiSharedSurfaceService', 'getD3D11AdapterLuid', {
      objectPtr: imageData.sharedSurface,
    })
      .then((luidResponse: any) => {
        // Add lightweight descriptor to future frames (cached LUID)
        payload.shared_surface = {
          luid: String(luidResponse?.result || '0'),
          width: imageData.size?.x || 0,
          height: imageData.size?.y || 0,
          pitch: imageData.pitch || 0,
          imageType: String(imageData.type || 'unknown'),
          surfaceRef: imageData.sharedSurface.handle || '',
        };
      })
      .catch((err: any) => {
        if (this.sharedSurfaceLogCount <= 3) {
          slog.warn('[SharedSurface] Failed to get adapter LUID:', err.message);
        }
      })
      .finally(() => {
        // Release the shared surface reference to prevent memory leaks
        this.callMethod('ApiSharedSurfaceService', 'release', {
          objectPtr: imageData.sharedSurface,
        }).catch(() => {
          // Silently ignore release failures
        });
      });
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
    this.disconnectMcpRelay();
    this.sharedStream.stop();
    this.isCallbackRegistered = false;
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
      // Clear log files at startup — fresh logs each session
      for (const logFile of ['log_client.log', 'log_grpc.log']) {
        try {
          if (fs.existsSync(logFile)) {
            fs.unlinkSync(logFile);
            slog.debug(`Deleted old ${logFile}`);
          }
        } catch (error: any) {
          slog.warn(`Could not delete ${logFile}:`, error.message);
        }
      }

      // Write startup headers — AFTER deleting old files
      const startupTs = new Date().toISOString();
      fs.appendFileSync('log_client.log', `=== Client Log started ${startupTs} ===\n`);
      initGrpcLog(); // writes startup header to log_grpc.log

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
            if (ws.readyState !== WebSocket.OPEN) return;
            if (ws.bufferedAmount > MAX_WS_BUFFER) return; // backpressure: drop frame

            // Binary frame fast path: extract pixel buffer and send as binary WebSocket frame.
            // Wire format: [4B headerLen LE] [JSON header] [raw pixel bytes]
            // Eliminates base64 encoding overhead (~33% bandwidth) and JSON.parse cost on client.
            const firstImage = data?.render_images?.data?.[0];
            const pixelData = firstImage?.buffer?.data;
            if (pixelData && (Buffer.isBuffer(pixelData) || pixelData instanceof Uint8Array)) {
              const header = JSON.stringify({
                type: 'newImage',
                width: firstImage.size?.x,
                height: firstImage.size?.y,
                format: firstImage.type,
                pitch: firstImage.pitch,
                tonemappedSamplesPerPixel: firstImage.tonemappedSamplesPerPixel,
                renderTime: firstImage.renderTime,
                pixelSize: pixelData.length,
                sharedSurface: firstImage.sharedSurface,
              });
              const headerBuf = Buffer.from(header, 'utf8');
              const lenBuf = Buffer.alloc(4);
              lenBuf.writeUInt32LE(headerBuf.length, 0);
              const pixelBuf = Buffer.isBuffer(pixelData) ? pixelData : Buffer.from(pixelData);
              ws.send(Buffer.concat([lenBuf, headerBuf, pixelBuf]));
            } else {
              // Fallback: JSON text frame (e.g. notification-only callbacks without inline pixels)
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
              // Re-register callbacks if Octane came back after a disconnect
              if (isHealthy && grpcClient && !grpcClient.isCallbackActive) {
                grpcClient.registerOctaneCallbacks().catch(() => {});
              }
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
              const params = body ? JSON.parse(body) : {};
              // All param transforms happen inside callMethod() via transformRequestParams.

              const isHighFreq = method === 'getValueByAttrID';
              // DEBUG: log mutations (set*, create*, destroy, update, connect, disconnect, etc.)
              const isMutation =
                (method.startsWith('set') && method !== 'SetCamera') ||
                method.startsWith('create') ||
                method.startsWith('delete') ||
                method.startsWith('copy') ||
                method === 'destroy' ||
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
              // Downgrade expected errors to debug: stale handles (NOT_FOUND) and
              // SDK nodes that don't support reads (INTERNAL) on getValueByAttrID
              const isExpected =
                method === 'getValueByAttrID' &&
                (error.code === 5 ||
                  error.code === 13 ||
                  error.message?.includes('NOT_FOUND') ||
                  error.message?.includes('INTERNAL'));
              if (isExpected) {
                slog.debug?.(`API expected: ${service}.${method}: ${error.message}`);
              } else {
                slog.error(`API error: ${service}.${method}:`, error.message);
              }
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
