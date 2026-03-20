/**
 * Octane MCP Client
 *
 * Thin wrapper around OctaneGrpcClientBase for MCP server use.
 * Connects directly to Octane at 127.0.0.1:51022 via gRPC.
 *
 * Uses require() for server imports to avoid pulling the entire server/gRPC
 * type system into TypeScript compilation (which causes OOM).
 */

import path from 'path';
import fs from 'fs';
import { SceneCache } from './SceneCache';
import type {
  IGrpcClientBase,
  GrpcModule,
  TransformObjectPtrParams,
} from './types/GrpcClientTypes';

export const MCP_LOG_PATH = path.resolve(__dirname, '../../log_mcp.log');

// Log levels: 'debug' = full REQ/RES, 'info' = tool calls + results, 'warn' = problems only, 'error' = errors, 'off' = silent
type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'off';
// Default 'info': logs every gRPC call name + success/fail + timing.
// Set MCP_LOG_LEVEL=debug for full request/response JSON.
const LOG_LEVEL: LogLevel = (process.env.MCP_LOG_LEVEL as LogLevel) || 'info';

const LEVEL_RANK: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3, off: 4 };

// Use a WriteStream (like log_grpc.log) so writes are ordered.
// fs.appendFile is fire-and-forget and can interleave out of order.
let mcpLogStream: fs.WriteStream | null = null;

export function mcpLog(msg: string, level: LogLevel = 'debug'): void {
  if (LEVEL_RANK[level] < LEVEL_RANK[LOG_LEVEL]) return;
  if (!mcpLogStream) {
    mcpLogStream = fs.createWriteStream(MCP_LOG_PATH, { flags: 'a' });
  }
  const ts = new Date().toISOString().substring(11, 23);
  mcpLogStream.write(`[${ts}] ${msg}\n`);
}

/** Reset the log stream after clear_log truncates the file. */
export function mcpLogReset(): void {
  if (mcpLogStream) {
    mcpLogStream.end();
    mcpLogStream = null;
  }
}

// ── Quick & dirty profiler ──────────────────────────────────────────
export interface ProfileEntry {
  label: string;
  startMs: number;
  endMs?: number;
  durationMs?: number;
}

/** All profile spans, in chronological order. Auto-trimmed at MAX_PROFILE_SPANS. */
const profileSpans: ProfileEntry[] = [];
const MAX_PROFILE_SPANS = 10_000;

/** Drop oldest half of spans when the buffer is full */
function trimSpansIfNeeded(): void {
  if (profileSpans.length >= MAX_PROFILE_SPANS) {
    profileSpans.splice(0, profileSpans.length >> 1);
  }
}
/** Open spans keyed by label (for start/end pairs) */
const openSpans = new Map<string, ProfileEntry>();
/** Session wall-clock start (set on first profileStart or first gRPC call) */
let sessionStartMs = 0;

export function profileStart(label: string): void {
  const now = performance.now();
  if (!sessionStartMs) sessionStartMs = now;
  const entry: ProfileEntry = { label, startMs: now };
  trimSpansIfNeeded();
  profileSpans.push(entry);
  openSpans.set(label, entry);
  mcpLog(`PROFILE START: ${label}`);
}

export function profileEnd(label: string): number {
  const now = performance.now();
  const entry = openSpans.get(label);
  if (entry) {
    entry.endMs = now;
    entry.durationMs = now - entry.startMs;
    openSpans.delete(label);
    mcpLog(`PROFILE END: ${label} — ${entry.durationMs.toFixed(1)}ms`);
    return entry.durationMs;
  }
  mcpLog(`PROFILE END: ${label} — no matching start`);
  return 0;
}

/** Auto-profile a gRPC call (called from callMethod) */
function profileGrpc(service: string, method: string): () => void {
  const now = performance.now();
  if (!sessionStartMs) sessionStartMs = now;
  const label = `gRPC:${service}.${method}`;
  const entry: ProfileEntry = { label, startMs: now };
  trimSpansIfNeeded();
  profileSpans.push(entry);
  return () => {
    entry.endMs = performance.now();
    entry.durationMs = entry.endMs - entry.startMs;
  };
}

export function profileReport(): {
  wallClockMs: number;
  totalGrpcMs: number;
  grpcCallCount: number;
  totalOverheadMs: number;
  spans: { label: string; durationMs: number }[];
  grpcByMethod: { method: string; count: number; totalMs: number; avgMs: number }[];
} {
  const now = performance.now();
  const wallClockMs = sessionStartMs ? now - sessionStartMs : 0;

  // Separate gRPC spans from manual spans
  const grpcSpans = profileSpans.filter(s => s.label.startsWith('gRPC:') && s.durationMs != null);
  const manualSpans = profileSpans.filter(
    s => !s.label.startsWith('gRPC:') && s.durationMs != null
  );

  const totalGrpcMs = grpcSpans.reduce((sum, s) => sum + (s.durationMs || 0), 0);

  // Aggregate gRPC by method
  const byMethod = new Map<string, { count: number; totalMs: number }>();
  for (const s of grpcSpans) {
    const key = s.label.replace('gRPC:', '');
    let agg = byMethod.get(key);
    if (!agg) {
      agg = { count: 0, totalMs: 0 };
      byMethod.set(key, agg);
    }
    agg.count++;
    agg.totalMs += s.durationMs || 0;
  }
  const grpcByMethod = [...byMethod.entries()]
    .map(([method, { count, totalMs }]) => ({
      method,
      count,
      totalMs: Math.round(totalMs),
      avgMs: Math.round(totalMs / count),
    }))
    .sort((a, b) => b.totalMs - a.totalMs);

  return {
    wallClockMs: Math.round(wallClockMs),
    totalGrpcMs: Math.round(totalGrpcMs),
    grpcCallCount: grpcSpans.length,
    totalOverheadMs: Math.round(wallClockMs - totalGrpcMs),
    spans: manualSpans.map(s => ({
      label: s.label,
      durationMs: Math.round(s.durationMs || 0),
    })),
    grpcByMethod,
  };
}

export function profileReset(): void {
  profileSpans.length = 0;
  openSpans.clear();
  sessionStartMs = 0;
  mcpLog('PROFILE RESET');
}

/** Crash signature patterns in gRPC error messages */
const CRASH_PATTERNS = [
  'ECONNRESET',
  'ECONNREFUSED',
  'Stream removed',
  'Connection dropped',
  'socket hang up',
];

/**
 * Detect Octane crash from gRPC error and throw a structured error message
 * that tells the AI agent exactly what happened and what to do.
 *
 * Takes an optional client reference to clear cached handles on crash detection,
 * preventing stale-handle errors after Octane restarts.
 */
function enhanceCrashError(
  error: any,
  service: string,
  method: string,
  client?: OctaneMcpClient
): Error {
  const msg = String(error?.message || error);
  const isCrash = CRASH_PATTERNS.some(p => msg.includes(p));

  if (isCrash) {
    mcpLog(`CRASH DETECTED on ${service}.${method}: ${msg}`, 'error');
    // Clear cached handles — they're all invalid after a crash
    if (client) {
      client.clearRootGraphCache();
      client.resetGrpcChannels();
      mcpLog('Cleared root graph cache, handle maps, and gRPC channels after crash', 'warn');
    }
    return new Error(
      `OCTANE CRASHED (${service}.${method}): ${msg}\n` +
        `\n` +
        `Octane has terminated or lost connection. ALL node handles are now INVALID.\n` +
        `\n` +
        `Recovery steps:\n` +
        `1. Ask the user to restart Octane\n` +
        `2. Wait for Octane to finish launching\n` +
        `3. Rebuild the scene from scratch (all handles are invalidated)\n` +
        `\n` +
        `Do NOT retry the same call — the connection is dead.`
    );
  }

  return error;
}

// Resolve paths relative to mcp/dist/ at runtime
const SERVER_ROOT = path.resolve(__dirname, '../../server');
const GRPC_CLIENT_PATH = path.join(SERVER_ROOT, 'dist/grpc/OctaneGrpcClientBase');

// Dynamic require to avoid pulling entire server/gRPC type system into esbuild (causes OOM).
// Typed via mcp/src/types/GrpcClientTypes.ts — update that file if the server API changes.
/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
const grpcModule = require(GRPC_CLIENT_PATH) as GrpcModule;
const GrpcClientBase = grpcModule.OctaneGrpcClientBase;
const transformParams: TransformObjectPtrParams = grpcModule.transformObjectPtrParams;
/* eslint-enable */

export class OctaneMcpClient {
  private base: IGrpcClientBase;
  private mutex: Promise<void> = Promise.resolve(); // Serializes all gRPC calls
  private rootGraphHandle: number | null = null; // Cached root node graph handle
  private lastSuccessMs = 0; // Timestamp of last successful gRPC call
  private static readonly HEALTH_CHECK_INTERVAL_MS = 30_000; // Re-validate connection after 30s idle

  // Session info cache — static per Octane session
  private sessionInfo: {
    version?: any;
    name?: any;
    deviceCount?: any;
    deviceNames: Map<number, any>;
  } = { deviceNames: new Map() };

  // Scene graph cache — replaces the old handleToTypeName Map.
  // Tracks nodes, connections, and children for scene awareness.
  readonly sceneCache = new SceneCache();

  constructor() {
    this.base = new GrpcClientBase(undefined, undefined, SERVER_ROOT);
  }

  async initialize(): Promise<void> {
    await this.base.initialize();
  }

  async callMethod(
    service: string,
    method: string,
    params: Record<string, any> = {},
    timeoutMs?: number
  ): Promise<any> {
    // Serialize: wait for previous call to finish before starting this one.
    // Octane's message thread processes calls sequentially anyway — sending
    // concurrent requests only risks race conditions and crashes.
    let resolve: () => void;
    const prev = this.mutex;
    this.mutex = new Promise<void>(r => {
      resolve = r;
    });

    try {
      await prev; // wait for previous call

      // Health check: if connection has been idle, verify Octane is still alive
      // before sending the real call. Detects manual Octane kills that don't
      // trigger ECONNRESET (because no call was in-flight at the time).
      await this.ensureConnection(service, method);

      const transformed = transformParams(service, method, params);
      const options = timeoutMs ? { timeout: timeoutMs } : {};
      const isDebug = LEVEL_RANK['debug'] >= LEVEL_RANK[LOG_LEVEL];
      if (isDebug)
        mcpLog(
          `REQ ${service}.${method} ${JSON.stringify(transformed).substring(0, 500)}`,
          'debug'
        );
      const startMs = Date.now();
      const endProfile = profileGrpc(service, method);
      const result = await this.base.callMethod(service, method, transformed, options);
      endProfile();
      const elapsed = Date.now() - startMs;
      this.lastSuccessMs = Date.now();
      const ok = result?.success !== false && !result?.error_message;
      mcpLog(`${service}.${method} ${ok ? 'OK' : 'FAIL'} ${elapsed}ms`, 'info');
      if (isDebug)
        mcpLog(`RES ${service}.${method} ${JSON.stringify(result).substring(0, 500)}`, 'debug');
      return result;
    } catch (error: any) {
      throw enhanceCrashError(error, service, method, this);
    } finally {
      resolve!();
    }
  }

  /**
   * Verify the gRPC connection is alive before a call. Runs a health check
   * if the connection has been idle longer than HEALTH_CHECK_INTERVAL_MS.
   * On failure, resets all channels and caches so the next call gets a fresh
   * connection to whichever Octane instance is currently running.
   */
  private async ensureConnection(service: string, method: string): Promise<void> {
    // Skip health check for the ping call itself (avoid recursion)
    if (service === 'ApiProjectManager' && method === 'getPing') return;
    // Skip if we had a recent successful call
    if (
      this.lastSuccessMs &&
      Date.now() - this.lastSuccessMs < OctaneMcpClient.HEALTH_CHECK_INTERVAL_MS
    )
      return;

    try {
      await this.base.callMethod('ApiProjectManager', 'getPing', {}, { timeout: 5000 });
      this.lastSuccessMs = Date.now();
    } catch {
      mcpLog(`Health check failed — Octane connection stale. Resetting channels.`, 'warn');
      this.clearRootGraphCache();
      this.resetGrpcChannels();
    }
  }

  /** Get root node graph handle, cached after first call */
  async getRootNodeGraph(): Promise<number> {
    if (this.rootGraphHandle) return this.rootGraphHandle;
    const result = await this.callMethod('ApiProjectManager', 'rootNodeGraph', {});
    const h = result?.result?.handle ?? result?.handle;
    const handle = h ? Number(h) : 0;
    if (!handle) throw new Error('No root node graph found');
    this.rootGraphHandle = handle;
    return handle;
  }

  /** Clear all session caches (call on load_project / reset_project / crash) */
  clearRootGraphCache(): void {
    this.rootGraphHandle = null;
    this.sceneCache.clear();
    this.clearDynamicCache();
    this.sessionInfo = { deviceNames: new Map() };
  }

  /**
   * Reset gRPC channels after a crash. Closes all cached service stubs so
   * they get recreated with fresh connections on the next call.
   * Without this, the poisoned channels degrade across crash/restart cycles.
   */
  resetGrpcChannels(): void {
    try {
      this.base.close();
      mcpLog('Reset gRPC channels — all service stubs closed and cleared', 'warn');
    } catch (e: any) {
      mcpLog(`Error resetting gRPC channels: ${e.message}`, 'error');
    }
  }

  /** Get cached Octane version + name (lazy-populated on first call) */
  async getSessionInfo(): Promise<{ version: any; name: any }> {
    if (this.sessionInfo.version !== undefined) {
      return { version: this.sessionInfo.version, name: this.sessionInfo.name };
    }
    const vResult = await this.callMethod('ApiInfo', 'octaneVersion', {});
    const nResult = await this.callMethod('ApiInfo', 'octaneName', {});
    this.sessionInfo.version = vResult?.value ?? vResult;
    this.sessionInfo.name = nResult?.value ?? nResult;
    return { version: this.sessionInfo.version, name: this.sessionInfo.name };
  }

  /** Get cached device count (lazy-populated on first call) */
  async getDeviceCount(): Promise<any> {
    if (this.sessionInfo.deviceCount !== undefined) return this.sessionInfo.deviceCount;
    const result = await this.callMethod('ApiRenderEngine', 'getDeviceCount', {});
    this.sessionInfo.deviceCount = result?.value ?? result;
    return this.sessionInfo.deviceCount;
  }

  /** Get cached device name by index (lazy-populated per device) */
  async getDeviceName(deviceIndex: number): Promise<any> {
    const cached = this.sessionInfo.deviceNames.get(deviceIndex);
    if (cached !== undefined) return cached;
    const result = await this.callMethod('ApiRenderEngine', 'getDeviceName', { deviceIndex });
    const name = result?.value ?? result;
    this.sessionInfo.deviceNames.set(deviceIndex, name);
    return name;
  }

  // ── Dynamic ApiInfo queries (Tier 2 cache) ─────────────────────────
  // These query Octane's metadata RPCs and cache the results in memory.
  // Used when the static ApiCache (Tier 1) doesn't have what we need.

  private dynamicNodeInfo = new Map<string, any>();
  private dynamicPinInfo = new Map<string, any>();
  private dynamicAttrInfo = new Map<string, any>();
  private dynamicCompatTypes = new Map<string, any>();

  /** Get full node type metadata via ApiInfo.nodeInfo (cached after first call) */
  async queryNodeInfo(nodeType: string): Promise<any> {
    const cached = this.dynamicNodeInfo.get(nodeType);
    if (cached) return cached;
    const result = await this.callMethod('ApiInfo', 'nodeInfo', { nodeType });
    const info = result?.result ?? result;
    this.dynamicNodeInfo.set(nodeType, info);
    return info;
  }

  /** Get pin metadata via ApiInfo.nodePinInfo (cached after first call) */
  async queryPinInfo(nodeType: string, pinIx: number): Promise<any> {
    const key = `${nodeType}:${pinIx}`;
    const cached = this.dynamicPinInfo.get(key);
    if (cached) return cached;
    const result = await this.callMethod('ApiInfo', 'nodePinInfo', { nodeType, pinIx });
    const info = result?.result ?? result;
    this.dynamicPinInfo.set(key, info);
    return info;
  }

  /** Get attribute metadata via ApiInfo.attributeInfo (cached after first call) */
  async queryAttributeInfo(nodeType: string, attributeId: number): Promise<any> {
    const key = `${nodeType}:${attributeId}`;
    const cached = this.dynamicAttrInfo.get(key);
    if (cached) return cached;
    const result = await this.callMethod('ApiInfo', 'attributeInfo', { nodeType, attributeId });
    const info = result?.result ?? result;
    this.dynamicAttrInfo.set(key, info);
    return info;
  }

  /** Get compatible node/graph types for a pin output type (cached after first call) */
  async queryCompatibleTypes(pinType: string): Promise<any> {
    const cached = this.dynamicCompatTypes.get(pinType);
    if (cached) return cached;
    const result = await this.callMethod('ApiInfo', 'getCompatibleTypes', { outputType: pinType });
    const info = result?.result ?? result;
    this.dynamicCompatTypes.set(pinType, info);
    return info;
  }

  /** Clear dynamic cache (called alongside static cache clear) */
  clearDynamicCache(): void {
    this.dynamicNodeInfo.clear();
    this.dynamicPinInfo.clear();
    this.dynamicAttrInfo.clear();
    this.dynamicCompatTypes.clear();
  }

  async checkHealth(): Promise<boolean> {
    return this.base.checkHealth();
  }

  close(): void {
    this.base.close();
  }
}
