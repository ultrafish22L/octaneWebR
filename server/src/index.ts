import express from 'express';
import cors from 'cors';
import { OctaneGrpcClient, getGrpcClient } from './grpc/client';
import { setupCallbackStreaming } from './api/websocket';
import { CallbackManager, getCallbackManager } from './services/callbackManager';

const app = express();
const PORT = parseInt(process.env.SERVER_PORT || '45769');

// Middleware
app.use(cors({ 
  origin: '*', 
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

const grpcClient = getGrpcClient();
const callbackManager = getCallbackManager(grpcClient);

// Initialize gRPC client
grpcClient.initialize().then(() => {
  console.log('✅ gRPC client initialized successfully');
}).catch(error => {
  console.error('❌ Failed to initialize gRPC client:', error);
  process.exit(1);
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const isHealthy = await grpcClient.checkHealth();
    res.json({
      status: isHealthy ? 'ok' : 'unhealthy',
      octane: isHealthy ? 'connected' : 'disconnected',
      server: 'running',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      octane: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// System info endpoint - for render stats bar (primitives, GPU, memory, version)
app.get('/api/system/info', async (req, res) => {
  try {
    const systemInfo = await grpcClient.getSystemInfo();
    res.json(systemInfo);
  } catch (error: any) {
    console.error('❌ Failed to get system info:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to retrieve system info',
      code: error.code || 'UNKNOWN'
    });
  }
});

// Geometry statistics endpoint
app.get('/api/scene/geometry', async (req, res) => {
  try {
    const geometryStats = await grpcClient.getGeometryStatistics();
    res.json(geometryStats);
  } catch (error: any) {
    console.error('❌ Failed to get geometry statistics:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to retrieve geometry statistics',
      code: error.code || 'UNKNOWN'
    });
  }
});

// Device info endpoint
app.get('/api/device/info', async (req, res) => {
  try {
    const deviceIndex = parseInt(req.query.index as string || '0');
    const [name, hasRT, memory] = await Promise.all([
      grpcClient.getDeviceName(deviceIndex),
      grpcClient.deviceUsesHardwareRayTracing(deviceIndex),
      grpcClient.getMemoryUsage(deviceIndex)
    ]);
    
    res.json({
      index: deviceIndex,
      name,
      hasHardwareRT: hasRT,
      memory: {
        used: memory.usedDeviceMemory,
        free: memory.freeDeviceMemory,
        total: memory.totalDeviceMemory,
        totalGB: parseFloat((memory.totalDeviceMemory / (1024 * 1024 * 1024)).toFixed(1))
      }
    });
  } catch (error: any) {
    console.error('❌ Failed to get device info:', error.message);
    res.status(500).json({
      error: error.message || 'Failed to retrieve device info',
      code: error.code || 'UNKNOWN'
    });
  }
});

// Generic gRPC endpoint (matches octaneWeb pattern)
// POST /api/grpc/:service/:method
app.post('/api/grpc/:service/:method', async (req, res) => {
  const { service, method } = req.params;
  let params = req.body || {};
  
  // ========== Alpha 5 API Compatibility Transformations ==========
  // Alpha 5 proto files use different parameter names than Beta 2
  // These transformations match the behavior from the old vite-plugin-octane-grpc.ts
  
  // Transform objectPtr → item_ref for ApiItem methods
  // Alpha 5's getValueByIDRequest expects 'item_ref' field, not 'objectPtr'
  if (params.objectPtr && (
    method === 'getByAttrID' || 
    method === 'setByAttrID' || 
    method === 'getValue'
  )) {
    console.log(`🔄 Alpha 5 transform: objectPtr → item_ref for ${service}.${method}`);
    params = {
      item_ref: params.objectPtr,
      ...params
    };
    delete params.objectPtr;
  }
  
  // Transform objectPtr → nodePinInfoRef for ApiNodePinInfoEx
  if (params.objectPtr && service === 'ApiNodePinInfoEx' && method === 'getApiNodePinInfo') {
    console.log(`🔄 Alpha 5 transform: objectPtr → nodePinInfoRef for ${service}.${method}`);
    params = {
      nodePinInfoRef: params.objectPtr,
      ...params
    };
    delete params.objectPtr;
  }
  
  try {
    const response = await grpcClient.callMethod(service, method, params);
    
    // Convert response to plain object if needed
    let jsonResponse = response;
    if (response && typeof response.toObject === 'function') {
      jsonResponse = response.toObject();
    } else if (response && typeof response === 'object') {
      // Already a plain object
      jsonResponse = response;
    }
    
    res.json(jsonResponse);
  } catch (error: any) {
    console.error(`❌ API error: ${service}.${method}:`, error.message);
    res.status(500).json({
      error: error.message || 'gRPC call failed',
      service,
      method,
      code: error.code || 'UNKNOWN'
    });
  }
});

// Start server
const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║           OctaneWebR Server Started               ║
╠═══════════════════════════════════════════════════╣
║  HTTP Server:     http://localhost:${PORT}        ║
║  WebSocket:       ws://localhost:${PORT}/api/callbacks  ║
║  Octane gRPC:     ${grpcClient['octaneHost']}:${grpcClient['octanePort']}        ║
╚═══════════════════════════════════════════════════╝
  `);
  
  // Setup WebSocket callback streaming
  setupCallbackStreaming(server, grpcClient, callbackManager);
  
  // Register for Octane callbacks
  try {
    await callbackManager.registerCallbacks();
    console.log('✅ Octane callback streaming initialized');
  } catch (error: any) {
    console.error('⚠️  Failed to register callbacks:', error.message);
    console.error('   (Callbacks will not work until Octane is running and LiveLink is enabled)');
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('⚠️  SIGTERM received, shutting down gracefully...');
  await callbackManager.unregisterCallbacks();
  server.close(() => {
    grpcClient.close();
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('\n⚠️  SIGINT received, shutting down gracefully...');
  await callbackManager.unregisterCallbacks();
  server.close(() => {
    grpcClient.close();
    console.log('✅ Server closed');
    process.exit(0);
  });
});
