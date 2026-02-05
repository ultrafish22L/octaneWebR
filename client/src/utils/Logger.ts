/**
 * Centralized logging utility for OctaneWebR
 * Provides environment-aware logging with configurable log levels
 *
 * DEBUG_MODE controls server-side file logging to /tmp/octaneWebR_client.log
 * Set to true to enable, false to disable
 */

// Debug mode flag - when true, sends logs to /api/log endpoint for file logging
const DEBUG_MODE = false;

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  DEBUGV = 4,
  NONE = 5,
}

export interface LoggerConfig {
  level: LogLevel;
  prefix?: string;
  timestamp?: boolean;
  colors?: boolean;
}

interface LogEntry {
  level: string;
  message: string;
  timestamp: number;
}

class LoggerInstance {
  private config: LoggerConfig;
  private readonly isDevelopment: boolean;
  private logBuffer: LogEntry[] = [];
  private flushInterval: number | null = null;
  private readonly MAX_BUFFER_SIZE = 100;
  private readonly FLUSH_INTERVAL_MS = 1000;

  constructor() {
    // Detect environment
    this.isDevelopment = import.meta.env.MODE === 'development' || import.meta.env.DEV;

    // Default configuration
    this.config = {
      level: this.isDevelopment ? LogLevel.INFO : LogLevel.WARN,
      prefix: '[OctaneWebR]',
      timestamp: this.isDevelopment,
      colors: true,
    };

    try {
      // Send to server endpoint (handled by vite-plugin-octane-grpc.ts in dev mode)
      fetch('/api/logClear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch {
      // Silently fail if endpoint not available (e.g., production mode)
      // Don't log to avoid infinite loop
    }

    // Start flush timer if DEBUG_MODE is enabled
    if (DEBUG_MODE) {
      this.startFlushTimer();
    }
  }

  /**
   * Configure logger settings
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.config.level;
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * Start the timer to flush logs to server
   */
  private startFlushTimer(): void {
    if (this.flushInterval) return;

    this.flushInterval = setInterval(() => {
      this.flushLogs();
    }, this.FLUSH_INTERVAL_MS) as unknown as number;
  }

  /**
   * Stop the flush timer
   */
  private stopFlushTimer(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  /**
   * Add log entry to buffer for server-side file logging
   */
  private addToBuffer(level: string, ...args: unknown[]): void {
    if (!DEBUG_MODE) return;

    // Format args to string
    const message = args
      .map(arg => {
        if (typeof arg === 'string') return arg;
        if (arg instanceof Error) return arg.stack || arg.message;
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      })
      .join(' ');

    this.logBuffer.push({
      level,
      message,
      timestamp: Date.now(),
    });

    // Flush immediately if buffer is full
    if (this.logBuffer.length >= this.MAX_BUFFER_SIZE) {
      this.flushLogs();
    }
  }

  /**
   * Flush log buffer to server endpoint
   */
  private async flushLogs(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    const logsToSend = [...this.logBuffer];
    this.logBuffer = [];

    try {
      // Send to server endpoint (handled by vite-plugin-octane-grpc.ts in dev mode)
      await fetch('/api/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          level: logsToSend[logsToSend.length - 1].level,
          message: logsToSend.map(log => `[${log.level.toUpperCase()}] ${log.message}`).join('\n'),
        }),
      });
    } catch {
      // Silently fail if endpoint not available (e.g., production mode)
      // Don't log to avoid infinite loop
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopFlushTimer();
    this.flushLogs(); // Final flush
  }

  /**
   * Format log message with prefix and timestamp
   */
  private formatMessage(icon: string, ...args: unknown[]): unknown[] {
    const parts: string[] = [];

    if (this.config.prefix) {
      parts.push(this.config.prefix);
    }

    if (this.config.timestamp) {
      const time = new Date().toLocaleTimeString();
      parts.push(`[${time}]`);
    }

    if (this.config.colors) {
      parts.push(icon);
    }

    const prefix = parts.length > 0 ? parts.join(' ') : '';
    return prefix ? [prefix, ...args] : args;
  }

  /**
   * Debug Verbose level logging (development only)
   */
  debugV(...args: unknown[]): void {
    if (this.config.level >= LogLevel.DEBUGV) {
      console.log(...this.formatMessage('🔍', ...args));
      this.addToBuffer('debug', ...args);
    }
  }
  
  /**
   * Debug level logging (development only)
   */
  debug(...args: unknown[]): void {
    if (this.config.level <= LogLevel.DEBUG) {
      console.log(...this.formatMessage('🔍', ...args));
      this.addToBuffer('debug', ...args);
    }
  }

  /**
   * Info level logging
   */
  info(...args: unknown[]): void {
    if (this.config.level <= LogLevel.INFO) {
      console.log(...this.formatMessage('ℹ️', ...args));
      this.addToBuffer('info', ...args);
    }
  }

  /**
   * Success logging (special case of info)
   */
  success(...args: unknown[]): void {
    if (this.config.level <= LogLevel.INFO) {
      console.log(...this.formatMessage('✅', ...args));
      this.addToBuffer('info', ...args);
    }
  }

  /**
   * Warning level logging
   */
  warn(...args: unknown[]): void {
    if (this.config.level <= LogLevel.WARN) {
      console.warn(...this.formatMessage('⚠️', ...args));
      this.addToBuffer('warn', ...args);
    }
  }

  /**
   * Error level logging
   */
  error(...args: unknown[]): void {
    if (this.config.level <= LogLevel.ERROR) {
      console.error(...this.formatMessage('❌', ...args));
      this.addToBuffer('error', ...args);
    }
  }

  /**
   * Group logging (for nested logs)
   */
  group(label: string): void {
    if (this.config.level <= LogLevel.DEBUG) {
      console.group(...this.formatMessage('📁', label));
    }
  }

  /**
   * End group logging
   */
  groupEnd(): void {
    if (this.config.level <= LogLevel.DEBUG) {
      console.groupEnd();
    }
  }

  /**
   * API call logging (specialized debug)
   */
  api(service: string, method: string, handle?: unknown): void {
    if (this.config.level <= LogLevel.DEBUG) {
      const handleStr = handle ? `(handle: ${handle})` : '';
      this.debugV(`📤 ${service}.${method}`, handleStr);
    }
  }

  /**
   * Network logging (specialized debug)
   */
  network(message: string, ...args: unknown[]): void {
    if (this.config.level <= LogLevel.DEBUG) {
      console.log(...this.formatMessage('📡', message, ...args));
    }
  }

  /**
   * Scene logging (specialized debug)
   */
  scene(message: string, ...args: unknown[]): void {
    if (this.config.level <= LogLevel.DEBUG) {
      console.log(...this.formatMessage('🌲', message, ...args));
    }
  }

  /**
   * Render logging (specialized debug)
   */
  render(message: string, ...args: unknown[]): void {
    if (this.config.level <= LogLevel.DEBUG) {
      console.log(...this.formatMessage('🎬', message, ...args));
    }
  }
}

// Export singleton instance
export const Logger = new LoggerInstance();

// Export default for convenience
export default Logger;
