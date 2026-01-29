/**
 * Callback Manager - Handles Octane render callback registration and streaming
 * Port of octaneProxy/callback_streamer.py functionality
 */

import { OctaneGrpcClient } from '../grpc/client';
import { EventEmitter } from 'events';

export class CallbackManager extends EventEmitter {
  private grpcClient: OctaneGrpcClient;
  private callbackId: number = 0;
  private isRegistered: boolean = false;

  constructor(grpcClient: OctaneGrpcClient) {
    super();
    this.grpcClient = grpcClient;
  }

  /**
   * Register for OnNewImage callbacks from Octane
   */
  async registerCallbacks(): Promise<void> {
    if (this.isRegistered) {
      console.log('⚠️ Callbacks already registered');
      return;
    }

    try {
      // Generate unique callback ID
      this.callbackId = Math.floor(Math.random() * 1000000);
      
      console.log(`📡 Setting up callback streaming...`);

      // Listen for OnNewImage events from the gRPC client
      this.grpcClient.on('OnNewImage', (data: any) => {
        this.handleOnNewImage(data);
      });

      // Listen for OnNewStatistics events
      this.grpcClient.on('OnNewStatistics', (data: any) => {
        this.handleOnNewStatistics(data);
      });

      // Listen for OnRenderFailure events
      this.grpcClient.on('OnRenderFailure', (data: any) => {
        this.handleOnRenderFailure(data);
      });

      // Listen for OnProjectManagerChanged events
      this.grpcClient.on('OnProjectManagerChanged', (data: any) => {
        this.handleOnProjectManagerChanged(data);
      });

      // Start callback streaming (registers callback + opens stream)
      await this.grpcClient.startCallbackStreaming();

      this.isRegistered = true;
      console.log(`✅ Callback streaming initialized`);

    } catch (error: any) {
      console.error('❌ Failed to register callback:', error.message);
      throw error;
    }
  }

  /**
   * Handle OnNewImage callback from Octane
   */
  private handleOnNewImage(data: any): void {
    try {
      // Extract render images from callback
      // Check if render_images exists, has a data array, AND that array is not empty
      if (data.render_images && data.render_images.data && Array.isArray(data.render_images.data) && data.render_images.data.length > 0) {
        // High-frequency logging commented out to reduce console spam during rendering
        // const imageCount = data.render_images.data.length;
        // const firstImage = data.render_images.data[0];
        // console.log(`📸 [CallbackManager] Received ${imageCount} render image(s)`);
        // console.log(`📸 [CallbackManager] Image details:`, {
        //   type: firstImage?.type,
        //   size: firstImage?.size,
        //   bufferSize: firstImage?.buffer?.size,
        //   hasData: !!firstImage?.buffer?.data
        // });
        
        // Emit OnNewImage event to WebSocket clients
        this.emit('OnNewImage', {
          render_images: data.render_images,
          callback_id: data.callback_id,
          timestamp: Date.now()
        });
      } else {
        // Debug logging for invalid/empty callback data - commented out (high frequency)
        // console.log('⚠️ [CallbackManager] Callback data has no valid images:', {
        //   hasRenderImages: !!data.render_images,
        //   hasData: !!data.render_images?.data,
        //   isArray: Array.isArray(data.render_images?.data),
        //   length: data.render_images?.data?.length || 0
        // });
      }
    } catch (error: any) {
      console.error('❌ Error handling OnNewImage callback:', error.message);
    }
  }

  /**
   * Handle OnNewStatistics callback from Octane
   */
  private handleOnNewStatistics(data: any): void {
    try {
      // High-frequency logging commented out to reduce console spam during rendering
      // console.log('📊 [CallbackManager] Received render statistics (FULL DATA):', JSON.stringify(data, null, 2));
      
      // Emit OnNewStatistics event to WebSocket clients
      this.emit('OnNewStatistics', {
        statistics: data.statistics,
        user_data: data.user_data,
        timestamp: data.timestamp
      });
    } catch (error: any) {
      console.error('❌ Error handling OnNewStatistics callback:', error.message);
    }
  }

  /**
   * Handle OnRenderFailure callback from Octane
   */
  private handleOnRenderFailure(data: any): void {
    try {
      console.log('❌ [CallbackManager] Received render failure notification');
      
      // Emit OnRenderFailure event to WebSocket clients
      this.emit('OnRenderFailure', {
        user_data: data.user_data,
        timestamp: data.timestamp
      });
    } catch (error: any) {
      console.error('❌ Error handling OnRenderFailure callback:', error.message);
    }
  }

  /**
   * Handle OnProjectManagerChanged callback from Octane
   */
  private handleOnProjectManagerChanged(data: any): void {
    try {
      console.log('📁 [CallbackManager] Received project manager changed notification');
      
      // Emit OnProjectManagerChanged event to WebSocket clients
      this.emit('OnProjectManagerChanged', {
        user_data: data.user_data,
        timestamp: data.timestamp
      });
    } catch (error: any) {
      console.error('❌ Error handling OnProjectManagerChanged callback:', error.message);
    }
  }

  /**
   * Unregister callbacks
   */
  async unregisterCallbacks(): Promise<void> {
    if (!this.isRegistered) {
      return;
    }

    try {
      console.log('📡 Unregistering callbacks');

      // Stop polling
      this.isRegistered = false;

      // Unregister callback (send empty/null callback)
      await this.grpcClient.callMethod('ApiRenderEngine', 'setOnNewImageCallback', {
        userData: 0
        // callback field omitted = null callback
      });

      console.log('✅ Callbacks unregistered');

    } catch (error: any) {
      console.error('❌ Failed to unregister callbacks:', error.message);
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
