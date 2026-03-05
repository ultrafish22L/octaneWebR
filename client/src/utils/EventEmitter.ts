/**
 * Simple EventEmitter for TypeScript
 *
 * EventHandler uses Function to allow typed callbacks at call sites
 * (e.g. `client.on('event', (data: SomeType) => ...)`).
 * The Function type accepts any callable without using `any` and is
 * intentional for a generic event-emitter pattern.
 */

import { Logger } from './Logger';

type EventHandler = Function;

export class EventEmitter {
  private events: Map<string, EventHandler[]> = new Map();
  private maxListeners = 20;

  on(event: string, handler: EventHandler): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    const handlers = this.events.get(event)!;
    handlers.push(handler);

    if (handlers.length > this.maxListeners) {
      Logger.warn(
        `EventEmitter: "${event}" has ${handlers.length} listeners (max ${this.maxListeners}). Possible memory leak.`
      );
    }
  }

  off(event: string, handler: EventHandler): void {
    const handlers = this.events.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(event: string, ...args: unknown[]): void {
    const handlers = this.events.get(event);
    if (handlers) {
      // Iterate a copy so handlers that call off() during emit don't skip entries.
      // Each handler is wrapped in try-catch so one failing listener doesn't
      // prevent the remaining listeners from executing.
      const snapshot = [...handlers];
      for (const handler of snapshot) {
        try {
          (handler as (...a: unknown[]) => void)(...args);
        } catch (error) {
          console.error(`EventEmitter: handler error for "${event}":`, error);
        }
      }
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }
}
