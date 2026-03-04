/**
 * Callback Manager - Handles Octane render callback registration and streaming
 * Port of octaneProxy/callback_streamer.py functionality
 */

import { OctaneGrpcClient } from '../grpc/client';
import { EventEmitter } from 'events';

const RED = '\x1b[31m';
const RESET = '\x1b[0m';

export class CallbackManager extends EventEmitter {
  private grpcClient: OctaneGrpcClient;
  private callbackId: number = 0;
  private isRegistered: boolean = false;
  private boundListeners: { event: string; handler: (...args: any[]) => void }[] = [];

  constructor(grpcClient: OctaneGrpcClient) {
    super();
    this.grpcClient = grpcClient;
  }

  /**
   * Register for OnNewImage callbacks from Octane
   */
  async registerCallbacks(): Promise<void> {
    if (this.isRegistered) return;

    try {
      this.callbackId = Math.floor(Math.random() * 1000000);
      console.log('Setting up callback streaming...');

      const onImage = (data: any) => this.handleOnNewImage(data);
      const onStats = (data: any) => this.handleOnNewStatistics(data);
      const onFailure = (data: any) => this.handleOnRenderFailure(data);
      const onProject = (data: any) => this.handleOnProjectManagerChanged(data);

      this.boundListeners = [
        { event: 'OnNewImage', handler: onImage },
        { event: 'OnNewStatistics', handler: onStats },
        { event: 'OnRenderFailure', handler: onFailure },
        { event: 'OnProjectManagerChanged', handler: onProject },
      ];

      for (const { event, handler } of this.boundListeners) {
        this.grpcClient.on(event, handler);
      }

      await this.grpcClient.startCallbackStreaming();

      this.isRegistered = true;
      console.log('Callback streaming initialized');
    } catch (error: any) {
      // Remove listeners added before startCallbackStreaming failed
      for (const { event, handler } of this.boundListeners) {
        this.grpcClient.off(event, handler);
      }
      this.boundListeners = [];
      console.error(`${RED}Failed to register callback: ${error.message}${RESET}`);
      throw error;
    }
  }

  /**
   * Handle OnNewImage callback from Octane
   */
  private handleOnNewImage(data: any): void {
    try {
      if (
        data.render_images &&
        data.render_images.data &&
        Array.isArray(data.render_images.data) &&
        data.render_images.data.length > 0
      ) {
        this.emit('OnNewImage', {
          render_images: data.render_images,
          callback_id: data.callback_id,
          timestamp: Date.now(),
        });
      }
    } catch (error: any) {
      console.error(`${RED}Error handling OnNewImage callback: ${error.message}${RESET}`);
    }
  }

  /**
   * Handle OnNewStatistics callback from Octane
   */
  private handleOnNewStatistics(data: any): void {
    try {
      this.emit('OnNewStatistics', {
        statistics: data.statistics,
        user_data: data.user_data,
        timestamp: data.timestamp,
      });
    } catch (error: any) {
      console.error(`${RED}Error handling OnNewStatistics callback: ${error.message}${RESET}`);
    }
  }

  /**
   * Handle OnRenderFailure callback from Octane
   */
  private handleOnRenderFailure(data: any): void {
    try {
      console.log('Render failure notification received');

      this.emit('OnRenderFailure', {
        user_data: data.user_data,
        timestamp: data.timestamp,
      });
    } catch (error: any) {
      console.error(`${RED}Error handling OnRenderFailure callback: ${error.message}${RESET}`);
    }
  }

  /**
   * Handle OnProjectManagerChanged callback from Octane
   */
  private handleOnProjectManagerChanged(data: any): void {
    try {
      console.log('Project manager changed notification received');

      this.emit('OnProjectManagerChanged', {
        user_data: data.user_data,
        timestamp: data.timestamp,
      });
    } catch (error: any) {
      console.error(
        `${RED}Error handling OnProjectManagerChanged callback: ${error.message}${RESET}`
      );
    }
  }

  /**
   * Unregister callbacks
   */
  async unregisterCallbacks(): Promise<void> {
    if (!this.isRegistered) return;

    try {
      console.log('Unregistering callbacks');

      // Remove listeners from grpcClient to prevent duplicates on re-register
      for (const { event, handler } of this.boundListeners) {
        this.grpcClient.off(event, handler);
      }
      this.boundListeners = [];

      await this.grpcClient.callMethod('ApiRenderEngine', 'setOnNewImageCallback', {
        callback: null,
        userData: 0,
      });

      this.isRegistered = false;
      console.log('Callbacks unregistered');
    } catch (error: any) {
      this.isRegistered = false; // Allow re-registration even if gRPC unregister failed
      console.error(`${RED}Failed to unregister callbacks: ${error.message}${RESET}`);
    }
  }

  /**
   * Get registration status
   */
  isCallbackRegistered(): boolean {
    return this.isRegistered;
  }
}

let instance: CallbackManager | null = null;

export function getCallbackManager(grpcClient: OctaneGrpcClient): CallbackManager {
  if (!instance) {
    instance = new CallbackManager(grpcClient);
  }
  return instance;
}
