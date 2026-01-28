/**
 * Import centralized API version configuration
 * 
 * This file bridges the CommonJS api-version.config.js (used by server)
 * and the ES modules used by the client.
 */

// @ts-ignore - importing CommonJS module
import * as apiVersionConfig from '../../../api-version.config.js';

export const USE_ALPHA5_API = (apiVersionConfig as any).USE_ALPHA5_API;
export const getApiVersionName = (apiVersionConfig as any).getApiVersionName;
export const getProtoDir = (apiVersionConfig as any).getProtoDir;
