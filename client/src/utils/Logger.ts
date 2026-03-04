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

  constructor() {
    const isDev = import.meta.env.MODE === 'development' || import.meta.env.DEV;
    this.level = isDev ? LogLevel.INFO : LogLevel.WARN;
    // Clear server log file on startup
    try {
      fetch('/api/logClear', { method: 'POST' });
    } catch {
      /* noop */
    }

    if (DEBUG_MODE) {
      this.flushInterval = setInterval(() => this.flush(), 1000) as unknown as number;
    }
  }

  // ── Level checks ────────────────────────────────────────────────

  /** Verbose debug — API calls, proto resolution, high-frequency data */
  debugV(...args: unknown[]): void {
    if (this.level < LogLevel.DEBUGV) return;
    console.log(...args);
    this.buffer('debugv', args);
  }

  /** Standard debug — state changes, scene operations */
  debug(...args: unknown[]): void {
    if (this.level < LogLevel.DEBUG) return;
    console.log(...args);
    this.buffer('debug', args);
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

  /** Error — failures (browser renders red) */
  error(...args: unknown[]): void {
    if (this.level < LogLevel.ERROR) return;
    console.error(...args);
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
  network(...args: unknown[]): void {
    this.debug(...args);
  }

  /** Scene operations (debug) */
  scene(...args: unknown[]): void {
    this.debug(...args);
  }

  /** Render events (debug) */
  render(...args: unknown[]): void {
    this.debug(...args);
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
    if (this.logBuffer.length === 0) return;

    const batch = this.logBuffer;
    this.logBuffer = [];

    try {
      await fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: batch[batch.length - 1].level,
          message: batch.map(e => e.message).join('\n'),
        }),
      });
    } catch {
      /* noop */
    }
  }
}

export const Logger = new LoggerInstance();
export default Logger;
