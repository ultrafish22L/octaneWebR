/**
 * Typed EventEmitter for TypeScript
 *
 * Uses a generic EventMap to provide compile-time checking of event names
 * and payload types. Callers define their event map interface and get
 * type-safe `on`, `off`, and `emit` calls.
 *
 * Example:
 *   interface MyEvents {
 *     'connected': [url: string];
 *     'error': [error: Error];
 *     'data': [payload: { id: number }];
 *   }
 *   const emitter = new EventEmitter<MyEvents>();
 *   emitter.on('connected', (url) => { ... }); // url: string
 *   emitter.emit('connected', 'ws://localhost'); // type-checked
 */

import { Logger } from './Logger';

/**
 * Default event map: accepts any string key with unknown[] args.
 * Used when no explicit event map is provided (backwards-compatible).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DefaultEventMap = Record<string, any[]>;

type EventHandler<Args extends unknown[] = unknown[]> = (...args: Args) => void;

export class EventEmitter<EventMap extends DefaultEventMap = DefaultEventMap> {
  private events: Map<string, EventHandler[]> = new Map();
  private maxListeners = 20;

  on<K extends string & keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    const handlers = this.events.get(event)!;
    handlers.push(handler as EventHandler);

    if (handlers.length > this.maxListeners) {
      Logger.warn(
        `EventEmitter: "${event}" has ${handlers.length} listeners (max ${this.maxListeners}). Possible memory leak.`
      );
    }
  }

  off<K extends string & keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void {
    const handlers = this.events.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler as EventHandler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit<K extends string & keyof EventMap>(event: K, ...args: EventMap[K]): void {
    const handlers = this.events.get(event);
    if (handlers) {
      // Iterate a copy so handlers that call off() during emit don't skip entries.
      // Each handler is wrapped in try-catch so one failing listener doesn't
      // prevent the remaining listeners from executing.
      const snapshot = [...handlers];
      for (const handler of snapshot) {
        try {
          handler(...args);
        } catch (error) {
          Logger.error(`EventEmitter: handler error for "${event}":`, error);
        }
      }
    }
  }

  removeAllListeners<K extends string & keyof EventMap>(event?: K): void {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }
}
