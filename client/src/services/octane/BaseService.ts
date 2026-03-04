/**
 * Base service class providing common functionality for all Octane services
 */

import { EventEmitter } from '../../utils/EventEmitter';

/**
 * Base Service provides common event emitter and server URL access to all services
 */
export abstract class BaseService {
  protected emitter: EventEmitter;
  protected serverUrl: string;

  constructor(emitter: EventEmitter, serverUrl: string) {
    this.emitter = emitter;
    this.serverUrl = serverUrl;
  }

  /**
   * Emit an event to all listeners
   * @param event - Event name
   * @param data - Optional event data
   */
  protected emit(event: string, data?: unknown): void {
    this.emitter.emit(event, data);
  }

  /**
   * Emit a user-facing error message via the status bar.
   * Components listen for 'status:error' and call setTemporaryStatus.
   */
  protected emitUserError(message: string): void {
    this.emitter.emit('status:error', message);
  }

  /**
   * Register an event listener
   * @param event - Event name
   * @param handler - Event handler function
   */
  protected on(event: string, handler: (...args: unknown[]) => void): void {
    this.emitter.on(event, handler);
  }

  /**
   * Unregister an event listener
   * @param event - Event name
   * @param handler - Event handler function
   */
  protected off(event: string, handler: (...args: unknown[]) => void): void {
    this.emitter.off(event, handler);
  }
}
