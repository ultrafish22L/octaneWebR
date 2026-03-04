/**
 * Shared gRPC Client Base
 *
 * Core gRPC functionality used by both the Vite dev plugin and Express production server.
 * Contains proto loading, service resolution, and method invocation — no logging,
 * no callback handling, no HTTP routing. Consumers wrap via composition.
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import * as fs from 'fs';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getProtoDir } = require('../../../api-version.config.js') as {
  getProtoDir: () => string;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SERVICE_TO_PROTO_MAP, PROTO_LOADER_OPTIONS, SERVICE_NAMESPACE_PATTERNS } =
  require('../../../grpc-constants.js') as {
    SERVICE_TO_PROTO_MAP: Record<string, string>;
    PROTO_LOADER_OPTIONS: Record<string, unknown>;
    SERVICE_NAMESPACE_PATTERNS: string[];
  };

export interface GrpcCallOptions {
  timeout?: number;
  metadata?: grpc.Metadata;
}

export class OctaneGrpcClientBase {
  protected services: Map<string, any> = new Map();
  protected packageDefinition: protoLoader.PackageDefinition | null = null;
  protected protoDescriptor: grpc.GrpcObject | null = null;
  protected octaneHost: string;
  protected octanePort: number;
  private protoBasePath: string;

  /**
   * @param octaneHost   Octane gRPC host
   * @param octanePort   Octane gRPC port
   * @param protoBasePath  Absolute path to the directory CONTAINING the proto dir
   *                       (e.g. path to `server/`). The proto subdir (proto or proto_old)
   *                       is resolved automatically from api-version.config.js.
   */
  constructor(
    octaneHost: string = process.env.OCTANE_HOST || OctaneGrpcClientBase.detectDefaultHost(),
    octanePort: number = parseInt(process.env.OCTANE_PORT || '51022') || 51022,
    protoBasePath?: string
  ) {
    this.octaneHost = octaneHost;
    this.octanePort = octanePort;

    // Default proto base path: two levels up from this file → server/
    this.protoBasePath = protoBasePath ?? path.resolve(__dirname, '../..');
  }

  /**
   * Detect whether we're running in a Docker/sandbox environment.
   * Returns 'host.docker.internal' for sandboxes, 'localhost' otherwise.
   */
  static detectDefaultHost(): string {
    const indicators = [
      fs.existsSync('/.dockerenv'),
      process.env.USER?.toLowerCase().includes('sandbox'),
      process.env.KUBERNETES_SERVICE_HOST !== undefined,
      fs.existsSync('/workspace'),
    ];

    return indicators.some(Boolean) ? 'host.docker.internal' : '127.0.0.1';
  }

  get address(): string {
    return `${this.octaneHost}:${this.octanePort}`;
  }

  private get protoPath(): string {
    return path.resolve(this.protoBasePath, getProtoDir());
  }

  /**
   * Initialize proto loading.
   * @param coreProtoFiles  Optional list of proto filenames to batch-load up front.
   *                        If omitted or empty, all services are loaded lazily on first access.
   */
  async initialize(coreProtoFiles?: string[]): Promise<void> {
    const PROTO_PATH = this.protoPath;

    if (!fs.existsSync(PROTO_PATH)) {
      return;
    }

    if (!coreProtoFiles || coreProtoFiles.length === 0) {
      // Lazy mode — services will load their own proto files on demand
      return;
    }

    // Batch mode — load core protos up front for faster first-call resolution
    const existingFiles = coreProtoFiles
      .map(f => path.join(PROTO_PATH, f))
      .filter(f => fs.existsSync(f));

    if (existingFiles.length === 0) return;

    try {
      this.packageDefinition = protoLoader.loadSync(existingFiles, {
        ...PROTO_LOADER_OPTIONS,
        includeDirs: [PROTO_PATH],
      });
      this.protoDescriptor = grpc.loadPackageDefinition(this.packageDefinition);
    } catch (error: any) {
      console.error('Failed to load proto files:', error.message);
      this.protoDescriptor = null;
    }
  }

  /**
   * Load a single service's proto file on demand.
   */
  protected loadServiceProto(serviceName: string): any {
    const PROTO_PATH = this.protoPath;

    const protoFileName = SERVICE_TO_PROTO_MAP[serviceName] || serviceName.toLowerCase() + '.proto';
    const protoFilePath = path.join(PROTO_PATH, protoFileName);

    if (!fs.existsSync(protoFilePath)) {
      return null;
    }

    try {
      const packageDefinition = protoLoader.loadSync([protoFilePath], {
        ...PROTO_LOADER_OPTIONS,
        includeDirs: [PROTO_PATH],
      });
      return grpc.loadPackageDefinition(packageDefinition);
    } catch {
      return null;
    }
  }

  /**
   * Walk a dotted path (e.g. "octaneapi.ApiNodeService") through a proto descriptor.
   */
  protected resolveServicePath(descriptor: any, servicePath: string): any {
    const parts = servicePath.split('.');
    let current = descriptor;

    for (const part of parts) {
      if (current && current[part]) {
        current = current[part];
      } else {
        return null;
      }
    }

    return current;
  }

  /**
   * Get or create a gRPC service stub for the given service name.
   * Tries the batch-loaded descriptor first, then falls back to per-service proto loading.
   */
  getService(serviceName: string): any {
    if (this.services.has(serviceName)) {
      return this.services.get(serviceName);
    }

    let descriptor = this.protoDescriptor;

    if (!descriptor) {
      descriptor = this.loadServiceProto(serviceName);
      if (!descriptor) {
        throw new Error(`Could not load proto for service ${serviceName}`);
      }
    }

    let ServiceConstructor: any = null;
    const patterns = SERVICE_NAMESPACE_PATTERNS.map((p: string) =>
      p.replace('{name}', serviceName)
    );

    for (const pattern of patterns) {
      ServiceConstructor = this.resolveServicePath(descriptor, pattern);
      if (ServiceConstructor) break;
    }

    // If not found in main descriptor, try service-specific proto
    if (!ServiceConstructor && descriptor === this.protoDescriptor) {
      const serviceDescriptor = this.loadServiceProto(serviceName);
      if (serviceDescriptor) {
        for (const pattern of patterns) {
          ServiceConstructor = this.resolveServicePath(serviceDescriptor, pattern);
          if (ServiceConstructor) break;
        }
      }
    }

    if (!ServiceConstructor || typeof ServiceConstructor !== 'function') {
      throw new Error(`Service ${serviceName} not found in proto definitions`);
    }

    const service = new ServiceConstructor(this.address, grpc.credentials.createInsecure());

    this.services.set(serviceName, service);
    return service;
  }

  /**
   * Invoke a gRPC method. Returns the deserialized response.
   */
  async callMethod(
    serviceName: string,
    methodName: string,
    params: any = {},
    options: GrpcCallOptions = {}
  ): Promise<any> {
    const service = this.getService(serviceName);
    const method = service[methodName];

    if (!method || typeof method !== 'function') {
      throw new Error(`Method ${methodName} not found in service ${serviceName}`);
    }

    const request = Object.keys(params).length === 0 ? {} : params;
    const metadata = options.metadata || new grpc.Metadata();
    const deadline = Date.now() + (options.timeout || 30000);

    return new Promise((resolve, reject) => {
      method.call(
        service,
        request,
        metadata,
        { deadline },
        (error: grpc.ServiceError | null, response: any) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        }
      );
    });
  }

  /**
   * Lightweight health check — returns true if Octane responds to a ping.
   */
  async checkHealth(): Promise<boolean> {
    try {
      await this.callMethod('ApiProjectManager', 'getPing', {}, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Close all gRPC service stub channels and clear cache.
   */
  close(): void {
    for (const [, service] of this.services) {
      try {
        service.close?.();
      } catch {
        // Ignore errors during cleanup
      }
    }
    this.services.clear();
  }
}

// ========== Shared Utilities ==========

/**
 * Transform objectPtr parameters to the field names expected by the proto definitions.
 *
 * The client sends `objectPtr` as a unified handle wrapper, but different proto messages
 * expect different field names (item_ref, nodePinInfoRef). This function remaps them.
 */
export function transformObjectPtrParams(
  service: string,
  method: string,
  params: Record<string, any>
): Record<string, any> {
  if (!params.objectPtr) return params;

  // ApiNodePinInfoEx.getApiNodePinInfo: objectPtr → nodePinInfoRef
  if (service === 'ApiNodePinInfoEx' && method === 'getApiNodePinInfo') {
    return { nodePinInfoRef: params.objectPtr };
  }

  // ApiItem value methods: objectPtr → item_ref
  if (
    method === 'getValueByAttrID' ||
    method === 'setValueByAttrID' ||
    method === 'getValue' ||
    method === 'getByAttrID' ||
    method === 'setByAttrID'
  ) {
    const { objectPtr, ...rest } = params;
    return { item_ref: objectPtr, ...rest };
  }

  // ApiNode pin value methods: objectPtr → item_ref (apinodesystem_7.proto)
  if (
    method === 'getPinValueByIx' ||
    method === 'getPinValueByPinID' ||
    method === 'getPinValueByName' ||
    method === 'setPinValueByIx' ||
    method === 'setPinValueByPinID' ||
    method === 'setPinValueByName'
  ) {
    const { objectPtr, ...rest } = params;
    return { item_ref: objectPtr, ...rest };
  }

  return params;
}
