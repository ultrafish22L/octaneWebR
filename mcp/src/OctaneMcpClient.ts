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

const MCP_LOG_PATH = path.resolve(__dirname, '../../mcp-debug.log');

function mcpLog(msg: string): void {
  const ts = new Date().toISOString().substring(11, 23);
  fs.appendFileSync(MCP_LOG_PATH, `[${ts}] ${msg}\n`);
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
    mcpLog(`CRASH DETECTED on ${service}.${method}: ${msg}`);
    // Clear cached handles — they're all invalid after a crash
    if (client) {
      client.clearRootGraphCache();
      mcpLog('Cleared root graph cache and handle maps after crash');
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
const GRPC_CLIENT_PATH = path.join(SERVER_ROOT, 'src/grpc/OctaneGrpcClientBase');

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires */
const grpcModule = require(GRPC_CLIENT_PATH);
const GrpcClientBase = grpcModule.OctaneGrpcClientBase;
const transformParams: (s: string, m: string, p: Record<string, any>) => Record<string, any> =
  grpcModule.transformObjectPtrParams;
/* eslint-enable */

export class OctaneMcpClient {
  private base: any; // OctaneGrpcClientBase (loaded at runtime)
  private mutex: Promise<void> = Promise.resolve(); // Serializes all gRPC calls
  private rootGraphHandle: number | null = null; // Cached root node graph handle

  // Session info cache — static per Octane session
  private sessionInfo: {
    version?: any;
    name?: any;
    deviceCount?: any;
    deviceNames: Map<number, any>;
  } = { deviceNames: new Map() };

  // Handle-to-type tracking — shared across all tools
  readonly handleToTypeName = new Map<number, string>();

  // Primitive enum handles — tracks pin 0 enum children of NT_GEO_OBJECT nodes.
  // Populated by create_node(NT_GEO_OBJECT). Used for diagnostics only.
  readonly primitiveEnumHandles = new Set<number>();

  // Deferred evaluation tracking — warns when evaluate:false calls pile up.
  // Batching deferred changes + update_scene() crashed a 10-object emissive scene.
  private deferredEvalCount = 0;
  private static readonly DEFERRED_WARN_THRESHOLD = 3;

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
      const transformed = transformParams(service, method, params);
      const options = timeoutMs ? { timeout: timeoutMs } : {};
      mcpLog(`REQ ${service}.${method} ${JSON.stringify(transformed).substring(0, 500)}`);
      const result = await this.base.callMethod(service, method, transformed, options);
      mcpLog(`RES ${service}.${method} ${JSON.stringify(result).substring(0, 500)}`);
      return result;
    } catch (error: any) {
      throw enhanceCrashError(error, service, method, this);
    } finally {
      resolve!();
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

  /** Clear all session caches (call on load_project / reset_project) */
  clearRootGraphCache(): void {
    this.rootGraphHandle = null;
    this.handleToTypeName.clear();
    this.primitiveEnumHandles.clear();
    this.sessionInfo = { deviceNames: new Map() };
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

  /**
   * Track a deferred evaluation (evaluate:false). Returns a warning string
   * if the count exceeds the threshold, or null if safe.
   */
  trackDeferredEval(): string | null {
    this.deferredEvalCount++;
    if (this.deferredEvalCount >= OctaneMcpClient.DEFERRED_WARN_THRESHOLD) {
      const count = this.deferredEvalCount;
      mcpLog(`WARN: ${count} deferred evaluations pending — risk of crash on flush`);
      return (
        `WARNING: ${count} deferred evaluations (evaluate:false) are pending. ` +
        `Batching many deferred changes and flushing with update_scene() has caused ` +
        `crashes in complex scenes. Consider using evaluate:true (default) for ` +
        `incremental evaluation instead.`
      );
    }
    return null;
  }

  /** Reset deferred eval counter (call after evaluation happens) */
  resetDeferredEvalCount(): void {
    this.deferredEvalCount = 0;
  }

  /** Get current deferred eval count */
  getDeferredEvalCount(): number {
    return this.deferredEvalCount;
  }

  async checkHealth(): Promise<boolean> {
    return this.base.checkHealth();
  }

  close(): void {
    this.base.close();
  }
}
