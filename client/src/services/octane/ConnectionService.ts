/**
 * Connection Service - WebSocket and connection management
 * Handles connection lifecycle and real-time callbacks
 */

import { BaseService } from './BaseService';
import { ApiService } from './ApiService';
import { EventEmitter } from '../../utils/EventEmitter';
import Logger from '../../utils/Logger';

/**
 * WebSocket reconnection configuration
 */
const RECONNECT_DELAY_MS = 5000;

/**
 * Connection Service manages server connections and WebSocket communication
 */
export class ConnectionService extends BaseService {
  private ws: WebSocket | null = null;
  private connected: boolean = false;
  private apiService: ApiService;

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
      
      // Setup WebSocket for callbacks
      this.connectWebSocket();
      
      this.connected = true;
      Logger.debug('Setting connected = true, emitting connected event');
      this.emit('connected', undefined);
      Logger.success('Connected to OctaneWebR server');
      
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
   */
  private connectWebSocket(): void {
    const wsUrl = this.serverUrl.replace('http', 'ws') + '/api/callbacks';
    Logger.network('Connecting WebSocket:', wsUrl);
    
    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        const ws = this.ws;
        if (!ws) return;
        
        Logger.success('WebSocket connected');
        Logger.debug(`WebSocket readyState on open: ${ws.readyState} (OPEN=${WebSocket.OPEN})`);
        
        /**
         * Race condition mitigation: Some browsers fire onopen before the WebSocket
         * is truly ready to send. A 50ms delay ensures the OPEN state is stable.
         * Without this, early send() calls may fail silently or throw exceptions.
         */
        setTimeout(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'subscribe' }));
            Logger.debug('Sent subscribe message to WebSocket');
          } else {
            Logger.warn(`WebSocket not in OPEN state after onopen (state: ${ws?.readyState})`);
          }
        }, 50);
      };
      
      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data as string);
          
          if (message.type === 'newImage') {
            this.emit('OnNewImage', message.data);
          } else if (message.type === 'newStatistics') {
            Logger.debug('📊 [ConnectionService] Received newStatistics callback');
            this.emit('OnNewStatistics', message.data);
          } else if (message.type === 'renderFailure') {
            Logger.error('❌ [ConnectionService] Received renderFailure callback');
            this.emit('OnRenderFailure', message.data);
          } else if (message.type === 'projectManagerChanged') {
            Logger.debug('📁 [ConnectionService] Received projectManagerChanged callback');
            this.emit('OnProjectManagerChanged', message.data);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          Logger.error('WebSocket message error:', errorMessage);
        }
      };
      
      this.ws.onerror = (error: Event) => {
        Logger.error('WebSocket error:', error);
      };
      
      this.ws.onclose = () => {
        Logger.debug('WebSocket disconnected');
        // Attempt reconnection after configured delay
        setTimeout(() => {
          if (this.connected) {
            Logger.debug('Reconnecting WebSocket...');
            this.connectWebSocket();
          }
        }, RECONNECT_DELAY_MS);
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Logger.error('WebSocket connection failed:', errorMessage);
    }
  }

  /**
   * Disconnect from the server and close WebSocket
   */
  async disconnect(): Promise<void> {
    this.connected = false;
    
    if (this.ws) {
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
