/**
 * Status Message Context - Global status message management
 * Provides a way to show live status updates in the status bar
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
} from 'react';

interface StatusMessageContextValue {
  statusMessage: string;
  setStatusMessage: (message: string) => void;
  clearStatusMessage: () => void;
  setTemporaryStatus: (message: string, duration?: number) => void;
}

const StatusMessageContext = createContext<StatusMessageContextValue | null>(null);

const DEFAULT_MESSAGE = 'Ready';

export function StatusMessageProvider({ children }: { children: React.ReactNode }) {
  const [statusMessage, setStatusMessageState] = useState<string>(DEFAULT_MESSAGE);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const setStatusMessage = useCallback((message: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setStatusMessageState(message);
  }, []);

  const clearStatusMessage = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setStatusMessageState(DEFAULT_MESSAGE);
  }, []);

  const setTemporaryStatus = useCallback((message: string, duration: number = 6000) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setStatusMessageState(message);

    timeoutRef.current = setTimeout(() => {
      setStatusMessageState(DEFAULT_MESSAGE);
      timeoutRef.current = null;
    }, duration);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const value = useMemo<StatusMessageContextValue>(
    () => ({
      statusMessage,
      setStatusMessage,
      clearStatusMessage,
      setTemporaryStatus,
    }),
    [statusMessage, setStatusMessage, clearStatusMessage, setTemporaryStatus]
  );

  return <StatusMessageContext.Provider value={value}>{children}</StatusMessageContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStatusMessage(): StatusMessageContextValue {
  const context = useContext(StatusMessageContext);
  if (!context) {
    throw new Error('useStatusMessage must be used within a StatusMessageProvider');
  }
  return context;
}
