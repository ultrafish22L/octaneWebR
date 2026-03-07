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
    const transformed = transformParams(service, method, params);
    const options = timeoutMs ? { timeout: timeoutMs } : {};
    return this.base.callMethod(service, method, transformed, options);
  }

  async checkHealth(): Promise<boolean> {
    return this.base.checkHealth();
  }

  close(): void {
    this.base.close();
  }
}
