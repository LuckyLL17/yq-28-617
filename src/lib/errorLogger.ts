export type ErrorLogLevel = 'error' | 'warning' | 'info';

export interface ErrorLogEntry {
  id: string;
  level: ErrorLogLevel;
  type: string;
  message: string;
  stack?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

const MAX_LOGS = 100;

class ErrorLogger {
  private logs: ErrorLogEntry[] = [];
  private listeners: Set<(logs: ErrorLogEntry[]) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      this.setupGlobalHandlers();
    }
  }

  private setupGlobalHandlers(): void {
    const existingErrorHandler = window.onerror;
    window.onerror = (message, source, lineno, colno, error) => {
      this.log({
        level: 'error',
        type: 'UncaughtError',
        message: typeof message === 'string' ? message : String(message),
        stack: error?.stack,
        metadata: { source, lineno, colno },
      });
      if (existingErrorHandler) {
        return existingErrorHandler.call(window, message, source, lineno, colno, error);
      }
      return false;
    };

    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      this.log({
        level: 'error',
        type: 'UnhandledPromiseRejection',
        message: reason instanceof Error ? reason.message : String(reason ?? 'Unknown rejection'),
        stack: reason instanceof Error ? reason.stack : undefined,
      });
    });
  }

  log(entry: Omit<ErrorLogEntry, 'id' | 'timestamp'>): void {
    const newEntry: ErrorLogEntry = {
      ...entry,
      id: Math.random().toString(36).slice(2, 11),
      timestamp: Date.now(),
    };

    this.logs.unshift(newEntry);
    if (this.logs.length > MAX_LOGS) {
      this.logs = this.logs.slice(0, MAX_LOGS);
    }

    this.notifyListeners();

    if (entry.level === 'error') {
      console.error(`[${entry.type}]`, entry.message, entry.stack ?? '', entry.metadata ?? '');
    } else if (entry.level === 'warning') {
      console.warn(`[${entry.type}]`, entry.message, entry.metadata ?? '');
    } else {
      console.info(`[${entry.type}]`, entry.message, entry.metadata ?? '');
    }
  }

  subscribe(listener: (logs: ErrorLogEntry[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.logs);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener([...this.logs]));
  }

  clear(): void {
    this.logs = [];
    this.notifyListeners();
  }

  getLogs(): ErrorLogEntry[] {
    return [...this.logs];
  }
}

export const errorLogger = new ErrorLogger();

export default errorLogger;
