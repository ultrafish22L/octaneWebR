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
import { OctaneGrpcClientBase, initGrpcLog } from './OctaneGrpcClientBase';
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

const LOG_LEVEL = LogLevel.DEBUG;

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
  private isPollingStatistics = false;
  private lastStatsPollTime = 0;
  private mcpRelayWs: import('ws').WebSocket | null = null;
  private usingRelay = false;
  private relayWatchdog: ReturnType<typeof setTimeout> | null = null;
  private relayGotMessage = false;
  private static readonly STATS_POLL_INTERVAL = 250;
  private static readonly MCP_RELAY_URL = 'ws://127.0.0.1:51023';

  // dxSS shared surface state
  private dxAddon: any = null;
  private ssEnabled = false;
  private dxDeviceInitialized = false;
  /** In-flight shared surface handles: handleVal → { frameId, timestamp } */
  private ssInflight = new Map<number, { frameId: string; timestamp: number }>();
  /** Cleanup timer for stale shared surface handles */
  private ssCleanupTimer: ReturnType<typeof setInterval> | null = null;
  /** Handles older than this (ms) are considered stale and force-released */
  private static readonly SS_STALE_TIMEOUT = 10_000;
  /** How often to sweep for stale handles (ms) */
  private static readonly SS_CLEANUP_INTERVAL = 5_000;

  constructor(protoBasePath: string, dxAddon?: any) {
    this.base = new OctaneGrpcClientBase(undefined, undefined, protoBasePath);
    this.dxAddon = dxAddon || null;
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
    this.sharedStream.on('newStatistics', () => {
      log.debug('[ownStream] newStatistics event');
      this.pollRenderStatistics();
    });
    this.sharedStream.on('newImage', () => {
      log.debug('[ownStream] newImage event — calling grabAndNotifyImage');
      this.grabAndNotifyImage();
    });
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

      // Register our own callbacks and open our own gRPC stream.
      // Don't use the MCP relay — it breaks when serv restarts and heartbeats
      // mask the dead callback stream, preventing fallback.
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

      this.isCallbackRegistered = true;
      log.info('Callbacks registered (own stream)');

      // Enable dxSS shared surface mode if native addon is available
      await this.enableSharedSurface();
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
      this.disconnectMcpRelay();
      this.sharedStream.stop();
      await this.callMethod('ApiRenderEngine', 'setOnNewImageCallback', {
        callback: null,
        userData: 0,
      });
      log.info('Callbacks unregistered');
    } catch (error: any) {
      log.error('Failed to unregister callback:', error.message);
    }
  }

  /**
   * Try connecting to MCP's callback relay on ws://127.0.0.1:51023.
   * Returns true if connected (MCP owns the callback stream), false if unavailable.
   * When connected via relay, we must NOT register our own gRPC callbacks
   * (that would overwrite MCP's callbackId and break its stream).
   */
  private tryConnectToMcpRelay(): Promise<boolean> {
    return new Promise(resolve => {
      try {
        const { WebSocket: WsClient } = require('ws') as typeof import('ws');
        log.debug(`Attempting MCP relay connection to ${GrpcClient.MCP_RELAY_URL}`);
        const ws = new WsClient(GrpcClient.MCP_RELAY_URL, { handshakeTimeout: 2000 });
        let settled = false;

        ws.on('open', () => {
          settled = true;
          log.info('Connected to MCP callback relay — using shared stream');
          this.usingRelay = true;
          this.mcpRelayWs = ws;
          resolve(true);
        });

        ws.on('message', (raw: Buffer | string) => {
          this.relayGotMessage = true;
          try {
            // Relay sends binary frames: [4B headerLen LE][JSON header][optional pixel payload]
            const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
            log.debug(`[relay] message ${buf.length}B`);
            if (buf.length < 4) return;

            const headerLen = buf.readUInt32LE(0);
            if (headerLen <= 0 || headerLen > buf.length - 4) return;

            const headerStr = buf.toString('utf8', 4, 4 + headerLen);
            const msg = JSON.parse(headerStr);
            log.debug(`[relay] type=${msg.type} hasPixels=${buf.length > 4 + headerLen}`);

            if (msg.type === 'newImage') {
              // Check if the relay already included pixel data in this frame
              const pixelOffset = 4 + headerLen;
              const hasPixels = buf.length > pixelOffset && msg.renderImage;
              if (hasPixels) {
                // Relay sent full frame with pixels — forward directly to browser WS clients
                const ri = msg.renderImage;
                const pixelBuf = buf.subarray(pixelOffset);
                this.notifyCallbacks({
                  callback_source: ri.callback_source || 'relay',
                  callback_id: ri.callback_id || this.callbackId,
                  user_data: ri.user_data || 0,
                  render_images: {
                    data: [
                      {
                        buffer: { data: pixelBuf, size: pixelBuf.length },
                        size: { x: ri.width, y: ri.height },
                        type: ri.format,
                        pitch: ri.pitch,
                        tonemappedSamplesPerPixel: ri.tonemappedSamplesPerPixel || 0,
                        renderTime: ri.renderTime || 0,
                      },
                    ],
                  },
                });
              } else {
                // No pixel data in relay frame — grab pixels ourselves
                this.grabAndNotifyImage();
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
            log.error('MCP relay message error:', e.message);
          }
        });

        ws.on('error', (err: any) => {
          if (!settled) {
            settled = true;
            log.debug(`MCP relay error: ${err?.message || 'unknown'}`);
            resolve(false);
          }
        });

        ws.on('close', () => {
          if (this.usingRelay) {
            this.usingRelay = false;
            this.mcpRelayWs = null;
            this.fallbackToOwnStream('MCP relay disconnected');
          } else if (!settled) {
            settled = true;
            resolve(false);
          }
        });
      } catch (e: any) {
        log.debug(`MCP relay require failed: ${e?.message}`);
        resolve(false);
      }
    });
  }

  private disconnectMcpRelay(): void {
    this.usingRelay = false;
    this.relayGotMessage = false;
    if (this.relayWatchdog) {
      clearTimeout(this.relayWatchdog);
      this.relayWatchdog = null;
    }
    if (this.mcpRelayWs) {
      try {
        this.mcpRelayWs.close();
      } catch {
        /* */
      }
      this.mcpRelayWs = null;
    }
  }

  private fallbackToOwnStream(reason: string): void {
    if (this.usingRelay) return;
    this.mcpRelayWs = null;
    if (!this.isCallbackRegistered) {
      log.debug(`${reason} — but callbacks not registered, skipping fallback`);
      return;
    }
    log.info(`${reason} — falling back to own gRPC callback stream`);
    // Register our own callbacks now (we avoided this while relay was active)
    log.debug('[fallback] registering own callbacks with callbackId=' + this.callbackId);
    this.callMethod('ApiRenderEngine', 'setOnNewImageCallback', {
      callback: { callbackSource: 'grpc', callbackId: this.callbackId },
      userData: 0,
    })
      .then(() => log.debug('[fallback] setOnNewImageCallback OK'))
      .catch((e: any) => log.error('[fallback] setOnNewImageCallback failed:', e.message));
    this.callMethod('ApiRenderEngine', 'setOnNewStatisticsCallback', {
      callback: { callbackSource: 'grpc', callbackId: this.callbackId },
      userData: 0,
    })
      .then(() => log.debug('[fallback] setOnNewStatisticsCallback OK'))
      .catch((e: any) => log.error('[fallback] setOnNewStatisticsCallback failed:', e.message));
    log.debug('[fallback] starting sharedStream');
    this.sharedStream.start();
  }

  private isGrabbingFrame = false;

  /**
   * Enable dxSS shared surface mode after callbacks are registered.
   * Called once from registerOctaneCallbacks if the native addon is loaded.
   *
   * Prerequisites per Octane SDK (apirender.h):
   *  1. Device must support D3D11 shared surfaces
   *  2. Exactly one async tonemap render pass must be enabled
   *  3. Then call setSharedSurfaceOutputType(D3D11, realTime)
   */
  async enableSharedSurface(): Promise<void> {
    if (!this.dxAddon || this.ssEnabled) return;
    try {
      // Register our PID so the server can DuplicateHandle into us
      await this.callMethod('SharedSurfaceFrameService', 'registerViewportClient', {
        pid: process.pid,
      });
      log.info(`[dxSS] Registered viewport client PID ${process.pid}`);

      // Step 1: Check device support (non-fatal if RPC not implemented)
      try {
        const ssInfo = await this.callMethod('ApiRenderEngine', 'deviceSharedSurfaceInfo', {
          deviceIndex: 0,
        });
        if (ssInfo?.result?.d3D11?.supported === false) {
          log.warn('[dxSS] Device 0 does not support D3D11 shared surfaces — skipping');
          return;
        }
        if (ssInfo?.result?.d3D11?.adapterLuid) {
          log.info(
            `[dxSS] Device 0 supports D3D11, adapter LUID: ${ssInfo.result.d3D11.adapterLuid}`
          );
        }
      } catch {
        log.info('[dxSS] deviceSharedSurfaceInfo not available — assuming D3D11 supported');
      }

      // Step 2: Set async tonemap render passes (beauty pass only)
      try {
        const passResult = await this.callMethod('ApiRenderEngine', 'setAsyncTonemapRenderPasses', {
          tonemapPasses: { data: ['RENDER_PASS_BEAUTY'] },
        });
        log.info(`[dxSS] Async tonemap passes set: ${passResult?.result ? 'ok' : 'failed'}`);
      } catch (e: any) {
        log.warn(`[dxSS] setAsyncTonemapRenderPasses failed: ${e.message} — trying without`);
      }

      // Step 3: Enable shared surface output
      await this.callMethod('ApiRenderEngine', 'setSharedSurfaceOutputType', {
        type: 1, // SHARED_SURFACE_TYPE_D3D11
        realTime: false,
      });
      log.info('[dxSS] Enabled D3D11 shared surface output on server');

      this.ssEnabled = true;
      this.startSsCleanupTimer();
    } catch (e: any) {
      log.warn('[dxSS] Failed to enable shared surface mode:', e.message);
      // Non-fatal — falls back to pixel path
    }
  }

  /**
   * Disable dxSS shared surface mode.
   * Called by non-Electron paths to ensure SS is off (in case a previous
   * Electron session left it enabled).
   */
  async disableSharedSurface(): Promise<void> {
    try {
      await this.callMethod('ApiRenderEngine', 'setSharedSurfaceOutputType', {
        type: 0, // SHARED_SURFACE_TYPE_NONE
        realTime: false,
      });
    } catch {
      // Non-fatal
    }
  }

  /** Fetch pixel data on demand after a newImage notification. Gated to prevent flooding. */
  private grabAndNotifyImage(): void {
    if (this.isGrabbingFrame) {
      log.debug('[grab] skipped — already grabbing');
      return;
    }
    this.isGrabbingFrame = true;
    log.debug(`[grab] starting — ssEnabled=${this.ssEnabled} dxAddon=${!!this.dxAddon}`);

    // dxSS fast path: grab shared frame handle, read texture via native addon
    if (this.ssEnabled && this.dxAddon) {
      this.grabSharedFrame()
        .catch(() => {
          // SS grab failed — try pixel fallback for this frame
          return this.grabPixelFrame();
        })
        .finally(() => {
          this.isGrabbingFrame = false;
        });
      return;
    }

    // Standard pixel path
    this.grabPixelFrame().finally(() => {
      this.isGrabbingFrame = false;
    });
  }

  /**
   * dxSS fast path: grab shared surface handle, open texture, DMA to staging, map to CPU.
   * Eliminates protobuf ser/deser of 8.3MB pixel data.
   */
  private async grabSharedFrame(): Promise<void> {
    const t0 = Date.now();
    log.debug('[dxSS] grabSharedFrame RPC calling...');
    const result = await this.callMethod('SharedSurfaceFrameService', 'grabSharedFrame', {});
    log.debug(
      `[dxSS] grabSharedFrame RPC returned: result=${result?.result} hasFrame=${!!result?.frame} handle=${result?.frame?.handle}`
    );

    if (!result?.result || !result.frame?.handle) {
      log.debug('[dxSS] no SS handle — falling back to pixel grab');
      return this.grabPixelFrame();
    }

    const f = result.frame;
    const handleVal = Number(f.handle);
    const frameId = String(f.frameId);
    const w = Number(f.width);
    const h = Number(f.height);
    log.debug(
      `[dxSS] frame: handle=${handleVal} frameId=${frameId} ${w}x${h} luid=${f.adapterLuid}`
    );

    // Skip 0x0 frames (empty scene / no RT) — mapSurface would hang
    if (w === 0 || h === 0) {
      log.debug('[dxSS] skipping 0x0 frame — releasing handle');
      this.callMethod('SharedSurfaceFrameService', 'releaseSharedFrame', { frameId }).catch(
        () => {}
      );
      try {
        this.dxAddon.closeSurface(handleVal);
      } catch {
        /* */
      }
      return;
    }

    // Track in-flight handle for stale cleanup
    this.ssInflight.set(handleVal, { frameId, timestamp: t0 });

    try {
      // Initialize D3D11 device on first frame (matched to Octane's adapter)
      if (!this.dxDeviceInitialized) {
        this.dxAddon.initDevice(Number(f.adapterLuid));
        this.dxDeviceInitialized = true;
        log.info(`[dxSS] D3D11 device initialized on adapter LUID ${f.adapterLuid}`);
      }

      // Open shared texture → GPU DMA to staging → Map to CPU buffer
      const t1 = Date.now();
      log.debug(`[dxSS] mapSurface(${handleVal})...`);
      const pixels = this.dxAddon.mapSurface(handleVal);
      const t2 = Date.now();

      // Send through existing WS binary frame format (transparent to browser)
      this.notifyCallbacks({
        callback_source: 'dxss',
        callback_id: this.callbackId,
        user_data: 0,
        render_images: {
          data: [
            {
              buffer: { data: pixels, size: pixels.byteLength || pixels.length },
              size: { x: Number(f.width), y: Number(f.height) },
              type: Number(f.imageType),
              pitch: Number(f.pitch),
              tonemappedSamplesPerPixel: Number(f.samplesPerPixel) || 0,
              renderTime: Number(f.renderTime) || 0,
            },
          ],
        },
      });

      // Release both sides and remove from tracking
      this.releaseSsHandle(handleVal, frameId);

      const t3 = Date.now();
      // Periodic timing log (every ~60 frames)
      if (Number(f.frameId) % 60 === 1) {
        log.info(
          `[dxSS] frame ${f.width}x${f.height}: rpc=${t1 - t0}ms map=${t2 - t1}ms send=${t3 - t2}ms total=${t3 - t0}ms`
        );
      }
    } catch (err: any) {
      log.error('[dxSS] mapSurface failed:', err.message);
      // Release both sides and remove from tracking
      this.releaseSsHandle(handleVal, frameId);
      throw err; // propagate so caller falls back to pixel path
    }
  }

  /** Close a client-side NT handle and release the server-side clone. */
  private releaseSsHandle(handleVal: number, frameId: string): void {
    this.ssInflight.delete(handleVal);
    try {
      this.dxAddon.closeSurface(handleVal);
    } catch {
      /* ignore — handle may already be closed */
    }
    this.callMethod('SharedSurfaceFrameService', 'releaseSharedFrame', {
      frameId,
    }).catch(() => {
      /* non-fatal */
    });
  }

  /** Start periodic sweep for stale in-flight shared surface handles. */
  private startSsCleanupTimer(): void {
    if (this.ssCleanupTimer) return;
    this.ssCleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [handleVal, entry] of this.ssInflight) {
        if (now - entry.timestamp > GrpcClient.SS_STALE_TIMEOUT) {
          log.warn(
            `[dxSS] Stale handle ${handleVal} (frame ${entry.frameId}, ${now - entry.timestamp}ms old) — force releasing`
          );
          this.releaseSsHandle(handleVal, entry.frameId);
        }
      }
    }, GrpcClient.SS_CLEANUP_INTERVAL);
  }

  /** Stop the cleanup timer and release all in-flight handles. */
  private stopSsCleanup(): void {
    if (this.ssCleanupTimer) {
      clearInterval(this.ssCleanupTimer);
      this.ssCleanupTimer = null;
    }
    // Drain any in-flight handles
    for (const [handleVal, entry] of this.ssInflight) {
      log.info(`[dxSS] Shutdown: releasing in-flight handle ${handleVal} (frame ${entry.frameId})`);
      this.releaseSsHandle(handleVal, entry.frameId);
    }
  }

  /** Tear down D3D11 device and staging texture via native addon. */
  private destroySsDevice(): void {
    if (this.dxDeviceInitialized && this.dxAddon?.destroyDevice) {
      try {
        this.dxAddon.destroyDevice();
        log.info('[dxSS] D3D11 device destroyed');
      } catch (e: any) {
        log.warn('[dxSS] destroyDevice failed:', e.message);
      }
    }
    this.dxDeviceInitialized = false;
    this.ssEnabled = false;
  }

  /** Standard pixel path: grab pixels via protobuf. */
  private async grabPixelFrame(): Promise<void> {
    log.debug('[pixel] grabRenderResult calling...');
    const result = await this.callMethod('ApiRenderEngine', 'grabRenderResult', {});
    log.debug(
      `[pixel] grabRenderResult returned: result=${result?.result} images=${result?.renderImages?.data?.length ?? 0}`
    );
    if (result?.result && result.renderImages?.data?.length > 0) {
      const img = result.renderImages.data[0];
      if (!img?.buffer?.data || img.buffer.data.length === 0) {
        log.warn('[grabPixelFrame] Image has no pixel data — shared surface mode may be active');
        return;
      }
      this.notifyCallbacks({
        callback_source: 'grpc',
        callback_id: this.callbackId,
        user_data: 0,
        render_images: result.renderImages,
      });
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
    this.stopSsCleanup();
    this.destroySsDevice();
    this.disconnectMcpRelay();
    this.sharedStream.stop();
    this.isCallbackRegistered = false;
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
  /** DX shared surface native addon (loaded by Electron main process) */
  dxAddon?: any;
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
  const fileRoots = (
    options.fileRoots || [
      process.env.OCTANE_FILE_ROOTS || process.env.HOME || process.env.USERPROFILE || '.',
    ]
  )
    .flatMap(r => r.split(','))
    .map(r => path.resolve(r.trim()))
    .filter(Boolean);
  const unrestricted = fileRoots.length === 1 && fileRoots[0] === path.resolve('*');

  // Initialize gRPC client
  initGrpcLog();
  const grpcClient = new GrpcClient(protoBasePath, options.dxAddon);
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
      if (ws.readyState !== WebSocket.OPEN || ws.bufferedAmount > MAX_WS_BUFFER) return;
      try {
        // Binary frame fast path: send raw pixel bytes to eliminate base64/JSON overhead.
        // Wire format: [4B headerLen LE] [JSON header] [raw pixel bytes]
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
            source: data.callback_source || 'grpc',
          });
          const headerBuf = Buffer.from(header, 'utf8');
          const lenBuf = Buffer.alloc(4);
          lenBuf.writeUInt32LE(headerBuf.length, 0);
          const pixelBuf = Buffer.isBuffer(pixelData) ? pixelData : Buffer.from(pixelData);
          ws.send(Buffer.concat([lenBuf, headerBuf, pixelBuf]));
        } else {
          ws.send(JSON.stringify({ type: 'newImage', data }));
        }
      } catch (error) {
        log.error('Error sending WebSocket newImage:', error);
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
    const pathname = decodeURIComponent(urlObj.pathname);

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
        const params = body ? JSON.parse(body) : {};
        // All param transforms happen inside callMethod() via transformRequestParams.
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
