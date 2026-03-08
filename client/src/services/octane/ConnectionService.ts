/**
 * Connection Service - WebSocket and connection management
 * Handles connection lifecycle and real-time callbacks
 */

import { BaseService } from './BaseService';
import { ApiService } from './ApiService';
import { EventEmitter } from '../../utils/EventEmitter';
import { Logger } from '../../utils/Logger';

/**
 * WebSocket reconnection configuration — exponential backoff
 */
const BASE_RECONNECT_DELAY = 2000;
const MAX_RECONNECT_DELAY = 60000;
const RECONNECT_MULTIPLIER = 2;
const MAX_RECONNECT_ATTEMPTS = 10;
const COOLDOWN_RESET_MS = 60000;

/**
 * Connection Service manages server connections and WebSocket communication
 */
export class ConnectionService extends BaseService {
  private ws: WebSocket | null = null;
  private connected: boolean = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private apiService: ApiService;
  private reconnectDelay: number = BASE_RECONNECT_DELAY;
  private reconnectAttempts: number = 0;
  private isReconnecting: boolean = false;
  private lastDisconnectTime: number = 0;

  constructor(emitter: EventEmitter, serverUrl: string, apiService: ApiService) {
    super(emitter, serverUrl);
    this.apiService = apiService;
  }

  /**
   * Connect to the Octane server and establish WebSocket
   * @returns Promise resolving to true if connection successful, false otherwise
   */
  async connect(): Promise<boolean> {
    try {
      Logger.network('ConnectionService.connect() - Connecting to server:', this.serverUrl);

      // Check server health
      const isHealthy = await this.apiService.checkServerHealth();
      if (!isHealthy) {
        throw new Error('Server unhealthy');
      }

      // Setup WebSocket for callbacks — connected state is set when WebSocket opens
      await this.connectWebSocket();

      Logger.info('Connected to OctaneWebR server');

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : '';
      Logger.error('Connection failed:', errorMessage);
      Logger.debug('Error stack:', errorStack);
      this.emit('connectionError', error);
      return false;
    }
  }

  /**
   * Establish WebSocket connection for real-time callbacks
   * Handles automatic reconnection on disconnect
   * Returns a Promise that resolves when the WebSocket is open
   */
  private connectWebSocket(): Promise<void> {
    const wsUrl = this.serverUrl.replace('http', 'ws') + '/api/callbacks';
    Logger.network('Connecting WebSocket:', wsUrl);

    return new Promise<void>((resolve, reject) => {
      try {
        // Close any existing WebSocket before opening a new one.
        // Prevents duplicate connections and memory leaks (e.g., React StrictMode
        // double-invocation calls connect() twice rapidly).
        if (this.ws) {
          this.ws.onclose = null; // Prevent reconnect loop from old socket's onclose
          this.ws.close();
          this.ws = null;
        }

        const ws = new WebSocket(wsUrl);
        this.ws = ws;

        ws.onopen = () => {
          Logger.info('WebSocket connected');
          Logger.debug(`WebSocket readyState on open: ${ws.readyState} (OPEN=${WebSocket.OPEN})`);

          this.connected = true;
          Logger.debug('Setting connected = true, emitting connected event');
          this.emit('connected', undefined);

          /**
           * Race condition mitigation: Some browsers fire onopen before the WebSocket
           * is truly ready to send. A 50ms delay ensures the OPEN state is stable.
           * Without this, early send() calls may fail silently or throw exceptions.
           */
          setTimeout(() => {
            try {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'subscribe' }));
                Logger.debug('Sent subscribe message to WebSocket');
              } else {
                Logger.warn(`WebSocket not in OPEN state after onopen (state: ${ws.readyState})`);
              }
            } catch (error) {
              Logger.warn(
                'Failed to send subscribe:',
                error instanceof Error ? error.message : String(error)
              );
            }
          }, 50);

          resolve();
        };

        ws.onmessage = (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data as string);

            if (message.type === 'newImage') {
              this.emit('OnNewImage', message.data);
            } else if (message.type === 'newStatistics') {
              this.emit('OnNewStatistics', message.data);
            } else if (message.type === 'renderFailure') {
              Logger.error('WebSocket: renderFailure callback received');
              this.emit('OnRenderFailure', message.data);
            } else if (message.type === 'projectManagerChanged') {
              Logger.debug('WebSocket: projectManagerChanged callback received');
              this.emit('OnProjectManagerChanged', message.data);
            } else if (message.type === 'refreshScene') {
              Logger.info('WebSocket: refreshScene broadcast received (MCP sync)');
              this.emit('OnRefreshScene');
            } else {
              Logger.warn('WebSocket: Unknown message type:', message.type);
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            Logger.error('WebSocket message parse error:', errorMessage);
          }
        };

        ws.onerror = () => {
          // The WebSocket onerror event intentionally carries no error details (browser security).
          // Useful diagnostics arrive in onclose via CloseEvent.code and .reason.
          Logger.error(`WebSocket error (readyState: ${ws.readyState})`);
          reject(new Error('WebSocket connection error'));
        };

        ws.onclose = (event: CloseEvent) => {
          const reason = event.reason ? ` reason="${event.reason}"` : '';
          Logger.debug(
            `WebSocket disconnected — code=${event.code}${reason} clean=${event.wasClean}`
          );
          this.lastDisconnectTime = Date.now();
          this.scheduleReconnect();
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        Logger.error('WebSocket connection failed:', errorMessage);
        reject(error);
      }
    });
  }

  /**
   * Schedule a reconnection attempt with exponential backoff.
   * Resets attempt counter if enough time has elapsed since the last disconnect (cooldown).
   */
  private scheduleReconnect(): void {
    if (!this.connected || this.isReconnecting) return;

    // Reset attempts if we've been stable long enough (cooldown)
    if (this.lastDisconnectTime > 0 && Date.now() - this.lastDisconnectTime > COOLDOWN_RESET_MS) {
      this.reconnectDelay = BASE_RECONNECT_DELAY;
      this.reconnectAttempts = 0;
    }

    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      Logger.error(
        `WebSocket: max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached, giving up`
      );
      this.connected = false;
      this.emit('connectionError', new Error('Max reconnect attempts reached'));
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    Logger.debug(
      `WebSocket: reconnect attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${this.reconnectDelay}ms`
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.isReconnecting = false;
      if (this.connected) {
        this.connectWebSocket()
          .then(() => {
            // Reset backoff on successful reconnection
            this.reconnectDelay = BASE_RECONNECT_DELAY;
            this.reconnectAttempts = 0;
          })
          .catch(() => {
            // connectWebSocket rejection triggers another onclose → scheduleReconnect
          });
      }
    }, this.reconnectDelay);

    // Increase delay for next attempt (exponential backoff with cap)
    this.reconnectDelay = Math.min(this.reconnectDelay * RECONNECT_MULTIPLIER, MAX_RECONNECT_DELAY);
  }

  /**
   * Disconnect from the server and close WebSocket
   */
  async disconnect(): Promise<void> {
    this.connected = false;
    this.isReconnecting = false;
    this.reconnectDelay = BASE_RECONNECT_DELAY;
    this.reconnectAttempts = 0;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      // Prevent onclose handler from scheduling a zombie reconnect
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }

    this.emit('disconnected', undefined);
    Logger.network('Disconnected from server');
  }

  /**
   * Check if currently connected to the server
   * @returns True if connected, false otherwise
   */
  isConnected(): boolean {
    return this.connected;
  }
}
