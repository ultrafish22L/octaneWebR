import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { OctaneGrpcClient } from '../grpc/client';
import { CallbackManager } from '../services/callbackManager';

export function setupCallbackStreaming(
  server: Server,
  grpcClient: OctaneGrpcClient,
  callbackManager: CallbackManager
): void {
  const wss = new WebSocketServer({ 
    server, 
    path: '/api/callbacks' 
  });
  
  console.log('📡 WebSocket server initialized at /api/callbacks');
  
  wss.on('connection', (ws: WebSocket) => {
    console.log('🔌 Callback client connected');
    
    // Forward OnNewImage events from CallbackManager to WebSocket
    const forwardNewImage = (data: any) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          // High-frequency logging commented out to reduce console spam during rendering
          // console.log('📡 [WebSocket] Forwarding OnNewImage to client');
          ws.send(JSON.stringify({
            type: 'newImage',
            data,
            timestamp: Date.now()
          }));
        } catch (error: any) {
          console.error('❌ Error forwarding OnNewImage:', error.message);
        }
      }
    };

    // Forward OnNewStatistics events from CallbackManager to WebSocket
    const forwardNewStatistics = (data: any) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          // High-frequency logging commented out to reduce console spam during rendering
          // console.log('📊 [WebSocket] Forwarding OnNewStatistics to client (FULL DATA):', JSON.stringify(data, null, 2));
          ws.send(JSON.stringify({
            type: 'newStatistics',
            data,
            timestamp: Date.now()
          }));
        } catch (error: any) {
          console.error('❌ Error forwarding OnNewStatistics:', error.message);
        }
      }
    };

    // Forward OnRenderFailure events from CallbackManager to WebSocket
    const forwardRenderFailure = (data: any) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          console.log('❌ [WebSocket] Forwarding OnRenderFailure to client');
          ws.send(JSON.stringify({
            type: 'renderFailure',
            data,
            timestamp: Date.now()
          }));
        } catch (error: any) {
          console.error('❌ Error forwarding OnRenderFailure:', error.message);
        }
      }
    };

    // Forward OnProjectManagerChanged events from CallbackManager to WebSocket
    const forwardProjectManagerChanged = (data: any) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          console.log('📁 [WebSocket] Forwarding OnProjectManagerChanged to client');
          ws.send(JSON.stringify({
            type: 'projectManagerChanged',
            data,
            timestamp: Date.now()
          }));
        } catch (error: any) {
          console.error('❌ Error forwarding OnProjectManagerChanged:', error.message);
        }
      }
    };
    
    // Listen for all callback types from CallbackManager
    callbackManager.on('OnNewImage', forwardNewImage);
    callbackManager.on('OnNewStatistics', forwardNewStatistics);
    callbackManager.on('OnRenderFailure', forwardRenderFailure);
    callbackManager.on('OnProjectManagerChanged', forwardProjectManagerChanged);
    
    // Handle messages from client
    ws.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        } else if (data.type === 'subscribe') {
          // Handle subscription requests if needed
          console.log('📥 Client subscribed to callbacks');
        }
      } catch (error: any) {
        console.error('❌ Error handling WebSocket message:', error.message);
      }
    });
    
    ws.on('close', () => {
      console.log('🔌 Callback client disconnected');
      callbackManager.off('OnNewImage', forwardNewImage);
      callbackManager.off('OnNewStatistics', forwardNewStatistics);
      callbackManager.off('OnRenderFailure', forwardRenderFailure);
      callbackManager.off('OnProjectManagerChanged', forwardProjectManagerChanged);
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
    });
  });
  
  console.log('✅ WebSocket callback streaming ready');
}
