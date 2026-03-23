/**
 * CallbackRelay — exposes MCP's callback stream over a local WebSocket.
 *
 * MCP owns the single gRPC callback stream to Octane. This relay broadcasts
 * callback events on localhost:51023 so Vite can consume them without opening
 * a second gRPC stream (which causes RESOURCE_EXHAUSTED errors).
 *
 * Message format (JSON): { type, userData, timestamp }
 * For newImage: notification only — no pixel data. Vite fetches via grabRenderResult().
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { CallbackStreamManager, CallbackType } from './CallbackStreamManager';

const RELAY_PORT = 51023;

export class CallbackRelay {
  private wss: WebSocketServer | null = null;
  private handlers = new Map<CallbackType, (event: any) => void>();
  private log: (msg: string, level?: string) => void;

  constructor(
    private stream: CallbackStreamManager,
    options?: { log?: (msg: string, level?: string) => void }
  ) {
    this.log = options?.log ?? ((msg: string) => console.log(`[CallbackRelay] ${msg}`));
  }

  start(): void {
    if (this.wss) return;

    try {
      this.wss = new WebSocketServer({ host: '127.0.0.1', port: RELAY_PORT });

      this.wss.on('listening', () => {
        this.log(`Relay listening on ws://127.0.0.1:${RELAY_PORT}`, 'info');
      });

      this.wss.on('error', (err: any) => {
        // Port in use = another MCP instance already relaying. Not fatal.
        if (err.code === 'EADDRINUSE') {
          this.log(`Port ${RELAY_PORT} in use — another MCP relay is active`, 'warn');
          this.wss = null;
          return;
        }
        this.log(`Relay error: ${err.message}`, 'error');
      });

      // Wire all 4 callback types
      const types: CallbackType[] = [
        'projectManagerChanged',
        'renderFailure',
        'newStatistics',
        'newImage',
      ];

      for (const type of types) {
        const handler = (event: any) => {
          this.broadcast({
            type,
            userData: event.userData ?? 0,
            timestamp: event.timestamp ?? Date.now(),
          });
        };
        this.handlers.set(type, handler);
        this.stream.on(type, handler);
      }
    } catch (err: any) {
      this.log(`Failed to start relay: ${err.message}`, 'error');
      this.wss = null;
    }
  }

  stop(): void {
    // Unregister stream listeners
    for (const [type, handler] of this.handlers) {
      this.stream.off(type, handler);
    }
    this.handlers.clear();

    // Close WS server
    if (this.wss) {
      for (const client of this.wss.clients) {
        client.close();
      }
      this.wss.close();
      this.wss = null;
      this.log('Relay stopped', 'info');
    }
  }

  get clientCount(): number {
    return this.wss?.clients.size ?? 0;
  }

  private broadcastCount = 0;

  private broadcast(msg: object): void {
    if (!this.wss || this.wss.clients.size === 0) {
      if (this.broadcastCount++ % 100 === 0) {
        this.log(`Broadcast skipped — ${this.wss?.clients.size ?? 0} clients`, 'debug');
      }
      return;
    }
    const data = JSON.stringify(msg);
    let sent = 0;
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
        sent++;
      }
    }
    if (this.broadcastCount++ < 5) {
      this.log(
        `Broadcast to ${sent}/${this.wss.clients.size} clients: ${(msg as any).type}`,
        'debug'
      );
    }
  }
}
