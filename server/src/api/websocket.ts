import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { IncomingMessage } from 'http';
import { OctaneGrpcClient } from '../grpc/client';
import { CallbackManager } from '../services/callbackManager';

const RED = '\x1b[31m';
const RESET = '\x1b[0m';

// Dev mode: only accept localhost connections
function isLocalOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin || '';
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

export function setupCallbackStreaming(
  server: Server,
  grpcClient: OctaneGrpcClient,
  callbackManager: CallbackManager
): WebSocketServer {
  const wss = new WebSocketServer({
    server,
    path: '/api/callbacks',
    verifyClient: ({ req }: { req: IncomingMessage }) => isLocalOrigin(req),
  });

  console.log('WebSocket server initialized at /api/callbacks');

  // 10 MB backpressure limit (keep in sync with vite-plugin-octane-grpc.ts)
  const MAX_WS_BUFFER = 10 * 1024 * 1024;

  wss.on('connection', (ws: WebSocket) => {
    console.log('Callback client connected');

    const forwardNewImage = (data: any) => {
      if (ws.readyState === WebSocket.OPEN) {
        if (ws.bufferedAmount > MAX_WS_BUFFER) return; // backpressure: drop frame
        try {
          ws.send(JSON.stringify({ type: 'newImage', data, timestamp: Date.now() }));
        } catch (error: any) {
          console.error(`${RED}Error forwarding OnNewImage: ${error.message}${RESET}`);
        }
      }
    };

    const forwardNewStatistics = (data: any) => {
      if (ws.readyState === WebSocket.OPEN) {
        if (ws.bufferedAmount > MAX_WS_BUFFER) return;
        try {
          ws.send(JSON.stringify({ type: 'newStatistics', data, timestamp: Date.now() }));
        } catch (error: any) {
          console.error(`${RED}Error forwarding OnNewStatistics: ${error.message}${RESET}`);
        }
      }
    };

    const forwardRenderFailure = (data: any) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          console.log('Forwarding OnRenderFailure to client');
          ws.send(JSON.stringify({ type: 'renderFailure', data, timestamp: Date.now() }));
        } catch (error: any) {
          console.error(`${RED}Error forwarding OnRenderFailure: ${error.message}${RESET}`);
        }
      }
    };

    const forwardProjectManagerChanged = (data: any) => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          console.log('Forwarding OnProjectManagerChanged to client');
          ws.send(JSON.stringify({ type: 'projectManagerChanged', data, timestamp: Date.now() }));
        } catch (error: any) {
          console.error(`${RED}Error forwarding OnProjectManagerChanged: ${error.message}${RESET}`);
        }
      }
    };

    callbackManager.on('OnNewImage', forwardNewImage);
    callbackManager.on('OnNewStatistics', forwardNewStatistics);
    callbackManager.on('OnRenderFailure', forwardRenderFailure);
    callbackManager.on('OnProjectManagerChanged', forwardProjectManagerChanged);

    ws.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      } catch (error: any) {
        console.error(`${RED}Error handling WebSocket message: ${error.message}${RESET}`);
      }
    });

    ws.on('close', () => {
      console.log('Callback client disconnected');
      callbackManager.off('OnNewImage', forwardNewImage);
      callbackManager.off('OnNewStatistics', forwardNewStatistics);
      callbackManager.off('OnRenderFailure', forwardRenderFailure);
      callbackManager.off('OnProjectManagerChanged', forwardProjectManagerChanged);
    });

    ws.on('error', error => {
      console.error(`${RED}WebSocket error: ${error.message}${RESET}`);
      // Clean up listeners — error may not be followed by close
      callbackManager.off('OnNewImage', forwardNewImage);
      callbackManager.off('OnNewStatistics', forwardNewStatistics);
      callbackManager.off('OnRenderFailure', forwardRenderFailure);
      callbackManager.off('OnProjectManagerChanged', forwardProjectManagerChanged);
    });
  });

  console.log('WebSocket callback streaming ready');
  return wss;
}
