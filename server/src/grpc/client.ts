/**
 * Express Server gRPC Client
 *
 * Wraps OctaneGrpcClientBase with EventEmitter-based callback streaming
 * and device/system info APIs used by the Express production server.
 */

import { EventEmitter } from 'events';
import { OctaneGrpcClientBase, GrpcCallOptions } from './OctaneGrpcClientBase';

export { GrpcCallOptions } from './OctaneGrpcClientBase';

const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

// Verbose gRPC debug logging (proto resolution, call params, responses)
const VERBOSE = process.env.OCTANE_GRPC_VERBOSE === 'true';
const debugV = (...args: any[]) => {
  if (VERBOSE) console.log(DIM, ...args, RESET);
};

/** Core proto files to batch-load on startup for faster first-call resolution */
const CORE_PROTO_FILES = [
  'common.proto',
  'apiprojectmanager.proto',
  'livelink.proto',
  'apirender.proto',
  'callback.proto',
  'callbackstream.proto',
  'apiitemarray.proto',
  'apinodearray.proto',
  'apinodesystem.proto',
  'apinodegraph.proto',
  'octaneenums.proto',
  'octaneids.proto',
];

export class OctaneGrpcClient extends EventEmitter {
  private base: OctaneGrpcClientBase;
  private isReconnecting = false;
  private reconnectAttempts = 0;
  private callbackStream: any = null;
  private static readonly MAX_RECONNECT_ATTEMPTS = 10;
  private static readonly BASE_RECONNECT_DELAY = 2000; // ms
  private static readonly MAX_RECONNECT_DELAY = 60000; // ms

  constructor(octaneHost?: string, octanePort?: number) {
    super();
    this.base = new OctaneGrpcClientBase(octaneHost, octanePort);
    console.log(`gRPC channel: ${this.base.address}`);
  }

  /** The "host:port" address of the Octane gRPC endpoint. */
  get address(): string {
    return this.base.address;
  }

  // ========== Delegated Core Methods ==========

  async initialize(): Promise<void> {
    await this.base.initialize(CORE_PROTO_FILES);
    console.log(`Loaded core proto files`);
  }

  async callMethod(
    serviceName: string,
    methodName: string,
    params: any = {},
    options: GrpcCallOptions = {}
  ): Promise<any> {
    debugV(
      `gRPC call: ${serviceName}.${methodName}`,
      Object.keys(params).length > 0 ? `(${Object.keys(params).length} params)` : ''
    );
    debugV(`  params:`, JSON.stringify(params).slice(0, 200));

    try {
      const response = await this.base.callMethod(serviceName, methodName, params, options);
      debugV(`  ${serviceName}.${methodName} →`, JSON.stringify(response).slice(0, 200));
      return response;
    } catch (error: any) {
      console.error(`${RED}${serviceName}.${methodName}: ${error.message}${RESET}`, error.code);
      throw error;
    }
  }

  getService(serviceName: string): any {
    return this.base.getService(serviceName);
  }

  async checkHealth(): Promise<boolean> {
    return this.base.checkHealth();
  }

  close(): void {
    if (this.callbackStream) {
      try {
        this.callbackStream.cancel();
      } catch {
        /* already closed */
      }
      this.callbackStream = null;
    }
    this.base.close();
  }

  // ========== Callback Streaming ==========

  /**
   * Extract render images from a callback response, checking multiple field locations.
   */
  private extractRenderImages(response: any): any {
    if (response.render_images?.data?.length > 0) {
      return response.render_images;
    }
    if (response.newImage?.render_images?.data?.length > 0) {
      return response.newImage.render_images;
    }
    if (response.renderimages?.data?.length > 0) {
      return response.renderimages;
    }
    return null;
  }

  /**
   * Handle an OnNewImage callback that had no inline image data.
   * Falls back to grabRenderResult() to fetch images from the render engine.
   */
  private handleGrabRenderFallback(response: any): void {
    this.callMethod('ApiRenderEngine', 'grabRenderResult', {})
      .then((grabResponse: any) => {
        if (!grabResponse || grabResponse.result === false) return;

        const grabbedImages = grabResponse.renderImages || grabResponse.renderimages;
        if (grabbedImages?.data?.length > 0) {
          this.emit('OnNewImage', {
            render_images: grabbedImages,
            callback_id: response.newImage?.callback_id,
            user_data: response.newImage?.user_data,
          });
        }
      })
      .catch((error: any) => {
        console.error(`${RED}grabRenderResult failed: ${error.message}${RESET}`);
      });
  }

  /**
   * Handle an OnNewStatistics callback by fetching full statistics from the render engine.
   */
  private handleStatisticsCallback(response: any): void {
    this.callMethod('ApiRenderEngine', 'getRenderStatistics', {})
      .then((statsResponse: any) => {
        if (statsResponse?.statistics) {
          this.emit('OnNewStatistics', {
            statistics: statsResponse.statistics,
            user_data: response.newStatistics?.user_data,
            timestamp: Date.now(),
          });
        }
      })
      .catch((error: any) => {
        console.error(`${RED}getRenderStatistics failed: ${error.message}${RESET}`);
      });
  }

  /**
   * Dispatch a single callback stream response to the appropriate handler.
   */
  private handleCallbackData(response: any): void {
    const renderImages = this.extractRenderImages(response);

    if (renderImages) {
      this.emit('OnNewImage', {
        render_images: renderImages,
        callback_id: response.newImage?.callback_id || response.callback_id,
        user_data: response.newImage?.user_data || response.user_data,
      });
    } else if (response.newImage) {
      this.handleGrabRenderFallback(response);
    } else if (response.newStatistics) {
      this.handleStatisticsCallback(response);
    } else if (response.renderFailure) {
      console.error(`${RED}Render failure callback received${RESET}`);
      this.emit('OnRenderFailure', {
        user_data: response.renderFailure?.user_data,
        timestamp: Date.now(),
      });
    } else if (response.projectManagerChanged) {
      console.log('Project manager changed callback received');
      this.emit('OnProjectManagerChanged', {
        user_data: response.projectManagerChanged?.user_data,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Register callback and start streaming events from Octane.
   */
  async startCallbackStreaming(): Promise<void> {
    try {
      // Optional: register OnNewImage callback with Octane (not critical)
      try {
        await this.callMethod(
          'ApiRenderEngine',
          'setOnNewImageCallback',
          { callback: { callbackSource: 'octaneWebR', callbackId: 1 }, userData: 0 },
          { timeout: 5000 }
        );
      } catch {
        // Callback registration is optional — streaming works without it
      }

      const streamService = this.getService('StreamCallbackService');
      if (!streamService?.callbackChannel) {
        throw new Error('StreamCallbackService.callbackChannel not found');
      }

      // Cancel previous stream to prevent leaked listeners
      if (this.callbackStream) {
        try {
          this.callbackStream.cancel();
        } catch {
          /* already closed */
        }
      }

      const stream = streamService.callbackChannel({});
      this.callbackStream = stream;

      stream.on('data', (response: any) => {
        try {
          this.handleCallbackData(response);
        } catch (error: any) {
          console.error(`${RED}Error processing callback data: ${error.message}${RESET}`);
        }
      });

      stream.on('end', () => {
        console.log('Callback stream ended cleanly');
        this.callbackStream = null;
        this.scheduleReconnect();
      });

      stream.on('error', (error: any) => {
        console.error(`${RED}Callback stream error: ${error.message}${RESET}`);
        this.callbackStream = null;
        this.scheduleReconnect();
      });

      // Reset on successful connection
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      console.log('Callback streaming started');
    } catch (error: any) {
      console.error(`${RED}Failed to start callback streaming: ${error.message}${RESET}`);
      throw error;
    }
  }

  private lastReconnectTime = 0;

  private scheduleReconnect(): void {
    if (this.isReconnecting) return; // Prevent concurrent reconnect loops

    // Reset counter after a cooldown period so callbacks can recover
    // if Octane restarts long after max attempts were exhausted
    const RECONNECT_COOLDOWN = 60_000; // 60s
    if (
      this.reconnectAttempts >= OctaneGrpcClient.MAX_RECONNECT_ATTEMPTS &&
      Date.now() - this.lastReconnectTime > RECONNECT_COOLDOWN
    ) {
      console.log('Reconnect cooldown elapsed — resetting attempt counter');
      this.reconnectAttempts = 0;
    }

    if (this.reconnectAttempts >= OctaneGrpcClient.MAX_RECONNECT_ATTEMPTS) {
      console.error(
        `${RED}Callback stream: max reconnect attempts (${OctaneGrpcClient.MAX_RECONNECT_ATTEMPTS}) reached, giving up${RESET}`
      );
      return;
    }

    this.lastReconnectTime = Date.now();

    this.isReconnecting = true;
    this.reconnectAttempts++;

    // Exponential backoff: 2s, 4s, 8s, 16s, ... capped at 60s
    const delay = Math.min(
      OctaneGrpcClient.BASE_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts - 1),
      OctaneGrpcClient.MAX_RECONNECT_DELAY
    );

    console.log(
      `Callback stream reconnect attempt ${this.reconnectAttempts}/${OctaneGrpcClient.MAX_RECONNECT_ATTEMPTS} in ${(delay / 1000).toFixed(0)}s`
    );

    const timer = setTimeout(() => {
      this.startCallbackStreaming()
        .then(() => {
          this.isReconnecting = false;
        })
        .catch(e => {
          console.error(`${RED}Reconnection failed: ${e.message}${RESET}`);
          this.isReconnecting = false;
          this.scheduleReconnect();
        });
    }, delay);
    timer.unref(); // Don't keep process alive during shutdown
  }

  // ========== Scene & Device Info APIs ==========

  async getGeometryStatistics(): Promise<any> {
    try {
      const response = await this.callMethod('ApiRenderEngineService', 'getGeometryStatistics', {});
      return response.stats || response;
    } catch (error: any) {
      console.error(`${RED}Failed to get geometry statistics: ${error.message}${RESET}`);
      throw error;
    }
  }

  async getDeviceCount(): Promise<number> {
    try {
      const response = await this.callMethod('ApiRenderEngineService', 'getDeviceCount', {});
      return response.result || 0;
    } catch (error: any) {
      console.error(`${RED}Failed to get device count: ${error.message}${RESET}`);
      return 0;
    }
  }

  async getDeviceName(index: number = 0): Promise<string> {
    try {
      const response = await this.callMethod('ApiRenderEngineService', 'getDeviceName', { index });
      return response.result || 'Unknown GPU';
    } catch (error: any) {
      console.error(`${RED}Failed to get device name for index ${index}: ${error.message}${RESET}`);
      return 'Unknown GPU';
    }
  }

  async deviceUsesHardwareRayTracing(index: number = 0): Promise<boolean> {
    try {
      const response = await this.callMethod(
        'ApiRenderEngineService',
        'deviceUsesHardwareRayTracing',
        { index }
      );
      return response.result || false;
    } catch (error: any) {
      console.error(
        `${RED}Failed to check hardware RT for device ${index}: ${error.message}${RESET}`
      );
      return false;
    }
  }

  async getMemoryUsage(deviceIx: number = 0): Promise<any> {
    try {
      const response = await this.callMethod('ApiRenderEngineService', 'getMemoryUsage', {
        deviceIx,
      });
      return response.memUsage || response;
    } catch (error: any) {
      console.error(
        `${RED}Failed to get memory usage for device ${deviceIx}: ${error.message}${RESET}`
      );
      throw error;
    }
  }

  async getOctaneVersion(): Promise<string> {
    try {
      const response = await this.callMethod('ApiInfoService', 'octaneName', {});
      return response.result || 'Unknown Version';
    } catch (error: any) {
      console.error(`${RED}Failed to get Octane version: ${error.message}${RESET}`);
      return 'Unknown Version';
    }
  }

  async getSystemInfo(): Promise<{
    primitiveCount: number;
    meshCount: number;
    gpuName: string;
    hasHardwareRT: boolean;
    totalMemoryGB: number;
    octaneVersion: string;
  }> {
    try {
      const [geometryStats, gpuName, hasRT, memUsage, version] = await Promise.all([
        this.getGeometryStatistics(),
        this.getDeviceName(0),
        this.deviceUsesHardwareRayTracing(0),
        this.getMemoryUsage(0),
        this.getOctaneVersion(),
      ]);

      const primitiveCount =
        (geometryStats.triCount || 0) +
        (geometryStats.dispTriCount || 0) +
        (geometryStats.hairSegCount || 0) +
        (geometryStats.sphereCount || 0) +
        (geometryStats.emitPriCount || 0);

      const totalMemoryGB = memUsage.totalDeviceMemory
        ? parseFloat((memUsage.totalDeviceMemory / (1024 * 1024 * 1024)).toFixed(1))
        : 0;

      return {
        primitiveCount,
        meshCount: 1,
        gpuName,
        hasHardwareRT: hasRT,
        totalMemoryGB,
        octaneVersion: version,
      };
    } catch (error: any) {
      console.error(`${RED}Failed to get system info: ${error.message}${RESET}`);
      return {
        primitiveCount: 0,
        meshCount: 1,
        gpuName: 'Unknown GPU',
        hasHardwareRT: false,
        totalMemoryGB: 0,
        octaneVersion: 'Unknown',
      };
    }
  }
}

// Singleton instance
let instance: OctaneGrpcClient | null = null;

export function getGrpcClient(): OctaneGrpcClient {
  if (!instance) {
    instance = new OctaneGrpcClient();
  }
  return instance;
}
