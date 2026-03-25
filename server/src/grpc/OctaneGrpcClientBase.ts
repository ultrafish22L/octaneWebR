/**
 * Shared gRPC Client Base
 *
 * Core gRPC functionality used by both the Vite dev plugin and Express production server.
 * Contains proto loading, service resolution, method invocation, and file logging.
 * Logging controlled by LOG_LEVEL env var (default: debug). Set LOG_LEVEL=off or GRPC_DEBUG_LOG=0 to disable.
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import * as fs from 'fs';

// ── gRPC debug file logging ────────────────────────────────────────
// Controlled by global LOG_LEVEL env var (default: debug). Set LOG_LEVEL=off to disable.
// Legacy GRPC_DEBUG_LOG=0 also disables.
//   verbose: log ALL gRPC calls (full firehose — every REQ/RES including pin/attr enumeration)
//   debug:   mutating + lifecycle + curated reads (attrs, connections, device, camera, RT)
//   info:    log mutating + lifecycle calls only (create/set/connect/render/camera) + errors
//   warn+:   log errors only
//   off:     disable
type GrpcLogLevel = 'verbose' | 'debug' | 'info' | 'warn' | 'error' | 'off';
const GRPC_LOG_LEVEL: GrpcLogLevel = (process.env.LOG_LEVEL as GrpcLogLevel) || 'debug';
let GRPC_LOG_ENABLED = GRPC_LOG_LEVEL !== 'off' && process.env.GRPC_DEBUG_LOG !== '0';
let grpcLogStream: fs.WriteStream | null = null;

// Mutating + lifecycle methods — logged at info+
const GRPC_MUTATING_METHODS = new Set([
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
  'setPosition',
  'setRenderTargetNode',
  'continueRendering',
  'startRendering',
  'stopRendering', // render lifecycle
  'saveImage1',
  'saveImage2', // render save
  'SetCamera', // camera (LiveLink)
  'update', // ApiChangeManager.update (scene eval)
  'rootNodeGraph', // project open
]);

// Methods shown at debug level (in addition to mutating/lifecycle methods above)
// Excludes methods the web UI inspector calls 100s of times per scene load.
const GRPC_DEBUG_METHODS = new Set([
  'hasAttr', // attribute existence checks (few per tool call)
  'getPinValue', // pin value reads
]);

function initGrpcLog(): void {
  if (!GRPC_LOG_ENABLED || grpcLogStream) return;
  const logPath = path.resolve(__dirname, '..', '..', '..', 'log_grpc.log');
  try {
    // Test if the directory is writable (fails inside Electron asar)
    fs.accessSync(path.dirname(logPath), fs.constants.W_OK);
    grpcLogStream = fs.createWriteStream(logPath, { flags: 'a' });
    grpcLogStream.write(
      `=== gRPC Debug Log started ${new Date().toISOString()} (level: ${GRPC_LOG_LEVEL}) ===\n`
    );
  } catch {
    // Inside packaged Electron app — asar is read-only, skip file logging
    GRPC_LOG_ENABLED = false;
  }
}

/** Call after log file cleanup to write the startup header. Exported for vite plugin use. */
export { initGrpcLog };

function grpcLog(prefix: string, service: string, method: string, data?: any): void {
  if (!GRPC_LOG_ENABLED) return;
  const isError = prefix === 'ERR';
  // At warn+, only log errors
  if ((GRPC_LOG_LEVEL === 'warn' || GRPC_LOG_LEVEL === 'error') && !isError) return;
  // At info level, only log mutating calls and errors
  if (GRPC_LOG_LEVEL === 'info' && !isError && !GRPC_MUTATING_METHODS.has(method)) return;
  // At debug level, show mutating + lifecycle + curated debug reads. Skip everything else.
  if (
    GRPC_LOG_LEVEL === 'debug' &&
    !isError &&
    !GRPC_MUTATING_METHODS.has(method) &&
    !GRPC_DEBUG_METHODS.has(method)
  )
    return;
  initGrpcLog();
  const ts = new Date().toISOString().slice(11, 23);
  const json = data !== undefined ? ' ' + JSON.stringify(data).substring(0, 800) : '';
  grpcLogStream!.write(`[${ts}]  ${prefix} ${service}.${method}${json}\n`);
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const apiVersionConfig = require('../../../api-version.config.js') as {
  apiVersionState: {
    API_VERSION: string;
    USE_ALPHA5_API: boolean;
    USE_BETA2_API: boolean;
    IS_PASSTHROUGH: boolean;
  };
  getProtoDir: () => string;
  setApiVersion: (version: string) => { changed: boolean; previousVersion: string };
  detectApiVersion: (versionNumber: number, versionName?: string) => string;
};

// Read compat flags from mutable state at call time — not captured as const.
// This allows runtime auto-detection to update the compat level.
const { apiVersionState, getProtoDir } = apiVersionConfig;
const USE_ALPHA5_API = (): boolean => apiVersionState.USE_ALPHA5_API;
const USE_BETA2_API = (): boolean => apiVersionState.USE_BETA2_API;
const IS_PASSTHROUGH = (): boolean => apiVersionState.IS_PASSTHROUGH;

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

/**
 * API Compat Levels:
 *
 *   IS_PASSTHROUGH (API_VERSION='2026.2'):
 *     Canonical — pure pass-through, zero transforms.
 *     All protos use 'objectPtr', method names are canonical.
 *
 *   USE_BETA2_API (API_VERSION='beta2'):
 *     Team Beta 2 build — objectPtr→item_ref for value get/set methods.
 *     Same proto dir (proto/), same method names. Only field rename.
 *
 *   USE_ALPHA5_API (API_VERSION='alpha5'):
 *     Team Alpha 5 build — method name renames + field renames + proto_old/.
 */

/** Alpha 5 method name mappings (non-pin methods) */
const ALPHA5_METHOD_NAME_MAP: Record<string, string> = {
  setValueByAttrID: 'setByAttrID',
  getValueByAttrID: 'getByAttrID',
  setValueByIx: 'setByIx',
  getValueByIx: 'getByIx',
  setValueByName: 'setByName',
  getValueByName: 'getByName',
};

/**
 * Alpha 5 pin value type dispatch.
 *
 * 2026.2 uses a single getPinValueByPinID with an expected_type enum.
 * Alpha 5 splits this into 24 type-specific methods:
 *   getPinValue  (bool)   getPinValue1  (float)   getPinValue2  (float_2)
 *   getPinValue3 (float_3) getPinValue4 (float_4)  getPinValue5  (int32)
 *   getPinValue6 (int32_2) getPinValue7 (int32_3)  getPinValue8  (int32_4)
 *   getPinValue9 (MatrixF) getPinValue10(string)   getPinValue11 (ApiFilePath)
 *   getPinValue12..23 = same types but by name instead of PinId
 *
 * Maps PinTypeId (2026.2 expected_type) → { suffix, canonicalField }
 * where suffix is appended to 'getPinValue'/'setPinValue',
 * and canonicalField is the oneof field name in getPinValueByXResponse.
 */
const ALPHA5_PIN_TYPE_MAP: Record<number, { suffix: string; field: string }> = {
  // PinTypeId → alpha5 suffix + canonical response field
  0: { suffix: '', field: 'bool_value' }, // PIN_ID_UNDEFINED → bool default
  1: { suffix: '', field: 'bool_value' }, // PIN_ID_BOOL
  3: { suffix: '5', field: 'int_value' }, // PIN_ID_INT
  4: { suffix: '6', field: 'int2_value' }, // PIN_ID_INT2
  5: { suffix: '7', field: 'int3_value' }, // PIN_ID_INT3
  6: { suffix: '8', field: 'int4_value' }, // PIN_ID_INT4
  9: { suffix: '1', field: 'float_value' }, // PIN_ID_FLOAT
  90: { suffix: '2', field: 'float2_value' }, // PIN_ID_FLOAT2
  11: { suffix: '3', field: 'float3_value' }, // PIN_ID_FLOAT3
  12: { suffix: '4', field: 'float4_value' }, // PIN_ID_FLOAT4
  13: { suffix: '9', field: 'matrix_value' }, // PIN_ID_MATRIX
  14: { suffix: '10', field: 'string_value' }, // PIN_ID_STRING
  15: { suffix: '11', field: 'file_path_value' }, // PIN_ID_FILEPATH
};

/**
 * Typed value field names used in 2026.2 pin value requests/responses.
 * Alpha 5 collapses these into a single generic 'value' field.
 */
const TYPED_VALUE_FIELDS = [
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
] as const;

/** Collapse typed value fields (bool_value, float_value, etc.) into generic 'value'. */
function collapseTypedValue(params: Record<string, unknown>): void {
  for (const field of TYPED_VALUE_FIELDS) {
    if (field in params) {
      params.value = params[field];
      delete params[field];
      break;
    }
  }
}

/**
 * Value get/set methods that use item_ref instead of objectPtr.
 * Shared by both Beta 2 and Alpha 5 compat layers.
 */
const ITEM_REF_METHODS = new Set([
  'setValueByAttrID',
  'getValueByAttrID',
  'setValueByIx',
  'getValueByIx',
  'setValueByName',
  'getValueByName',
]);

/**
 * Pin info methods that use nodePinInfoRef instead of objectPtr.
 * Beta 2 and Alpha 5 protos use the original field name.
 */
const PIN_INFO_REF_METHODS = new Set([
  'deleteNodePinInfo',
  'updateNodePinInfo',
  'getNodePinInfo',
  'getApiNodePinInfo',
]);

/**
 * Translate a canonical method name to the target API version's equivalent.
 * Callers always use canonical (2026.2) names; this handles the rest.
 *
 * For alpha5 pin value methods, params.expected_type drives type dispatch
 * to the correct getPinValue{N} / setPinValue{N} method.
 */
export function getCompatibleMethodName(
  methodName: string,
  params?: Record<string, unknown>
): string {
  if (IS_PASSTHROUGH() || USE_BETA2_API()) return methodName;
  if (!USE_ALPHA5_API()) return methodName;

  // Alpha 5 pin value dispatch: getPinValueByPinID → getPinValue{N}
  if (methodName === 'getPinValueByPinID' || methodName === 'setPinValueByPinID') {
    const base = methodName === 'getPinValueByPinID' ? 'getPinValue' : 'setPinValue';
    const expectedType = Number(params?.expected_type ?? 0);
    const mapping = ALPHA5_PIN_TYPE_MAP[expectedType];
    return base + (mapping?.suffix ?? '');
  }

  // Alpha 5 pin value by name: getPinValueByName → getPinValue{12+N}
  if (methodName === 'getPinValueByName' || methodName === 'setPinValueByName') {
    const base = methodName === 'getPinValueByName' ? 'getPinValue' : 'setPinValue';
    const expectedType = Number(params?.expected_type ?? 0);
    const mapping = ALPHA5_PIN_TYPE_MAP[expectedType];
    if (mapping) {
      // byName variants are offset +12 from byPinId variants
      const suffixNum = mapping.suffix === '' ? 12 : Number(mapping.suffix) + 12;
      return base + String(suffixNum);
    }
    return base + '12'; // default to bool by name
  }

  // Alpha 5 pin value by index: getPinValueByIx → getPinValueIx{N}
  if (methodName === 'getPinValueByIx' || methodName === 'setPinValueByIx') {
    const base = methodName === 'getPinValueByIx' ? 'getPinValueIx' : 'setPinValueIx';
    const expectedType = Number(params?.expected_type ?? 0);
    const mapping = ALPHA5_PIN_TYPE_MAP[expectedType];
    return base + (mapping?.suffix ?? '');
  }

  // Non-pin method renames
  return ALPHA5_METHOD_NAME_MAP[methodName] ?? methodName;
}

/**
 * Transform request parameters for API version compatibility.
 * This is the SINGLE transform path — callMethod() calls this.
 * Callers must send correct proto field names (e.g. nodePinInfoRef, not objectPtr).
 * 2026.2 is pure pass-through — zero transforms.
 */
export function transformRequestParams(
  methodName: string,
  params: Record<string, unknown>
): Record<string, unknown> {
  // 2026.2: pure pass-through, zero transforms.
  if (IS_PASSTHROUGH()) return params;

  // Beta 2 + Alpha 5: value get/set methods use item_ref instead of objectPtr.
  if (ITEM_REF_METHODS.has(methodName) && 'objectPtr' in params) {
    const transformed: Record<string, unknown> = { ...params };
    transformed.item_ref = transformed.objectPtr;
    delete transformed.objectPtr;
    return transformed;
  }

  // Beta 2 + Alpha 5: pin info methods use nodePinInfoRef instead of objectPtr.
  if (PIN_INFO_REF_METHODS.has(methodName) && 'objectPtr' in params) {
    const transformed: Record<string, unknown> = { ...params };
    transformed.nodePinInfoRef = transformed.objectPtr;
    delete transformed.objectPtr;
    return transformed;
  }

  // Beta 2 has no further transforms beyond the renames above.
  if (USE_BETA2_API()) return params;

  // Alpha 5 compat below
  if (!USE_ALPHA5_API()) return params;

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

    collapseTypedValue(transformed);
    return transformed;
  }

  // getPinValueByName/setPinValueByName → getPinValue12..23
  // Alpha 5 uses: objectPtr, name, no expected_type, generic value
  if (methodName === 'getPinValueByName' || methodName === 'setPinValueByName') {
    const transformed: Record<string, unknown> = { ...params };
    delete transformed.expected_type;
    collapseTypedValue(transformed);
    return transformed;
  }

  // getPinValueByIx/setPinValueByIx → getPinValueIx{N}
  // Alpha 5 uses: objectPtr, index, no expected_type, generic value
  if (methodName === 'getPinValueByIx' || methodName === 'setPinValueByIx') {
    const transformed: Record<string, unknown> = { ...params };
    delete transformed.expected_type;
    collapseTypedValue(transformed);
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
      // Keepalive: detect dead server (Octane closed/crashed) within ~15s.
      // octaneServGrpc allows pings as frequent as 5s (GRPC_ARG_HTTP2_MIN_RECV_PING_INTERVAL_WITHOUT_DATA_MS).
      'grpc.keepalive_time_ms': 10_000, // send ping every 10s
      'grpc.keepalive_timeout_ms': 5_000, // close channel if no pong within 5s
      'grpc.keepalive_permit_without_calls': 1, // ping even when no RPCs active
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
    // API version compat: translate method name first (needs original params for
    // alpha5 pin type dispatch), then transform params for the wire call.
    const compatMethod = getCompatibleMethodName(methodName, params);
    const compatParams = transformRequestParams(methodName, params);

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
      await this.callMethod('ApiInfo', 'octaneVersion', {}, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Auto-detect API version from the connected Octane instance.
   *
   * Queries octaneVersion + octaneName (version-agnostic RPCs), parses the
   * response, and updates the global compat flags. If the proto dir changes
   * (alpha5 ↔ 2026.2), clears loaded services so they reload with the
   * correct protos on next access.
   *
   * Safe to call multiple times — no-ops if version hasn't changed.
   *
   * @returns Detected version string and whether it changed
   */
  async detectAndSetApiVersion(): Promise<{
    detectedVersion: string;
    changed: boolean;
    versionNumber: number;
    versionName: string;
  }> {
    // octaneVersion and octaneName are identical across all API versions
    const [versionResp, nameResp] = await Promise.all([
      this.callMethod('ApiInfo', 'octaneVersion', {}, { timeout: 5000 }),
      this.callMethod('ApiInfo', 'octaneName', {}, { timeout: 5000 }),
    ]);

    const versionNumber = versionResp?.result ?? 0;
    const versionName = nameResp?.result ?? '';

    const detected = apiVersionConfig.detectApiVersion(versionNumber, versionName);
    const prevProtoDir = getProtoDir();
    const { changed } = apiVersionConfig.setApiVersion(detected);
    const newProtoDir = getProtoDir();

    // If proto dir changed, clear loaded services — they'll reload from the
    // correct proto dir on next getService() call.
    if (changed && prevProtoDir !== newProtoDir) {
      grpcLog('INFO', 'detectApiVersion', 'protoDir changed', {
        from: prevProtoDir,
        to: newProtoDir,
      });
      this.services.clear();
      this.packageDefinition = null;
      this.protoDescriptor = null;
    }

    if (changed) {
      grpcLog('INFO', 'detectApiVersion', 'version changed', {
        detected,
        versionNumber,
        versionName,
      });
    }

    return { detectedVersion: detected, changed, versionNumber, versionName };
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
  // 2026.2 canonical: all protos use 'objectPtr'. No remapping needed.
  // For Beta 2 compat (old protos with item_ref), add entries here with field: 'item_ref'.
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
