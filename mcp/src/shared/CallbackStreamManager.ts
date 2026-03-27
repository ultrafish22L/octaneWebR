/**
 * CallbackStreamManager — shared callback streaming for Octane gRPC.
 *
 * Used by both the MCP server and Vite plugin to receive Octane events:
 * - projectManagerChanged: project loaded/reset/modified
 * - renderFailure: render failed
 * - newStatistics: render stats updated (rarely sent by Octane in practice)
 * - newImage: render image data (opt-in via handleNewImage, used by Vite only)
 *
 * The stream auto-expires every DEADLINE_MS to prevent Octane shutdown deadlock
 * (Octane waits for in-progress RPCs to finish, infinite streams never finish).
 * On expiry, reconnects immediately.
 *
 * On Octane crash/restart, reconnects with exponential backoff (2s, 4s, 8s... 30s max).
 *
 * IMPORTANT: Only ONE stream should be opened per gRPC channel. Opening multiple
 * streams causes Octane to send large newImage data to each, which can trigger
 * RESOURCE_EXHAUSTED errors.
 */

export type CallbackType = 'projectManagerChanged' | 'renderFailure' | 'newStatistics' | 'newImage';

export interface CallbackEvent {
  type: CallbackType;
  userData: number;
  timestamp: number;
}

/** Raw newImage payload from Octane — passed to newImage listeners as-is. */
export interface NewImageEvent {
  type: 'newImage';
  /** The raw callbackRequest.newImage object from gRPC. */
  raw: any;
  timestamp: number;
}

export interface CallbackStreamOptions {
  /** Stream deadline in ms before auto-reconnect. Default 60000. */
  deadlineMs?: number;
  /** Logger function. Default console.log. */
  log?: (msg: string, level?: string) => void;
  /** Called when Octane connection is lost (before reconnect attempt). */
  onConnectionLost?: () => void;
  /** Called when stream successfully reconnects after a disconnection. */
  onReconnected?: () => void;
  /**
   * Enable newImage dispatching. Default false.
   * Only enable for Vite (render viewport). MCP uses save_render on demand.
   * When false, newImage data is received but silently dropped.
   */
  handleNewImage?: boolean;
}

const DEFAULT_DEADLINE_MS = 60_000;
const OCTANE_GONE_PATTERN = /ECONNRESET|ECONNREFUSED|CANCELLED|Stream removed|socket hang up/i;
const BACKOFF_BASE_MS = 2_000;
const BACKOFF_MAX_MS = 30_000;

export class CallbackStreamManager {
  private stream: any = null;
  private active = false;
  private running = false; // true between start() and stop()
  private listeners = new Map<CallbackType, Set<(event: CallbackEvent | NewImageEvent) => void>>();
  private deadlineMs: number;
  private log: (msg: string, level?: string) => void;
  private onConnectionLost?: () => void;
  private onReconnected?: () => void;
  private handleNewImage: boolean;

  // Reconnect state
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private wasConnected = false; // true after first successful data

  /**
   * @param getService Function that returns a gRPC service stub by name.
   *   Both Vite and MCP expose this via their base client.
   */
  constructor(
    private getService: (name: string) => any,
    options?: CallbackStreamOptions
  ) {
    this.deadlineMs = options?.deadlineMs ?? DEFAULT_DEADLINE_MS;
    this.log = options?.log ?? ((msg: string) => console.log(`[CallbackStream] ${msg}`));
    this.onConnectionLost = options?.onConnectionLost;
    this.onReconnected = options?.onReconnected;
    this.handleNewImage = options?.handleNewImage ?? false;

    // Initialize listener sets
    for (const type of [
      'projectManagerChanged',
      'renderFailure',
      'newStatistics',
      'newImage',
    ] as const) {
      this.listeners.set(type, new Set());
    }
  }

  /** Start streaming — auto-reconnects on deadline expiry and Octane crash. */
  start(): void {
    if (this.stream || this.active) return;
    this.running = true;
    this.reconnectAttempt = 0;
    this.openStream();
  }

  /** Stop streaming — clean shutdown, no reconnect. */
  stop(): void {
    this.running = false;
    this.active = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.stream) {
      try {
        this.stream.cancel();
      } catch {
        /* already closed */
      }
      this.stream = null;
    }
  }

  /** Register a listener for a callback type. */
  on(type: CallbackType, cb: (event: any) => void): void {
    this.listeners.get(type)?.add(cb);
  }

  /** Unregister a listener. */
  off(type: CallbackType, cb: (event: any) => void): void {
    this.listeners.get(type)?.delete(cb);
  }

  /**
   * Wait for the next event of a specific type.
   * Resolves with the event, or null if timed out.
   * This is the main API for load_project — wait for projectManagerChanged.
   */
  waitFor(type: CallbackType, timeoutMs = 120_000): Promise<CallbackEvent | null> {
    return new Promise(resolve => {
      let timer: ReturnType<typeof setTimeout> | null = null;

      const handler = (event: CallbackEvent) => {
        if (timer) clearTimeout(timer);
        this.off(type, handler);
        resolve(event);
      };

      this.on(type, handler);

      timer = setTimeout(() => {
        this.off(type, handler);
        resolve(null);
      }, timeoutMs);
    });
  }

  /** Is the stream currently active? */
  get isActive(): boolean {
    return this.active;
  }

  /** Is the stream attempting to reconnect after a disconnection? */
  get isReconnecting(): boolean {
    return this.running && !this.active && this.reconnectAttempt > 0;
  }

  // ── Private ───────────────────────────────────────────────────────

  private scheduleReconnect(): void {
    if (!this.running || this.reconnectTimer) return;
    const delay = Math.min(BACKOFF_BASE_MS * Math.pow(2, this.reconnectAttempt), BACKOFF_MAX_MS);
    this.reconnectAttempt++;
    this.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})`, 'info');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.running) this.openStream();
    }, delay);
  }

  private openStream(): void {
    if (this.stream || this.active || !this.running) {
      this.log(
        `openStream skipped: stream=${!!this.stream} active=${this.active} running=${this.running}`,
        'debug'
      );
      return;
    }

    try {
      this.active = true;
      const streamService = this.getService('StreamCallbackService');
      this.log(`Opening stream with deadline ${this.deadlineMs}ms`, 'debug');
      const deadline = Date.now() + this.deadlineMs;
      this.stream = streamService.callbackChannel({}, null, { deadline });

      // Stream opened successfully — if reconnecting, fire onReconnected immediately
      // so callers can re-register callbacks (waiting for data creates a chicken-and-egg:
      // Octane won't send newImage until callbacks are re-registered).
      if (this.reconnectAttempt > 0 && this.wasConnected) {
        this.log('Stream reconnected successfully', 'info');
        this.reconnectAttempt = 0;
        this.onReconnected?.();
      }

      this.stream.on('data', (callbackRequest: any) => {
        try {
          // Reset reconnect state on successful data (backup for edge cases)
          if (this.reconnectAttempt > 0) {
            this.reconnectAttempt = 0;
          }
          this.wasConnected = true;
          this.dispatch(callbackRequest);
        } catch (error: any) {
          this.log(`Error processing callback: ${error.message}`, 'error');
        }
      });

      this.stream.on('error', (error: any) => {
        this.active = false;
        try {
          this.stream?.cancel();
        } catch {
          /* already errored */
        }
        this.stream = null;

        const msg = String(error?.message || '');
        const isDeadline = /DEADLINE_EXCEEDED/i.test(msg);
        const octaneGone = OCTANE_GONE_PATTERN.test(msg);

        if (!this.running) {
          // Voluntary stop() — cancel was intentional, not a real disconnection
          this.log('Stream cancelled (clean shutdown)', 'debug');
        } else if (isDeadline) {
          // Normal deadline expiry — reconnect immediately
          this.log('Deadline expired — reconnecting', 'debug');
          this.openStream();
        } else if (octaneGone) {
          this.log('Octane connection lost', 'warn');
          this.onConnectionLost?.();
          this.scheduleReconnect();
        } else {
          this.log(`Stream error: ${msg}`, 'error');
          this.scheduleReconnect();
        }
      });

      this.stream.on('end', () => {
        this.log('Stream ended (deadline or server close)', 'debug');
        this.active = false;
        this.stream = null;
        // Reconnect if still running
        if (this.running) {
          this.log('Reconnecting callback stream...', 'debug');
          this.openStream();
        }
      });

      this.log('Callback streaming active', 'info');
    } catch (error: any) {
      this.log(`Failed to start callback streaming: ${error.message}`, 'error');
      this.active = false;
      this.stream = null;
      // Retry with backoff if running (e.g. gRPC channels reset, service stub not yet available)
      if (this.running) {
        this.scheduleReconnect();
      }
    }
  }

  private dispatch(callbackRequest: any): void {
    if (callbackRequest.newImage) {
      // Always emit newImage to listeners (the CallbackRelay needs it to
      // forward frames to Vite). The handleNewImage flag only controls whether
      // the *consumer* processes the data — listeners like the relay always fire.
      const listeners = this.listeners.get('newImage');
      if (listeners && listeners.size > 0) {
        const event: NewImageEvent = {
          type: 'newImage',
          raw: callbackRequest.newImage,
          timestamp: Date.now(),
        };
        for (const cb of listeners) {
          try {
            cb(event);
          } catch (e: any) {
            this.log(`Error in newImage listener: ${e.message}`, 'error');
          }
        }
      }
    } else if (callbackRequest.renderFailure) {
      this.emit('renderFailure', callbackRequest.renderFailure?.user_data ?? 0);
    } else if (callbackRequest.newStatistics) {
      this.emit('newStatistics', callbackRequest.newStatistics?.user_data ?? 0);
    } else if (callbackRequest.projectManagerChanged) {
      this.emit('projectManagerChanged', callbackRequest.projectManagerChanged?.user_data ?? 0);
    }
  }

  private emit(type: CallbackType, userData: number): void {
    const event: CallbackEvent = { type, userData, timestamp: Date.now() };
    const listeners = this.listeners.get(type);
    if (!listeners) return;
    for (const cb of listeners) {
      try {
        cb(event);
      } catch (e: any) {
        this.log(`Error in ${type} listener: ${e.message}`, 'error');
      }
    }
  }
}
