/**
 * Simple EventEmitter for TypeScript
 *
 * EventHandler uses Function to allow typed callbacks at call sites
 * (e.g. `client.on('event', (data: SomeType) => ...)`).
 * The Function type accepts any callable without using `any` and is
 * intentional for a generic event-emitter pattern.
 */

type EventHandler = Function;

export class EventEmitter {
  private events: Map<string, EventHandler[]> = new Map();

  on(event: string, handler: EventHandler): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(handler);
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
      handlers.forEach(handler => (handler as (...a: unknown[]) => void)(...args));
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
