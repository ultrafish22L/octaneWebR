/**
 * API Service - Core gRPC communication
 * Handles all API calls to the Octane server
 */

import { getObjectTypeForService, createObjectPtr } from '../../constants/OctaneTypes';
import { BaseService } from './BaseService';
import Logger from '../../utils/Logger';
import { getCompatibleMethodName, transformRequestParams, getApiVersion } from '../../config/apiVersionConfig';

/**
 * Request body structure for API calls
 */
interface ApiRequestBody {
  objectPtr?: {
    handle: string;
    type: number;
  };
  handle?: string | number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * API Service handles all gRPC communication with Octane server
 */
export class ApiService extends BaseService {
  /**
   * Make a gRPC API call to the Octane server
   * @param service - Service name (e.g., 'ApiItem', 'ApiScene')
   * @param method - Method name (e.g., 'getValueByAttrID')
   * @param handle - Node handle, null, or request object
   * @param params - Additional parameters to merge into request
   * @returns Promise resolving to the API response data
   * @note Returns 'any' type as API responses have dynamic structure from gRPC
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async callApi(
    service: string, 
    method: string, 
    handle?: string | number | Record<string, unknown> | null, 
    params: Record<string, unknown> = {}
  ): Promise<any> {
    // Apply API version compatibility: translate method name if needed
    const compatibleMethod = getCompatibleMethodName(service, method);
    
    if (method !== compatibleMethod) {
      Logger.debug(`🔄 API Compatibility: ${method} → ${compatibleMethod} (${getApiVersion()})`);
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
        Logger.debug('Created objectPtr:', body.objectPtr);
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
        Logger.debug(`🔄 API Compatibility: Parameter transformation applied`);
        Logger.debug(`   Original:`, params);
        Logger.debug(`   Transformed:`, transformedParams);
      }
      
      body = { ...body, ...transformedParams };
      Logger.debug('Added params:', transformedParams);
    }
    
    Logger.debug('Request body:', JSON.stringify(body));
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `API call failed: ${response.status}`);
      }
      
      const data = await response.json();
      Logger.debug(`${service}.${method} success`);
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // attrInfo failures are expected for some node types (e.g., nodes without A_VALUE attribute)
      // Log them at WARN level instead of ERROR to reduce noise
      if (method === 'attrInfo' && errorMessage.includes('invalid object reference')) {
        Logger.warn(`${service}.${method}: Node does not support attrInfo (expected for some types)`);
      } else {
        Logger.error(`${service}.${method} error:`, errorMessage);
      }
      
      throw error;
    }
  }

  /**
   * Check if the Octane server is healthy and responding
   * @returns Promise resolving to true if server is healthy, false otherwise
   */
  async checkServerHealth(): Promise<boolean> {
    const healthUrl = `${this.serverUrl}/api/health`;
    Logger.debug('Fetching health check:', healthUrl);
    
    try {
      const healthResponse = await fetch(healthUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      Logger.debug('Health response status:', healthResponse.status);
      
      if (!healthResponse.ok) {
        const healthData = await healthResponse.json().catch(() => ({}));
        Logger.error('Server unhealthy:', healthData);
        return false;
      }
      
      const healthData = await healthResponse.json();
      Logger.debug('Server health check passed:', healthData);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error('Health check failed:', errorMessage);
      return false;
    }
  }
}
