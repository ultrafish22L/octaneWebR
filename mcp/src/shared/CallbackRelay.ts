/**
 * CallbackRelay — exposes MCP's callback stream over a local WebSocket.
 *
 * MCP owns the single gRPC callback stream to Octane. This relay broadcasts
 * callback events on localhost:51023 so Vite can consume them without opening
 * a second gRPC stream (which causes RESOURCE_EXHAUSTED errors).
 *
 * Wire format: all messages are binary WebSocket frames.
 *   [4 bytes: header length (uint32 LE)] [JSON header] [optional payload bytes]
 *
 * Alpha 5 sends pixel data inline in newImage — the raw render_images buffer
 * goes in the payload section. 2026.2/octaneServGrpc sends empty newImage
 * notifications (no payload). Vite handles both cases.
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { CallbackStreamManager, CallbackType } from './CallbackStreamManager';

const RELAY_PORT = 51023;

export class CallbackRelay {
  private wss: WebSocketServer | null = null;
  private handlers = new Map<CallbackType, (event: any) => void>();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private log: (msg: string, level?: string) => void;

  constructor(
    private stream: CallbackStreamManager,
    options?: { log?: (msg: string, level?: string) => void }
  ) {
    this.log = options?.log ?? ((msg: string) => console.log(`[CallbackRelay] ${msg}`));
  }

  start(): void {
    if (this.wss) return;
    this.tryListen();
  }

  private tryListen(retried = false): void {
    try {
      const wss = new WebSocketServer({ host: '127.0.0.1', port: RELAY_PORT });

      wss.on('listening', () => {
        this.wss = wss;
        this.log(`Relay listening on ws://127.0.0.1:${RELAY_PORT}`, 'info');
        this.wireHandlers();
      });

      wss.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          wss.close();
          if (retried) {
            this.log(`Port ${RELAY_PORT} in use — another MCP instance may be running`, 'warn');
            return;
          }
          this.log(`Port ${RELAY_PORT} in use — retrying in 2s`, 'info');
          setTimeout(() => this.tryListen(true), 2000);
          return;
        }
        this.log(`Relay error: ${err.message}`, 'error');
      });
    } catch (err: any) {
      this.log(`Failed to start relay: ${err.message}`, 'error');
    }
  }

  private wireHandlers(): void {
    const types: CallbackType[] = [
      'projectManagerChanged',
      'renderFailure',
      'newStatistics',
      'newImage',
    ];

    for (const type of types) {
      const handler = (event: any) => {
        this.broadcastBinary(type, event);
      };
      this.handlers.set(type, handler);
      this.stream.on(type, handler);
    }

    // Heartbeat every 2s — lets Vite detect stale relays quickly
    this.heartbeatInterval = setInterval(() => {
      this.broadcastBinary('heartbeat', {
        streamActive: this.stream.isActive,
        reconnecting: this.stream.isReconnecting,
      });
    }, 2000);
  }

  stop(): void {
    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

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

  /**
   * Pack and broadcast a binary frame: [4B headerLen LE] [JSON header] [payload]
   *
   * For newImage with pixel data (Alpha 5), the raw gRPC object goes in the
   * header — render_images contains the pixel buffers which Buffer.from(JSON)
   * won't touch since we're sending binary, not stringifying.
   */
  private broadcastBinary(type: string, event: any): void {
    if (!this.wss || this.wss.clients.size === 0) {
      // Commented out — high-frequency noise in logs (~25+ per build session)
      // if (this.broadcastCount++ % 100 === 0) {
      //   this.log(`Broadcast skipped — ${this.wss?.clients.size ?? 0} clients`, 'debug');
      // }
      this.broadcastCount++;
      return;
    }

    // Build header — everything except large binary buffers
    const header: Record<string, any> = {
      type,
      timestamp: event.timestamp ?? Date.now(),
    };

    let pixelPayload: Buffer | null = null;

    if (type === 'newImage' && event.raw) {
      const raw = event.raw;
      const images = raw.render_images?.data;
      if (images?.length > 0) {
        const firstImage = images[0];
        // Alpha 5 ApiRenderImage: buffer.data = bytes, size = {x: width, y: height}
        const pixelBuf = firstImage.buffer?.data ?? firstImage.data;
        if (pixelBuf && pixelBuf.length > 0) {
          // gRPC/protobuf.js may return Uint8Array, not Buffer
          pixelPayload = Buffer.isBuffer(pixelBuf) ? pixelBuf : Buffer.from(pixelBuf);
          const imgSize = firstImage.size; // uint32_2: {x, y}
          header.renderImage = {
            width: imgSize?.x ?? firstImage.width ?? 0,
            height: imgSize?.y ?? firstImage.height ?? 0,
            format: firstImage.type ?? firstImage.format ?? 0,
            pitch: firstImage.pitch ?? 0,
            imageCount: images.length,
            callback_source: raw.callback_source,
            callback_id: raw.callback_id,
            user_data: raw.user_data,
          };
          if (firstImage.sharedSurface?.handle) {
            header.renderImage.sharedSurface = firstImage.sharedSurface;
          }
        }
      }
      // If no pixel buffer found, still send the raw event metadata
      if (!pixelPayload) {
        header.userData = raw.user_data ?? event.userData ?? 0;
        header.callback_id = raw.callback_id;
        header.callback_source = raw.callback_source;
      }
    } else {
      // Non-image events: just forward metadata
      header.userData = event.userData ?? event.user_data ?? 0;
    }

    // Pack: [4B headerLen] [headerJSON] [pixelPayload?]
    const headerBuf = Buffer.from(JSON.stringify(header), 'utf8');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32LE(headerBuf.length, 0);

    const frame = pixelPayload
      ? Buffer.concat([lenBuf, headerBuf, pixelPayload])
      : Buffer.concat([lenBuf, headerBuf]);

    let sent = 0;
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(frame);
        sent++;
      }
    }
    if (this.broadcastCount++ < 5) {
      const payloadInfo = pixelPayload ? ` +${pixelPayload.length}B pixels` : '';
      this.log(
        `Broadcast to ${sent}/${this.wss.clients.size} clients: ${type}${payloadInfo}`,
        'debug'
      );
    }
  }
}
