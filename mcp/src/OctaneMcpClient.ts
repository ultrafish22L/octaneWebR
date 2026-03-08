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
    } finally {
      resolve!();
    }
  }

  async checkHealth(): Promise<boolean> {
    return this.base.checkHealth();
  }

  close(): void {
    this.base.close();
  }
}
