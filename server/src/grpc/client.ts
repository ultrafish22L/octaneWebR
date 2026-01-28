import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { EventEmitter } from 'events';
import * as fs from 'fs';

export interface GrpcCallOptions {
  timeout?: number;
  metadata?: grpc.Metadata;
}

export class OctaneGrpcClient extends EventEmitter {
  private channel: grpc.Channel;
  private services: Map<string, any> = new Map();
  private packageDefinition: protoLoader.PackageDefinition | null = null;
  private protoDescriptor: grpc.GrpcObject | null = null;
  
  constructor(
    private octaneHost: string = process.env.OCTANE_HOST || OctaneGrpcClient.detectDefaultHost(),
    private octanePort: number = parseInt(process.env.OCTANE_PORT || '51022')
  ) {
    super();
    
    const address = `${this.octaneHost}:${this.octanePort}`;
    this.channel = new grpc.Channel(
      address,
      grpc.credentials.createInsecure(),
      {}
    );
    
    const isSandbox = this.octaneHost === 'host.docker.internal';
    console.log(`📡 gRPC channel initialized: ${address}`);
    if (isSandbox) {
      console.log(`🐳 Using Docker networking (sandbox environment detected)`);
    }
  }

  private static detectDefaultHost(): string {
    // Detect sandbox/Docker environment
    const indicators = [
      fs.existsSync('/.dockerenv'),
      process.env.USER?.toLowerCase().includes('sandbox'),
      process.env.KUBERNETES_SERVICE_HOST !== undefined,
      fs.existsSync('/workspace') // OpenHands indicator
    ];
    
    const isSandbox = indicators.some(indicator => indicator);
    return isSandbox ? 'host.docker.internal' : 'localhost';
  }
  
  async initialize(): Promise<void> {
    const PROTO_PATH = path.resolve(__dirname, '../../proto');
    
    // Load common proto files that are needed for most services
    const coreProtoFiles = [
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
      'octaneids.proto'
    ].map(f => path.join(PROTO_PATH, f)).filter(f => fs.existsSync(f));
    
    if (coreProtoFiles.length === 0) {
      console.log('⚠️ No core proto files found, will load services on-demand');
      return;
    }
    
    console.log(`📦 Loading ${coreProtoFiles.length} core proto files...`);
    
    try {
      // Use proto-loader with options that handle Octane's proto structure
      this.packageDefinition = protoLoader.loadSync(coreProtoFiles, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
        includeDirs: [PROTO_PATH]
      });
      
      this.protoDescriptor = grpc.loadPackageDefinition(this.packageDefinition);
      console.log('✅ Core proto definitions loaded successfully');
    } catch (error: any) {
      console.log('⚠️ Could not load proto files, will use dynamic mode:', error.message);
      this.protoDescriptor = null;
    }
  }
  
  private loadServiceProto(serviceName: string): any {
    const PROTO_PATH = path.resolve(__dirname, '../../proto');
    
    // Map service names to their proto files (based on octaneWeb/octaneProxy mapping)
    const serviceToProtoMap: Record<string, string> = {
      'ApiItemService': 'apinodesystem_3.proto',
      'ApiItem': 'apinodesystem_3.proto',
      'ApiNodeGraphService': 'apinodesystem_6.proto',
      'ApiNodeGraph': 'apinodesystem_6.proto',
      'ApiItemArrayService': 'apinodesystem_1.proto',
      'ApiItemArray': 'apinodesystem_1.proto',
      'ApiItemGetterService': 'apinodesystem.proto',
      'ApiItemSetterService': 'apinodesystem.proto',
      'ApiNodeService': 'apinodesystem_7.proto',
      'ApiNode': 'apinodesystem_7.proto',
      'ApiNodeArray': 'apinodesystem_5.proto',
      'ApiRenderEngine': 'apirender.proto',
      'ApiRenderEngineService': 'apirender.proto',
      'ApiInfo': 'apiinfo.proto',
      'ApiInfoService': 'apiinfo.proto',
    };
    
    const protoFileName = serviceToProtoMap[serviceName] || (serviceName.toLowerCase() + '.proto');
    const protoFilePath = path.join(PROTO_PATH, protoFileName);
    
    if (!fs.existsSync(protoFilePath)) {
      console.log(`⚠️ Proto file not found: ${protoFileName}`);
      return null;
    }
    
    try {
      const packageDefinition = protoLoader.loadSync([protoFilePath], {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
        includeDirs: [PROTO_PATH]
      });
      
      const descriptor = grpc.loadPackageDefinition(packageDefinition);
      console.log(`✅ Loaded proto for ${serviceName} from ${protoFileName}`);
      return descriptor;
    } catch (error: any) {
      console.log(`⚠️ Could not load proto for ${serviceName}:`, error.message);
      return null;
    }
  }
  
  public getService(serviceName: string): any {
    if (this.services.has(serviceName)) {
      return this.services.get(serviceName);
    }
    
    let descriptor = this.protoDescriptor;
    
    // If no main descriptor or service not found, try loading service-specific proto
    if (!descriptor) {
      descriptor = this.loadServiceProto(serviceName);
      if (!descriptor) {
        throw new Error(`Could not load proto for service ${serviceName}`);
      }
    }
    
    // Try different namespace patterns for Octane proto files
    let ServiceConstructor: any = null;
    const patterns = [
      `octaneapi.${serviceName}Service`,  // Try with Service suffix first (this is the client!)
      `octaneapi.${serviceName}`,
      `livelinkapi.${serviceName}Service`, // For LiveLink services
      `livelinkapi.${serviceName}`,
      `${serviceName}Service`,            // For LiveLinkService, etc.
      `OctaneEngine.Livelink.${serviceName}`,
      `Octane.${serviceName}`,
      serviceName
    ];
    
    for (const pattern of patterns) {
      ServiceConstructor = this.resolveServicePath(descriptor, pattern);
      if (ServiceConstructor) {
        console.log(`✅ Found service: ${serviceName} at ${pattern}`);
        break;
      }
    }
    
    // If not found in main descriptor, try loading service-specific proto
    if (!ServiceConstructor && descriptor === this.protoDescriptor) {
      console.log(`⚠️ Service ${serviceName} not in main descriptor, trying service-specific proto...`);
      const serviceDescriptor = this.loadServiceProto(serviceName);
      if (serviceDescriptor) {
        for (const pattern of patterns) {
          ServiceConstructor = this.resolveServicePath(serviceDescriptor, pattern);
          if (ServiceConstructor) {
            console.log(`✅ Found service: ${serviceName} at ${pattern} (service-specific proto)`);
            break;
          }
        }
      }
    }
    
    if (!ServiceConstructor) {
      throw new Error(`Service ${serviceName} not found in proto definitions`);
    }
    
    // Debugging: log what ServiceConstructor actually is
    console.log(`🔍 ServiceConstructor type for ${serviceName}:`, typeof ServiceConstructor);
    console.log(`🔍 ServiceConstructor keys:`, Object.keys(ServiceConstructor || {}).slice(0, 10));
    
    // ServiceConstructor should be a function/class that we can instantiate
    if (typeof ServiceConstructor !== 'function') {
      throw new Error(`ServiceConstructor for ${serviceName} is not a constructor (type: ${typeof ServiceConstructor})`);
    }
    
    // Check if ServiceConstructor has a 'service' property (common in grpc-js)
    if (ServiceConstructor.service) {
      console.log(`🔍 Found .service property:`, Object.keys(ServiceConstructor.service).slice(0, 10));
    }
    
    // Create the client instance
    const service = new ServiceConstructor(
      `${this.octaneHost}:${this.octanePort}`,
      grpc.credentials.createInsecure()
    );
    
    // gRPC methods might not be enumerable, check proto directly
    console.log(`✅ Created ${serviceName} client instance`);
    
    this.services.set(serviceName, service);
    return service;
  }
  
  private resolveServicePath(descriptor: any, path: string): any {
    const parts = path.split('.');
    let current = descriptor;
    
    // Debug: log what we're searching for
    console.log(`🔍 Searching for path: ${path} in descriptor with keys:`, Object.keys(descriptor).slice(0, 20));
    
    for (const part of parts) {
      if (current && current[part]) {
        current = current[part];
        console.log(`  ✅ Found part '${part}', type: ${typeof current}, keys:`, Object.keys(current || {}).slice(0, 10));
      } else {
        console.log(`  ❌ Part '${part}' not found in current object with keys:`, Object.keys(current || {}).slice(0, 20));
        return null;
      }
    }
    
    return current;
  }
  
  async callMethod(
    serviceName: string,
    methodName: string,
    params: any = {},
    options: GrpcCallOptions = {}
  ): Promise<any> {
    console.log(`📤 gRPC call: ${serviceName}.${methodName}`, Object.keys(params).length > 0 ? `(${Object.keys(params).length} params)` : '');
    
    try {
      const service = this.getService(serviceName);
      
      // Check if method exists (might not be enumerable)
      const method = service[methodName];
      console.log(`🔍 Method ${methodName} type:`, typeof method);
      console.log(`🔍 Service prototype:`, Object.getPrototypeOf(service).constructor.name);
      
      if (!method || typeof method !== 'function') {
        // List all properties to debug
        const allProps = [];
        let obj = service;
        while (obj && obj !== Object.prototype) {
          allProps.push(...Object.getOwnPropertyNames(obj));
          obj = Object.getPrototypeOf(obj);
        }
        console.log(`🔍 All properties on service:`, allProps.filter(p => !p.startsWith('_')).slice(0, 20));
        throw new Error(`Method ${methodName} not found in service ${serviceName}`);
      }
      
      const request = Object.keys(params).length === 0 ? {} : params;
      console.log(`🔍 Request params:`, JSON.stringify(request, null, 2));
      const metadata = options.metadata || new grpc.Metadata();
      const deadline = Date.now() + (options.timeout || 30000);
      
      return new Promise((resolve, reject) => {
        method.call(service, request, metadata, { deadline }, 
          (error: grpc.ServiceError | null, response: any) => {
            if (error) {
              console.error(`❌ ${serviceName}.${methodName}: ${error.message}`, error.code);
              reject(error);
            } else {
              console.log(`✅ ${serviceName}.${methodName} success:`, JSON.stringify(response).slice(0, 200));
              resolve(response);
            }
          }
        );
      });
    } catch (error: any) {
      console.error(`❌ ${serviceName}.${methodName} error:`, error.message);
      throw error;
    }
  }
  
  close(): void {
    this.channel.close();
    this.services.clear();
    console.log('🔌 gRPC client closed');
  }
  
  async checkHealth(): Promise<boolean> {
    try {
      await this.callMethod('ApiProjectManager', 'getPing', {}, { timeout: 5000 });
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Register callback and start streaming OnNewImage events
   */
  async startCallbackStreaming(): Promise<void> {
    try {
      console.log('🎬 Starting callback streaming...');
      
      // Step 1: OPTIONAL - Register OnNewImage callback with Octane
      // Note: Python SDK example skips this step and callbacks still work via callbackChannel stream
      // Try registering, but continue even if it fails
      try {
        console.log('📝 Attempting to register OnNewImage callback (optional)...');
        const registerResponse = await this.callMethod('ApiRenderEngine', 'setOnNewImageCallback', {
          callback: {
            callbackSource: 'octaneWebR',
            callbackId: 1
          },
          userData: 0
        }, { timeout: 5000 });
        console.log('✅ Callback registered:', registerResponse);
      } catch (regError: any) {
        console.log('ℹ️  Callback registration skipped (not critical):', regError.message);
        console.log('   Python SDK example works without explicit registration - continuing...');
      }
      
      // Step 2: Start streaming from callback channel
      console.log('📡 Starting callback channel stream...');
      const streamService = this.getService('StreamCallbackService');
      
      if (!streamService || !streamService.callbackChannel) {
        throw new Error('StreamCallbackService.callbackChannel not found');
      }
      
      // Create empty request for callbackChannel (server-side streaming)
      const stream = streamService.callbackChannel({});
      
      stream.on('data', (response: any) => {
        try {
          // Debug: Log what we receive from the stream
          console.log('📥 [Stream] Received callback data:', {
            hasResponse: !!response,
            responseType: typeof response,
            keys: Object.keys(response || {}),
            hasNewImage: !!response.newImage,
            newImageKeys: response.newImage ? Object.keys(response.newImage) : [],
            hasRenderImages: !!response.render_images,
            hasRenderimages: !!response.renderimages,
            hasRenderFailure: !!response.renderFailure,
            hasNewStatistics: !!response.newStatistics,
            hasProjectManagerChanged: !!response.projectManagerChanged
          });
          
          // Check if callback contains image data (various possible locations)
          let renderImages = null;
          let imageSource = '';
          
          // Priority 1: Check if response has render_images at root level
          if (response.render_images && response.render_images.data && response.render_images.data.length > 0) {
            renderImages = response.render_images;
            imageSource = 'root level';
          }
          // Priority 2: Check if newImage callback has render_images
          else if (response.newImage?.render_images && response.newImage.render_images.data && response.newImage.render_images.data.length > 0) {
            renderImages = response.newImage.render_images;
            imageSource = 'newImage callback';
          }
          // Priority 3: Check alternative field names (renderimages lowercase)
          else if (response.renderimages && response.renderimages.data && response.renderimages.data.length > 0) {
            renderImages = response.renderimages;
            imageSource = 'root level (lowercase)';
          }
          
          // If we found image data in the callback, emit it directly
          if (renderImages) {
            const firstImage = renderImages.data[0];
            console.log(`✅ [Stream] Found render images in callback (${imageSource}):`, {
              count: renderImages.data.length,
              firstImageSize: firstImage?.size,
              firstImageType: firstImage?.type,
              firstImageBufferSize: firstImage?.buffer?.size,
              firstImageBufferDataType: typeof firstImage?.buffer?.data,
              firstImageBufferDataLength: firstImage?.buffer?.data?.length
            });
            
            this.emit('OnNewImage', {
              render_images: renderImages,
              callback_id: response.newImage?.callback_id || response.callback_id,
              user_data: response.newImage?.user_data || response.user_data
            });
          }
          // If no image data in callback, fall back to grabRenderResult()
          else if (response.newImage) {
            console.log('🖼️  OnNewImage callback received without image data - calling grabRenderResult()');
            
            this.callMethod('ApiRenderEngine', 'grabRenderResult', {})
              .then((grabResponse: any) => {
                // Check result field first (indicates if render data is available)
                if (!grabResponse) {
                  console.warn('⚠️  grabRenderResult returned null/undefined response');
                  return;
                }
                
                if (grabResponse.result === false) {
                  console.log('ℹ️  No render result available (result=false) - render may be initializing');
                  return;
                }
                
                // Handle both camelCase (renderImages) and lowercase (renderimages) field names
                const grabbedImages = grabResponse.renderImages || grabResponse.renderimages;
                
                if (grabbedImages && grabbedImages.data && grabbedImages.data.length > 0) {
                  const firstImage = grabbedImages.data[0];
                  console.log('✅ Got render images from grabRenderResult:', {
                    count: grabbedImages.data.length,
                    firstImageSize: firstImage?.size,
                    firstImageType: firstImage?.type,
                    firstImageBufferSize: firstImage?.buffer?.size,
                    firstImageBufferDataType: typeof firstImage?.buffer?.data,
                    firstImageBufferDataLength: firstImage?.buffer?.data?.length
                  });
                  
                  this.emit('OnNewImage', {
                    render_images: grabbedImages,
                    callback_id: response.newImage?.callback_id,
                    user_data: response.newImage?.user_data
                  });
                } else {
                  console.warn('⚠️  grabRenderResult returned 0 images (result=true but no data):', {
                    result: grabResponse.result,
                    hasRenderImages: !!grabResponse.renderImages,
                    hasRenderimages: !!grabResponse.renderimages,
                    renderImagesData: grabResponse.renderImages?.data || 'undefined',
                    dataLength: grabResponse.renderImages?.data?.length || 0,
                    responseKeys: Object.keys(grabResponse)
                  });
                }
              })
              .catch((error: any) => {
                console.error('❌ grabRenderResult failed:', error.message, error.code);
              });
          }
          // Handle OnStatisticsData callback
          else if (response.newStatistics) {
            console.log('📊 OnStatisticsData callback received:', JSON.stringify(response.newStatistics, null, 2));
            
            // Fetch full statistics data from Octane
            this.callMethod('ApiRenderEngine', 'getRenderStatistics', {})
              .then((statsResponse: any) => {
                if (statsResponse?.statistics) {
                  console.log('✅ Got render statistics (FULL RESPONSE):', JSON.stringify(statsResponse.statistics, null, 2));
                  
                  this.emit('OnNewStatistics', {
                    statistics: statsResponse.statistics,
                    user_data: response.newStatistics?.user_data,
                    timestamp: Date.now()
                  });
                } else {
                  console.warn('⚠️  getRenderStatistics returned no data');
                }
              })
              .catch((error: any) => {
                console.error('❌ getRenderStatistics failed:', error.message);
              });
          }
          // Handle OnRenderFailureData callback
          else if (response.renderFailure) {
            console.log('❌ OnRenderFailureData callback received');
            
            this.emit('OnRenderFailure', {
              user_data: response.renderFailure?.user_data,
              timestamp: Date.now()
            });
          }
          // Handle OnProjectManagerData callback
          else if (response.projectManagerChanged) {
            console.log('📁 OnProjectManagerData callback received');
            
            this.emit('OnProjectManagerChanged', {
              user_data: response.projectManagerChanged?.user_data,
              timestamp: Date.now()
            });
          }
          else {
            console.log('ℹ️  Callback received but no recognized data type');
          }
        } catch (error: any) {
          console.error('❌ Error processing callback data:', error.message);
        }
      });
      
      stream.on('end', () => {
        console.log('⚠️  Callback stream ended');
      });
      
      stream.on('error', (error: any) => {
        console.error('❌ Callback stream error:', error.message);
        // Try to reconnect after a delay
        setTimeout(() => {
          console.log('🔄 Attempting to reconnect callback stream...');
          this.startCallbackStreaming().catch(e => {
            console.error('❌ Reconnection failed:', e.message);
          });
        }, 5000);
      });
      
      console.log('✅ Callback streaming started');
    } catch (error: any) {
      console.error('❌ Failed to start callback streaming:', error.message);
      throw error;
    }
  }

  // ========== Scene & Device Info APIs ==========

  /**
   * Get geometry statistics for the current scene
   * Returns triangle counts, primitive counts, etc.
   */
  async getGeometryStatistics(): Promise<any> {
    try {
      const response = await this.callMethod(
        'ApiRenderEngineService',
        'getGeometryStatistics',
        {}
      );
      console.log('📊 Geometry statistics:', JSON.stringify(response.stats, null, 2));
      return response.stats || response;
    } catch (error: any) {
      console.error('❌ Failed to get geometry statistics:', error.message);
      throw error;
    }
  }

  /**
   * Get the number of available render devices
   */
  async getDeviceCount(): Promise<number> {
    try {
      const response = await this.callMethod(
        'ApiRenderEngineService',
        'getDeviceCount',
        {}
      );
      return response.result || 0;
    } catch (error: any) {
      console.error('❌ Failed to get device count:', error.message);
      return 0;
    }
  }

  /**
   * Get the name of a specific render device
   * @param index Device index (0-based)
   */
  async getDeviceName(index: number = 0): Promise<string> {
    try {
      const response = await this.callMethod(
        'ApiRenderEngineService',
        'getDeviceName',
        { index }
      );
      return response.result || 'Unknown GPU';
    } catch (error: any) {
      console.error(`❌ Failed to get device name for index ${index}:`, error.message);
      return 'Unknown GPU';
    }
  }

  /**
   * Check if a device uses hardware ray tracing
   * @param index Device index (0-based)
   */
  async deviceUsesHardwareRayTracing(index: number = 0): Promise<boolean> {
    try {
      const response = await this.callMethod(
        'ApiRenderEngineService',
        'deviceUsesHardwareRayTracing',
        { index }
      );
      return response.result || false;
    } catch (error: any) {
      console.error(`❌ Failed to check hardware RT for device ${index}:`, error.message);
      return false;
    }
  }

  /**
   * Get memory usage for a specific device
   * @param deviceIx Device index (0-based)
   */
  async getMemoryUsage(deviceIx: number = 0): Promise<any> {
    try {
      const response = await this.callMethod(
        'ApiRenderEngineService',
        'getMemoryUsage',
        { deviceIx }
      );
      console.log(`💾 Memory usage for device ${deviceIx}:`, JSON.stringify(response.memUsage, null, 2));
      return response.memUsage || response;
    } catch (error: any) {
      console.error(`❌ Failed to get memory usage for device ${deviceIx}:`, error.message);
      throw error;
    }
  }

  /**
   * Get Octane version name/string
   */
  async getOctaneVersion(): Promise<string> {
    try {
      const response = await this.callMethod(
        'ApiInfoService',
        'octaneName',
        {}
      );
      return response.result || 'Unknown Version';
    } catch (error: any) {
      console.error('❌ Failed to get Octane version:', error.message);
      return 'Unknown Version';
    }
  }

  /**
   * Get complete system info for render stats bar (right side)
   * Combines geometry stats, device info, memory, and version
   */
  async getSystemInfo(): Promise<{
    primitiveCount: number;
    meshCount: number;
    gpuName: string;
    hasHardwareRT: boolean;
    totalMemoryGB: number;
    octaneVersion: string;
  }> {
    try {
      // Fetch all data in parallel
      const [geometryStats, gpuName, hasRT, memUsage, version] = await Promise.all([
        this.getGeometryStatistics(),
        this.getDeviceName(0),
        this.deviceUsesHardwareRayTracing(0),
        this.getMemoryUsage(0),
        this.getOctaneVersion()
      ]);

      // Calculate total primitive count
      const primitiveCount = (
        (geometryStats.triCount || 0) +
        (geometryStats.dispTriCount || 0) +
        (geometryStats.hairSegCount || 0) +
        (geometryStats.sphereCount || 0) +
        (geometryStats.emitPriCount || 0)
      );

      // Convert memory from bytes to GB
      const totalMemoryGB = memUsage.totalDeviceMemory
        ? parseFloat((memUsage.totalDeviceMemory / (1024 * 1024 * 1024)).toFixed(1))
        : 0;

      return {
        primitiveCount,
        meshCount: 1, // TODO: Get actual mesh count from scene graph
        gpuName,
        hasHardwareRT: hasRT,
        totalMemoryGB,
        octaneVersion: version
      };
    } catch (error: any) {
      console.error('❌ Failed to get system info:', error.message);
      // Return fallback values
      return {
        primitiveCount: 0,
        meshCount: 1,
        gpuName: 'Unknown GPU',
        hasHardwareRT: false,
        totalMemoryGB: 0,
        octaneVersion: 'Unknown'
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
