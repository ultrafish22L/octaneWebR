/**
 * API Service - Core gRPC communication
 * Handles all API calls to the Octane server
 */

import { getObjectTypeForService, createObjectPtr } from '../../constants/OctaneTypes';
import { BaseService } from './BaseService';
import { Logger } from '../../utils/Logger';
import { getCompatibleMethodName, transformRequestParams } from '../../config/apiVersionConfig';

/** Default timeout for API calls (ms). Prevents zombie requests from accumulating. */
const API_TIMEOUT_MS = 30_000;

/**
 * Loosely typed API response value. A recursive union that covers all JSON
 * value types, allowing chained property access without using `any`.
 * Service methods use `as` casts to extract typed values.
 */
export type GrpcValue = string | number | boolean | null | GrpcObject | GrpcArray;
export interface GrpcObject {
  [key: string]: GrpcValue;
}
export interface GrpcArray extends Array<GrpcValue> {}

/**
 * The top-level response from callApi is always an object (GrpcObject).
 */
export type ApiCallResult = GrpcObject;

/**
 * Safely cast a GrpcValue to GrpcObject (for nested property access).
 * Returns undefined if the value is not an object.
 */
export function asObject(value: GrpcValue | undefined): GrpcObject | undefined {
  if (value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)) {
    return value as GrpcObject;
  }
  return undefined;
}

/**
 * Safely cast a GrpcValue to number.
 */
export function asNumber(value: GrpcValue | undefined, fallback = 0): number {
  if (typeof value === 'number') return value;
  return fallback;
}

/**
 * Safely cast a GrpcValue to string.
 */
export function asString(value: GrpcValue | undefined, fallback = ''): string {
  if (typeof value === 'string') return value;
  return fallback;
}

/**
 * Safely cast a GrpcValue to boolean.
 * Accepts boolean, truthy numbers, and "true"/"1" strings (protobuf JSON variants).
 */
export function asBool(value: GrpcValue | undefined, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value === 'true' || value === '1';
  return fallback;
}

/**
 * Get a handle number from a result object.
 * Accepts both number and string handles (protobuf JSON serializes uint64 as strings).
 */
export function getHandle(result: GrpcValue | undefined): number | undefined {
  const obj = asObject(result);
  if (obj) {
    const h = obj.handle;
    if (typeof h === 'number') return h;
    if (typeof h === 'string') {
      const n = Number(h);
      return isNaN(n) ? undefined : n;
    }
  }
  // Also accept a direct number (some APIs return the handle itself as result)
  if (typeof result === 'number') return result;
  return undefined;
}

/**
 * Request body structure for API calls
 */
interface ApiRequestBody {
  objectPtr?: {
    handle: string;
    type: number;
  };
  handle?: string | number;
  [key: string]: unknown;
}

/**
 * API Service handles all gRPC communication with Octane server
 */
export class ApiService extends BaseService {
  /** Whether the Octane host is on the local machine (set by health check). */
  private _isLocal = false;

  get isLocal(): boolean {
    return this._isLocal;
  }

  /**
   * Make a gRPC API call to the Octane server
   * @param service - Service name (e.g., 'ApiItem', 'ApiScene')
   * @param method - Method name (e.g., 'getValueByAttrID')
   * @param handle - Node handle, null, or request object
   * @param params - Additional parameters to merge into request
   * @returns Promise resolving to the API response data
   * @note Returns 'any' type as API responses have dynamic structure from gRPC
   */

  async callApi(
    service: string,
    method: string,
    handle?: string | number | Record<string, unknown> | null,
    params: Record<string, unknown> = {},
    timeoutMs?: number
  ): Promise<ApiCallResult> {
    // Apply API version compatibility: translate method name if needed
    const compatibleMethod = getCompatibleMethodName(service, method);

    if (method !== compatibleMethod) {
      Logger.debugV(`API Compatibility: ${service}.${method} → ${compatibleMethod}`);
    }

    const url = `${this.serverUrl}/api/grpc/${service}/${compatibleMethod}`;

    Logger.api(service, compatibleMethod, handle);

    /**
     * Request body construction follows Octane's gRPC conventions:
     * - Some services (ApiItem, ApiNode, etc.) require an objectPtr wrapper:
     *   { objectPtr: { handle: "123", type: ObjectType.NODE } }
     * - Others accept the handle directly: { handle: 123 }
     * - OctaneTypes.ts maps service names to their required ObjectType
     */
    let body: ApiRequestBody = {};

    if (typeof handle === 'string' || typeof handle === 'number') {
      const objectType = getObjectTypeForService(service);

      if (objectType !== undefined) {
        body.objectPtr = createObjectPtr(String(handle), objectType);
      } else {
        body.handle = handle;
      }
    } else if (handle !== undefined && handle !== null) {
      body = { ...handle };
    }

    if (params && Object.keys(params).length > 0) {
      // Apply parameter transformation if needed for API version compatibility
      const transformedParams = transformRequestParams(service, method, params);

      // Log if parameters were transformed
      const paramsChanged = JSON.stringify(params) !== JSON.stringify(transformedParams);
      if (paramsChanged) {
        Logger.debugV(`API Compatibility: Parameter transformation applied`);
        Logger.debugV(`   Original:`, params);
        Logger.debugV(`   Transformed:`, transformedParams);
      }

      body = { ...body, ...transformedParams };
      Logger.debugV('Added params:', transformedParams);
    }

    Logger.debugV('Request body:', JSON.stringify(body));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs ?? API_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorMsg = `API call failed: ${response.status}`;
        try {
          const error = await response.json();
          errorMsg = error.error || errorMsg;
        } catch {
          // Response body isn't JSON (e.g., HTML 502 from proxy) — use status text
        }
        throw new Error(errorMsg);
      }

      const data = (await response.json()) as ApiCallResult;
      Logger.debugV(`${service}.${method} success`);
      return data;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        Logger.error(`${service}.${method} timed out after ${API_TIMEOUT_MS}ms`);
        throw new Error(`${service}.${method} timed out after ${API_TIMEOUT_MS}ms`);
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error(`${service}.${method} error:`, errorMessage);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Check if the Octane server is healthy and responding
   * @returns Promise resolving to true if server is healthy, false otherwise
   */
  async checkServerHealth(): Promise<boolean> {
    const healthUrl = `${this.serverUrl}/api/health`;
    Logger.debug('Fetching health check:', healthUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const healthResponse = await fetch(healthUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });

      Logger.debug('Health response status:', healthResponse.status);

      if (!healthResponse.ok) {
        const healthData = await healthResponse.json().catch(() => ({}));
        Logger.error('Server unhealthy:', healthData);
        return false;
      }

      const healthData = await healthResponse.json();
      this._isLocal = !!healthData.isLocal;
      Logger.debug('Server health check passed:', healthData, 'isLocal:', this._isLocal);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error('Health check failed:', errorMessage);
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }
}
