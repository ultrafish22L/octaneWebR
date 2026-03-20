/**
 * Shared gRPC Client Base
 *
 * Core gRPC functionality used by both the Vite dev plugin and Express production server.
 * Contains proto loading, service resolution, method invocation, and optional file logging.
 * Set GRPC_DEBUG_LOG=1 to log all calls to log_grpc.log.
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import * as fs from 'fs';

// ── gRPC debug file logging ────────────────────────────────────────
// On by default. Set GRPC_DEBUG_LOG=0 to disable. Logs mutating calls to log_grpc.log.
const GRPC_LOG_ENABLED = process.env.GRPC_DEBUG_LOG !== '0';
let grpcLogStream: fs.WriteStream | null = null;

// Only log mutating calls — skip reads to keep logs usable
const GRPC_LOG_METHODS = new Set([
  'create',
  'destroy',
  'setByAttrID',
  'setValueByAttrID',
  'setByIx',
  'setValueByIx',
  'setByName',
  'setValueByName',
  'setPinValue',
  'setPinValueByPinID',
  'connectTo',
  'connectTo1',
  'connectToIx',
  'disconnectPin',
  'update',
  'setPosition',
]);

function grpcLog(prefix: string, service: string, method: string, data?: any): void {
  if (!GRPC_LOG_ENABLED) return;
  if (!GRPC_LOG_METHODS.has(method)) return;
  if (!grpcLogStream) {
    const logPath = path.resolve(process.cwd(), 'log_grpc.log');
    grpcLogStream = fs.createWriteStream(logPath, { flags: 'a' });
    grpcLogStream.write(`=== gRPC Debug Log started ${new Date().toISOString()} ===\n`);
  }
  const ts = new Date().toISOString().slice(11, 23);
  const json = data !== undefined ? ' ' + JSON.stringify(data).substring(0, 800) : '';
  grpcLogStream.write(`[${ts}]  ${prefix} ${service}.${method}${json}\n`);
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getProtoDir, USE_ALPHA5_API } = require('../../../api-version.config.js') as {
  getProtoDir: () => string;
  USE_ALPHA5_API: boolean;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SERVICE_TO_PROTO_MAP, PROTO_LOADER_OPTIONS, SERVICE_NAMESPACE_PATTERNS } =
  require('../../../grpc-constants.js') as {
    SERVICE_TO_PROTO_MAP: Record<string, string>;
    PROTO_LOADER_OPTIONS: Record<string, unknown>;
    SERVICE_NAMESPACE_PATTERNS: string[];
  };

// ========== API Version Compatibility Layer ==========
// Single source of truth for method name + param transforms.
// Both web UI (via vite plugin) and MCP (via OctaneMcpClient) flow through
// callMethod() below, so everyone gets the same compat handling automatically.

/** Beta 2 → Alpha 5 method name mappings */
const METHOD_NAME_MAP: Record<string, string> = {
  // ApiNode pin value methods: Beta 2 → Alpha 5
  // Alpha 5 proto_old has getPinValue/setPinValue (different request type: objectPtr + id)
  // Beta 2 has getPinValueByPinID/setPinValueByPinID (item_ref + pin_id + expected_type)
  // Param transforms in transformRequestParams() handle the field renames.
  getPinValueByPinID: 'getPinValue',
  setPinValueByPinID: 'setPinValue',
  // ApiItem methods
  setValueByAttrID: 'setByAttrID',
  getValueByAttrID: 'getByAttrID',
  setValueByIx: 'setByIx',
  getValueByIx: 'getByIx',
  setValueByName: 'setByName',
  getValueByName: 'getByName',
};

/**
 * Translate a Beta 2 method name to the current API version's equivalent.
 * Callers should always use Beta 2 names; this handles the rest.
 */
export function getCompatibleMethodName(methodName: string): string {
  if (!USE_ALPHA5_API) return methodName;
  return METHOD_NAME_MAP[methodName] ?? methodName;
}

/**
 * Transform request parameters for API version compatibility.
 * Called with the ORIGINAL (Beta 2) method name, before method name translation.
 */
export function transformRequestParams(
  methodName: string,
  params: Record<string, unknown>
): Record<string, unknown> {
  if (!USE_ALPHA5_API) return params;

  // getPinValueByPinID/setPinValueByPinID → getPinValue/setPinValue
  // Beta 2 uses: item_ref, pin_id, expected_type, typed values (bool_value, int_value, etc.)
  // Alpha 5 uses: objectPtr, id, no expected_type, generic value
  if (methodName === 'getPinValueByPinID' || methodName === 'setPinValueByPinID') {
    const transformed: Record<string, unknown> = { ...params };

    // item_ref → objectPtr (Alpha 5 field name)
    if ('item_ref' in transformed) {
      transformed.objectPtr = transformed.item_ref;
      delete transformed.item_ref;
    }

    // pin_id → id
    if ('pin_id' in transformed) {
      transformed.id = transformed.pin_id;
      delete transformed.pin_id;
    }

    // Drop expected_type (Alpha 5 doesn't have it)
    if ('expected_type' in transformed) {
      delete transformed.expected_type;
    }

    // Typed value fields → generic 'value' (for set calls)
    const valueFields = [
      'bool_value',
      'int_value',
      'int2_value',
      'int3_value',
      'int4_value',
      'long_value',
      'long2_value',
      'float_value',
      'float2_value',
      'float3_value',
      'float4_value',
      'string_value',
    ];
    for (const field of valueFields) {
      if (field in transformed) {
        transformed.value = transformed[field];
        delete transformed[field];
        break;
      }
    }

    return transformed;
  }

  // setValueByAttrID / getValueByAttrID: no param transforms needed
  // Both Alpha 5 and Beta 2 use identical parameter structures.
  return params;
}

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

    const service = new ServiceConstructor(this.address, grpc.credentials.createInsecure(), {
      'grpc.max_receive_message_length': 64 * 1024 * 1024,
      'grpc.max_send_message_length': 64 * 1024 * 1024,
    });

    this.services.set(serviceName, service);
    return service;
  }

  /**
   * Invoke a gRPC method. Returns the deserialized response.
   *
   * Callers should always use Beta 2 method names (e.g. 'setValueByAttrID').
   * This method handles API version translation automatically:
   * 1. transformRequestParams() — adjusts param structure if needed
   * 2. getCompatibleMethodName() — translates to current API version's method name
   * 3. getService()[method]() — makes the actual gRPC call
   */
  async callMethod(
    serviceName: string,
    methodName: string,
    params: any = {},
    options: GrpcCallOptions = {}
  ): Promise<any> {
    // API version compat: transform params first (uses original method name),
    // then translate the method name for the wire call
    const compatParams = transformRequestParams(methodName, params);
    const compatMethod = getCompatibleMethodName(methodName);

    const service = this.getService(serviceName);
    const method = service[compatMethod];

    if (!method || typeof method !== 'function') {
      throw new Error(
        `Method ${compatMethod} not found in service ${serviceName} (from ${methodName})`
      );
    }

    const request = Object.keys(compatParams).length === 0 ? {} : compatParams;
    const metadata = options.metadata || new grpc.Metadata();
    const deadline = Date.now() + (options.timeout || 30000);

    grpcLog('REQ', serviceName, compatMethod, request);

    return new Promise((resolve, reject) => {
      method.call(
        service,
        request,
        metadata,
        { deadline },
        (error: grpc.ServiceError | null, response: any) => {
          if (error) {
            grpcLog('ERR', serviceName, compatMethod, { code: error.code, message: error.message });
            reject(error);
          } else {
            grpcLog('RES', serviceName, compatMethod, response);
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
 *
 * Data-driven: add new entries to OBJECT_PTR_REMAPPINGS instead of writing new if/else branches.
 */

interface ObjectPtrRemapping {
  service?: string; // If specified, must match the gRPC service name
  methods: string[];
  field: string; // The proto field name to remap objectPtr to
  exclusive?: boolean; // If true, the objectPtr is the only param (no ...rest spread)
}

const OBJECT_PTR_REMAPPINGS: ObjectPtrRemapping[] = [
  // ApiNodePinInfoEx.getApiNodePinInfo: objectPtr → nodePinInfoRef (objectPtr is the sole param)
  {
    service: 'ApiNodePinInfoEx',
    methods: ['getApiNodePinInfo'],
    field: 'nodePinInfoRef',
    exclusive: true,
  },
  // ApiItem value methods: objectPtr → item_ref
  // Use Beta 2 names — callMethod() translates before reaching here
  {
    methods: ['getValueByAttrID', 'setValueByAttrID', 'getValue'],
    field: 'item_ref',
  },
  // ApiNode pin value methods: objectPtr → item_ref (apinodesystem_7.proto)
  {
    methods: [
      'getPinValueByIx',
      'getPinValueByPinID',
      'getPinValueByName',
      'setPinValueByIx',
      'setPinValueByPinID',
      'setPinValueByName',
    ],
    field: 'item_ref',
  },
];

export function transformObjectPtrParams(
  service: string,
  method: string,
  params: Record<string, any>
): Record<string, any> {
  if (!params.objectPtr) return params;

  for (const mapping of OBJECT_PTR_REMAPPINGS) {
    if (mapping.service && mapping.service !== service) continue;
    if (!mapping.methods.includes(method)) continue;

    if (mapping.exclusive) {
      return { [mapping.field]: params.objectPtr };
    }
    const { objectPtr, ...rest } = params;
    return { [mapping.field]: objectPtr, ...rest };
  }

  return params;
}
