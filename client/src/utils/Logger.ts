/**
 * Centralized logging utility for OctaneWebR
 *
 * Log levels: NONE < ERROR < WARN < INFO < DEBUG < DEBUGV
 * Set level to control verbosity — higher level = more verbose output.
 * Errors and warnings use native browser console coloring.
 *
 * Server-side file logging (batched to /api/log) is enabled in dev mode.
 */
/* eslint-disable no-console */

const DEBUG_MODE = import.meta.env.DEV;

export enum LogLevel {
  NONE = 0, // Silent — suppress all output
  ERROR = 1, // Errors — failures requiring attention
  WARN = 2, // Warnings — degraded state, fallbacks
  INFO = 3, // Normal operation — startup, connection events
  DEBUG = 4, // Standard debug — connection state, scene operations
  DEBUGV = 5, // Verbose debug — high-frequency, API calls, proto details
}

class LoggerInstance {
  level: LogLevel;
  private logBuffer: { level: string; message: string }[] = [];
  private flushInterval: number | null = null;
  private initialized = false;
  private isFlushing = false;

  constructor() {
    const isDev = import.meta.env.MODE === 'development' || import.meta.env.DEV;
    this.level = isDev ? LogLevel.INFO : LogLevel.WARN;

    if (DEBUG_MODE) {
      this.flushInterval = setInterval(() => this.flush(), 1000) as unknown as number;
    }
  }

  /** Clear server log file — called on first use rather than at import time */
  private ensureInitialized(): void {
    if (this.initialized) return;
    this.initialized = true;
    fetch('/api/logClear', { method: 'POST' }).catch(() => {
      /* server may not be ready yet */
    });
  }

  // ── Level checks ────────────────────────────────────────────────

  /** Verbose debug — API calls, proto resolution, high-frequency data.
   *  Accepts a callback `() => string` for lazy evaluation — the callback
   *  is only invoked if DEBUGV logging is enabled. Use this form for calls
   *  that build expensive strings (JSON.stringify, template literals). */
  debugV(msgOrFn: unknown, ...rest: unknown[]): void {
    if (this.level < LogLevel.DEBUGV) return;
    if (typeof msgOrFn === 'function' && rest.length === 0) {
      const result = (msgOrFn as () => unknown)();
      const args = Array.isArray(result) ? result : [result];
      console.log(...args);
      this.buffer('debugv', args);
    } else {
      console.log(msgOrFn, ...rest);
      this.buffer('debugv', [msgOrFn, ...rest]);
    }
  }

  /** Standard debug — state changes, scene operations.
   *  Accepts a callback `() => string` for lazy evaluation — the callback
   *  is only invoked if DEBUG logging is enabled. */
  debug(msgOrFn: unknown, ...rest: unknown[]): void {
    if (this.level < LogLevel.DEBUG) return;
    if (typeof msgOrFn === 'function' && rest.length === 0) {
      const result = (msgOrFn as () => unknown)();
      const args = Array.isArray(result) ? result : [result];
      console.log(...args);
      this.buffer('debug', args);
    } else {
      console.log(msgOrFn, ...rest);
      this.buffer('debug', [msgOrFn, ...rest]);
    }
  }

  /** Info — normal operation events */
  info(...args: unknown[]): void {
    if (this.level < LogLevel.INFO) return;
    console.log(...args);
    this.buffer('info', args);
  }

  /** Warning — degraded state, fallbacks (browser renders yellow) */
  warn(...args: unknown[]): void {
    if (this.level < LogLevel.WARN) return;
    console.warn(...args);
    this.buffer('warn', args);
  }

  /** Error — failures, styled red for visibility */
  error(...args: unknown[]): void {
    if (this.level < LogLevel.ERROR) return;
    console.error('%c[ERROR]', 'color:#ff4444;font-weight:bold', ...args);
    this.buffer('error', args);
  }

  // ── Aliases ─────────────────────────────────────────────────────

  /** API call logging (verbose) */
  api(service: string, method: string, handle?: unknown): void {
    if (this.level < LogLevel.DEBUGV) return;
    const h = handle ? ` (handle: ${handle})` : '';
    this.debugV(`${service}.${method}${h}`);
  }

  /** Network events (debug) */
  network(first: unknown, ...rest: unknown[]): void {
    this.debug(first, ...rest);
  }

  /** Scene operations (debug) */
  scene(first: unknown, ...rest: unknown[]): void {
    this.debug(first, ...rest);
  }

  /** Render events (debug) */
  render(first: unknown, ...rest: unknown[]): void {
    this.debug(first, ...rest);
  }

  /** Console group (debug) */
  group(label: string): void {
    if (this.level < LogLevel.DEBUG) return;
    console.group(label);
  }

  groupEnd(): void {
    if (this.level < LogLevel.DEBUG) return;
    console.groupEnd();
  }

  // ── Configuration ───────────────────────────────────────────────

  setLevel(level: LogLevel): void {
    this.level = level;
  }
  getLevel(): LogLevel {
    return this.level;
  }

  destroy(): void {
    if (this.flushInterval) clearInterval(this.flushInterval);
    this.flush();
  }

  // ── Server file logging ─────────────────────────────────────────

  private buffer(level: string, args: unknown[]): void {
    if (!DEBUG_MODE) return;
    this.ensureInitialized();

    const message = args
      .map(a => {
        if (typeof a === 'string') return a;
        if (a instanceof Error) return a.stack || a.message;
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      })
      .join(' ');

    this.logBuffer.push({ level, message });

    if (this.logBuffer.length >= 100) this.flush();
  }

  private async flush(): Promise<void> {
    if (this.logBuffer.length === 0 || this.isFlushing) return;
    this.isFlushing = true;

    const batch = this.logBuffer;
    this.logBuffer = [];

    try {
      await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: batch }),
      });
    } catch {
      /* noop — server may be unavailable */
    } finally {
      this.isFlushing = false;
    }
  }
}

export const Logger = new LoggerInstance();
export default Logger;

// Clean up interval on HMR to prevent stacking
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    Logger.destroy();
  });
}

// Clean up interval on page unload (production — no HMR)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    Logger.destroy();
  });
}
