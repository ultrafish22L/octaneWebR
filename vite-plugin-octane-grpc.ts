/**
 * Vite Plugin for Octane gRPC Integration
 * 
 * This plugin integrates gRPC functionality directly into the Vite dev server,
 * eliminating the need for a separate Node.js Express server.
 * 
 * Features:
 * - Direct gRPC calls to Octane LiveLink (127.0.0.1:51022)
 * - WebSocket streaming for OnNewImage callbacks
 * - Health check endpoint
 * - All running within the Vite dev server
 */

import { Plugin, ViteDevServer } from 'vite';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { WebSocketServer, WebSocket } from 'ws';
import * as path from 'path';
import * as fs from 'fs';
import { IncomingMessage } from 'http';

interface GrpcCallOptions {
  timeout?: number;
  metadata?: grpc.Metadata;
}

class OctaneGrpcClient {
  private channel: grpc.Channel;
  private services: Map<string, any> = new Map();
  private packageDefinition: protoLoader.PackageDefinition | null = null;
  private protoDescriptor: grpc.GrpcObject | null = null;
  private callbacks: Set<(data: any) => void> = new Set();
  private statisticsCallbacks: Set<(data: any) => void> = new Set();
  private callbackId: number = 0;
  private isCallbackRegistered: boolean = false;
  private pollingInterval: NodeJS.Timeout | null = null;
  private callbackStream: any = null;
  private streamActive: boolean = false;
  
  constructor(
    private octaneHost: string = process.env.OCTANE_HOST || OctaneGrpcClient.detectDefaultHost(),
    private octanePort: number = parseInt(process.env.OCTANE_PORT || '51022')
  ) {
    const address = `${this.octaneHost}:${this.octanePort}`;
    this.channel = new grpc.Channel(
      address,
      grpc.credentials.createInsecure(),
      {}
    );
    
    const isSandbox = this.octaneHost === 'host.docker.internal';
    console.log(`📡 Vite gRPC Plugin: Connected to Octane at ${address}`);
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
    return isSandbox ? 'host.docker.internal' : '127.0.0.1';
  }

  async initialize(): Promise<void> {
    const PROTO_PATH = path.resolve(__dirname, './server/proto');
    
    // Check if proto directory exists
    if (!fs.existsSync(PROTO_PATH)) {
      console.log('⚠️  Proto directory not found:', PROTO_PATH);
      return;
    }
    
    console.log(`📦 Proto files ready for lazy loading from:`, PROTO_PATH);
    console.log('✅ Proto definitions will be loaded on-demand per service');
    
    // Note: We use lazy loading to avoid duplicate name conflicts
    // Each service loads its own proto file when first accessed
  }
  
  private loadServiceProto(serviceName: string): any {
    const PROTO_PATH = path.resolve(__dirname, './server/proto');
    
    const serviceToProtoMap: Record<string, string> = {
      'ApiProjectManager': 'apiprojectmanager.proto',
      'ApiItemService': 'apinodesystem_3.proto',
      'ApiItem': 'apinodesystem_3.proto',
      'ApiItemGetter': 'apinodesystem_3.proto',
      'ApiItemSetter': 'apinodesystem_3.proto',
      'ApiNodeGraphService': 'apinodesystem_6.proto',
      'ApiNodeGraph': 'apinodesystem_6.proto',
      'ApiItemArrayService': 'apinodesystem_1.proto',
      'ApiItemArray': 'apinodesystem_1.proto',
      'ApiNodeService': 'apinodesystem_7.proto',
      'ApiNode': 'apinodesystem_7.proto',
      'ApiNodeArray': 'apinodesystem_5.proto',
      'ApiNodePinInfoEx': 'apinodepininfohelper.proto',
      'ApiRenderEngine': 'apirender.proto',
      'ApiSceneOutliner': 'apisceneoutliner.proto',
      'StreamCallbackService': 'callbackstream.proto',
      'CallbackHandler': 'callback.proto',
    };
    
    const protoFileName = serviceToProtoMap[serviceName] || (serviceName.toLowerCase() + '.proto');
    const protoFilePath = path.join(PROTO_PATH, protoFileName);
    
    if (!fs.existsSync(protoFilePath)) {
      return null;
    }
    
    try {
      // Load proto file - proto-loader will automatically resolve imports via includeDirs
      const packageDefinition = protoLoader.loadSync(protoFilePath, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
        includeDirs: [PROTO_PATH]  // This makes proto-loader auto-resolve imports
      });
      
      const loadedProto = grpc.loadPackageDefinition(packageDefinition);
      
      return loadedProto;
    } catch (error: any) {
      console.log(`⚠️  Could not load proto for ${serviceName}:`, error.message);
      return null;
    }
  }
  
  private getService(serviceName: string): any {
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
    const patterns = [
      `octaneapi.${serviceName}Service`,
      `octaneapi.${serviceName}`,
      `livelinkapi.${serviceName}Service`,
      `livelinkapi.${serviceName}`,
      `${serviceName}Service`,
      serviceName
    ];
    
    for (const pattern of patterns) {
      ServiceConstructor = this.resolveServicePath(descriptor, pattern);
      if (ServiceConstructor) {
        break;
      }
    }
    
    if (!ServiceConstructor && descriptor === this.protoDescriptor) {
      const serviceDescriptor = this.loadServiceProto(serviceName);
      if (serviceDescriptor) {
        for (const pattern of patterns) {
          ServiceConstructor = this.resolveServicePath(serviceDescriptor, pattern);
          if (ServiceConstructor) {
            break;
          }
        }
      }
    }
    
    if (!ServiceConstructor || typeof ServiceConstructor !== 'function') {
      throw new Error(`Service ${serviceName} not found in proto definitions`);
    }
    
    const service = new ServiceConstructor(
      `${this.octaneHost}:${this.octanePort}`,
      grpc.credentials.createInsecure()
    );
    
    this.services.set(serviceName, service);
    return service;
  }
  
  private resolveServicePath(descriptor: any, path: string): any {
    const parts = path.split('.');
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
  
  async callMethod(
    serviceName: string,
    methodName: string,
    params: any = {},
    options: GrpcCallOptions = {}
  ): Promise<any> {
    try {
      const service = this.getService(serviceName);
      const method = service[methodName];
      
      if (!method || typeof method !== 'function') {
        throw new Error(`Method ${methodName} not found in service ${serviceName}`);
      }
      
      const request = Object.keys(params).length === 0 ? {} : params;
      const metadata = options.metadata || new grpc.Metadata();
      const deadline = Date.now() + (options.timeout || 30000);
      
      return new Promise((resolve, reject) => {
        method.call(service, request, metadata, { deadline }, 
          (error: grpc.ServiceError | null, response: any) => {
            if (error) {
              reject(error);
            } else {
              resolve(response);
            }
          }
        );
      });
    } catch (error: any) {
      console.error(`❌ ${serviceName}.${methodName}:`, error.message);
      throw error;
    }
  }
  
  async checkHealth(): Promise<boolean> {
    try {
      // Use rootNodeGraph as a health check - it's a valid lightweight method
      await this.callMethod('ApiProjectManager', 'rootNodeGraph', {}, { timeout: 5000 });
      return true;
    } catch (error) {
      return false;
    }
  }

  async registerOctaneCallbacks(): Promise<void> {
    if (this.isCallbackRegistered) {
      console.log('⚠️  Callbacks already registered');
      return;
    }

    try {
      this.callbackId = Math.floor(Math.random() * 1000000);
      console.log(`📡 Registering callbacks (OnNewImage, OnNewStatistics) with ID: ${this.callbackId}`);

      // Register OnNewImage callback
      await this.callMethod('ApiRenderEngine', 'setOnNewImageCallback', {
        callback: {
          callbackSource: 'grpc',
          callbackId: this.callbackId
        },
        userData: 0
      });

      // Register OnNewStatistics callback
      await this.callMethod('ApiRenderEngine', 'setOnNewStatisticsCallback', {
        callback: {
          callbackSource: 'grpc',
          callbackId: this.callbackId
        },
        userData: 0
      });

      console.log(`✅ Callbacks registered with Octane`);
      this.isCallbackRegistered = true;
      
      // Start streaming callbacks
      this.startCallbackStreaming();
    } catch (error: any) {
      console.error('❌ Failed to register callbacks:', error.message);
      console.error('   (Callbacks will not work until Octane is running and LiveLink is enabled)');
    }
  }

  /**
   * Start streaming callbacks from Octane via StreamCallbackService
   * This is more efficient than polling - Octane pushes updates in real-time
   */
  private startCallbackStreaming(): void {
    if (this.callbackStream || this.streamActive) {
      console.log('⚠️  Callback stream already active');
      return;
    }

    try {
      console.log('📡 Starting callback streaming...');
      this.streamActive = true;

      // Get StreamCallbackService instance (getService returns cached instance, not constructor)
      const streamService = this.getService('StreamCallbackService');
      
      console.log('📡 StreamCallbackService instance obtained');

      // Start streaming - callbackChannel returns a stream of StreamCallbackRequest
      // Pass empty google.protobuf.Empty message  
      this.callbackStream = streamService.callbackChannel({});
      
      console.log('📡 Callback stream opened');

      this.callbackStream.on('data', async (callbackRequest: any) => {
        try {
          // DEBUG: Log the entire callback request to see what we're actually receiving
          console.log('📡 Stream data received:', JSON.stringify(callbackRequest, null, 2));
          console.log('📡 Callback request keys:', Object.keys(callbackRequest));
          
          // StreamCallbackRequest has oneof payload: newImage, renderFailure, newStatistics, projectManagerChanged
          if (callbackRequest.newImage) {
            console.log('🖼️  OnNewImage callback received');
            console.log('   user_data:', callbackRequest.newImage.user_data);
            
            // The stream notification doesn't contain image data - we need to call grabRenderResult
            console.log('📡 Calling grabRenderResult to fetch render images...');
            try {
              const renderResult = await this.callMethod('ApiRenderEngine', 'grabRenderResult', {});
              
              console.log('📡 grabRenderResult response:', {
                hasResult: !!renderResult,
                resultFlag: renderResult?.result,
                hasRenderImages: !!renderResult?.renderImages,
                imageCount: renderResult?.renderImages?.length || 0
              });
              
              if (renderResult && renderResult.result && renderResult.renderImages && renderResult.renderImages.length > 0) {
                console.log('✅ Got render result with', renderResult.renderImages.length, 'images');
                
                // Build the image data to send to frontend
                const imageData = {
                  callback_source: 'grpc',
                  callback_id: this.callbackId,
                  user_data: callbackRequest.newImage.user_data,
                  render_images: renderResult.renderImages
                };
                
                this.notifyCallbacks(imageData);
              } else {
                console.log('⚠️  grabRenderResult returned no images (result flag:', renderResult?.result, ')');
              }
            } catch (error: any) {
              console.error('❌ Failed to grab render result:', error.message);
            }
          } else if (callbackRequest.renderFailure) {
            console.log('❌ Render failure callback received');
          } else if (callbackRequest.newStatistics) {
            console.log('📊 OnNewStatistics callback received');
            // OnNewStatisticsRequest contains render statistics
            const statsData = {
              callback_source: 'grpc',
              callback_id: this.callbackId,
              user_data: callbackRequest.newStatistics.user_data,
              statistics: callbackRequest.newStatistics.statistics
            };
            this.notifyStatisticsCallbacks(statsData);
          } else if (callbackRequest.projectManagerChanged) {
            console.log('🔄 Project manager changed callback received');
          } else {
            console.log('⚠️  Unknown callback type received');
          }
        } catch (error: any) {
          console.error('❌ Error processing callback data:', error.message);
          console.error('   Stack:', error.stack);
        }
      });

      this.callbackStream.on('error', (error: any) => {
        console.error('❌ Callback stream error:', error.message);
        this.streamActive = false;
        this.callbackStream = null;
        
        // Attempt to reconnect after 5 seconds
        if (this.isCallbackRegistered) {
          console.log('🔄 Reconnecting callback stream in 5 seconds...');
          setTimeout(() => {
            if (this.isCallbackRegistered) {
              this.startCallbackStreaming();
            }
          }, 5000);
        }
      });

      this.callbackStream.on('end', () => {
        console.log('🔌 Callback stream ended');
        this.streamActive = false;
        this.callbackStream = null;
      });

      console.log('✅ Callback streaming active');
    } catch (error: any) {
      console.error('❌ Failed to start callback streaming:', error.message);
      this.streamActive = false;
      this.callbackStream = null;
    }
  }
  async unregisterOctaneCallbacks(): Promise<void> {
    if (!this.isCallbackRegistered) {
      return;
    }

    try {
      // Stop streaming
      if (this.callbackStream) {
        this.streamActive = false;
        this.callbackStream.cancel();
        this.callbackStream = null;
        console.log('🔌 Callback stream closed');
      }

      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
        this.pollingInterval = null;
      }

      await this.callMethod('ApiRenderEngine', 'setOnNewImageCallback', {
        callback: null,
        userData: 0
      });

      console.log('✅ Callbacks unregistered');
      this.isCallbackRegistered = false;
      this.callbackId = 0;
    } catch (error: any) {
      console.error('❌ Failed to unregister callback:', error.message);
    }
  }

  registerCallback(callback: (data: any) => void): void {
    this.callbacks.add(callback);
  }

  unregisterCallback(callback: (data: any) => void): void {
    this.callbacks.delete(callback);
  }

  private notifyCallbacks(data: any): void {
    this.callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('❌ Error in callback handler:', error);
      }
    });
  }

  private notifyStatisticsCallbacks(data: any): void {
    this.statisticsCallbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('❌ Error in statistics callback handler:', error);
      }
    });
  }

  addStatisticsCallback(callback: (data: any) => void): void {
    this.statisticsCallbacks.add(callback);
  }

  removeStatisticsCallback(callback: (data: any) => void): void {
    this.statisticsCallbacks.delete(callback);
  }

  close(): void {
    this.channel.close();
    this.services.clear();
  }
}

export function octaneGrpcPlugin(): Plugin {
  let grpcClient: OctaneGrpcClient | null = null;
  let wss: WebSocketServer | null = null;

  return {
    name: 'vite-plugin-octane-grpc',
    
    async configureServer(server: ViteDevServer) {
      // Delete old log file at startup (before logging is initialized)
      const logFilePath = '/tmp/octaneWebR_client.log';
      try {
        if (fs.existsSync(logFilePath)) {
          fs.unlinkSync(logFilePath);
          console.log('🗑️  Deleted old client log file');
        }
      } catch (error: any) {
        console.warn('⚠️  Could not delete old log file:', error.message);
      }
      
      // Initialize gRPC client
      grpcClient = new OctaneGrpcClient();
      await grpcClient.initialize();
      
      // Register Octane callbacks
      try {
        await grpcClient.registerOctaneCallbacks();
      } catch (error: any) {
        console.error('⚠️  Initial callback registration failed:', error.message);
      }
      
      // Setup WebSocket server for callbacks
      wss = new WebSocketServer({ noServer: true });
      
      wss.on('connection', (ws: WebSocket) => {
        console.log('🔌 WebSocket client connected');
        
        const callbackHandler = (data: any) => {
          try {
            ws.send(JSON.stringify({ type: 'newImage', data }));
          } catch (error) {
            console.error('❌ Error sending WebSocket message:', error);
          }
        };
        
        const statisticsHandler = (data: any) => {
          try {
            ws.send(JSON.stringify({ type: 'newStatistics', data }));
          } catch (error) {
            console.error('❌ Error sending statistics WebSocket message:', error);
          }
        };
        
        grpcClient?.registerCallback(callbackHandler);
        grpcClient?.addStatisticsCallback(statisticsHandler);
        
        ws.on('close', () => {
          console.log('🔌 WebSocket client disconnected');
          grpcClient?.unregisterCallback(callbackHandler);
          grpcClient?.removeStatisticsCallback(statisticsHandler);
        });
        
        ws.on('message', (message: string) => {
          try {
            const data = JSON.parse(message.toString());
            if (data.type === 'subscribe') {
              console.log('📡 Client subscribed to callbacks');
            }
          } catch (error) {
            console.error('❌ Error parsing WebSocket message:', error);
          }
        });
      });
      
      // Handle WebSocket upgrade
      server.httpServer?.on('upgrade', (request: IncomingMessage, socket, head) => {
        const url = request.url;
        if (url === '/api/callbacks') {
          wss?.handleUpgrade(request, socket, head, (ws) => {
            wss?.emit('connection', ws, request);
          });
        }
      });
      
      // Add API endpoints
      server.middlewares.use((req, res, next) => {
        const url = req.url;
        
        // Health check endpoint
        if (url === '/api/health') {
          (async () => {
            try {
              const isHealthy = await grpcClient?.checkHealth();
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify({
                status: isHealthy ? 'ok' : 'unhealthy',
                octane: isHealthy ? 'connected' : 'disconnected',
                server: 'vite',
                timestamp: new Date().toISOString()
              }));
            } catch (error: any) {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(JSON.stringify({
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString()
              }));
            }
          })();
          return;
        }
        
        // Client logging endpoint
        if (url === '/api/log' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const logData = JSON.parse(body);
              const timestamp = new Date().toISOString();
              const logLine = `[${timestamp}] [${logData.level.toUpperCase()}] ${logData.message}\n`;
              
              // Append to log file
              fs.appendFileSync('/tmp/octaneWebR_client.log', logLine);
              
              // Also log to console with appropriate emoji based on level
              const logLevel = logData.level.toLowerCase();
              if (logLevel === 'error') {
                console.error('🔴 CLIENT:', logData.message);
              } else if (logLevel === 'warn') {
                console.warn('🟡 CLIENT:', logData.message);
              } else if (logLevel === 'debug') {
                console.log('🔍 CLIENT:', logData.message);
              } else if (logLevel === 'info') {
                console.info('ℹ️  CLIENT:', logData.message);
              } else {
                console.log('🟢 CLIENT:', logData.message);
              }
              
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify({ success: true }));
            } catch (error: any) {
              console.error('❌ Failed to write client log:', error.message);
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: error.message }));
            }
          });
          return;
        }
      
        // gRPC proxy endpoint
        const grpcMatch = url?.match(/^\/api\/grpc\/([^\/]+)\/([^\/\?]+)/);
        if (grpcMatch && req.method === 'POST') {
          const [, service, method] = grpcMatch;
          
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          
          req.on('end', async () => {
            try {
              let params = body ? JSON.parse(body) : {};
              
              // Parameter remapping (to match Python proxy behavior)
              // Some proto messages use different field names than what the client sends
              if (params.objectPtr) {
                if (service === 'ApiNodePinInfoEx' && method === 'getApiNodePinInfo') {
                  // GetNodePinInfoRequest uses nodePinInfoRef instead of objectPtr
                  params = { nodePinInfoRef: params.objectPtr };
                } else if (method === 'getValueByAttrID' || method === 'setValueByAttrID' || method === 'getValue') {
                  // ApiItem methods use item_ref instead of objectPtr
                  params = { item_ref: params.objectPtr, ...params };
                  delete params.objectPtr;
                } else if (method === 'getPinValueByIx' || method === 'getPinValueByPinID' || method === 'getPinValueByName' ||
                           method === 'setPinValueByIx' || method === 'setPinValueByPinID' || method === 'setPinValueByName') {
                  // getPinValueByX and setPinValueByX methods use item_ref instead of objectPtr (apinodesystem_7.proto)
                  params = { item_ref: params.objectPtr, ...params };
                  delete params.objectPtr;
                }
              }
              
              // Verbose API logging
              console.log(`📤 ${service}.${method}`, JSON.stringify(params).substring(0, 100));
              const response = await grpcClient?.callMethod(service, method, params);
              console.log(`✅ ${service}.${method} → ${JSON.stringify(response).substring(0, 100)}`);
              
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify(response || {}));
            } catch (error: any) {
              console.error(`❌ API error: ${service}.${method}:`, error.message);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(JSON.stringify({
                error: error.message || 'gRPC call failed',
                service,
                method,
                code: error.code || 'UNKNOWN'
              }));
            }
          });
          
          return;
        }
        
        next();
      });
      
      console.log('✅ Octane gRPC Plugin configured');
      console.log('   • HTTP API: /api/grpc/:service/:method');
      console.log('   • WebSocket: /api/callbacks');
      console.log('   • Health: /api/health');
    },
    
    async closeBundle() {
      if (grpcClient) {
        try {
          await grpcClient.unregisterOctaneCallbacks();
        } catch (error) {
          console.error('❌ Error unregistering callbacks:', error);
        }
        grpcClient.close();
      }
      if (wss) {
        wss.close();
      }
    }
  };
}
