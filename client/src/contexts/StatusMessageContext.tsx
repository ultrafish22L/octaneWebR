/**
 * Status Message Context - Global status message management
 * Provides a way to show live status updates in the status bar
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

interface StatusMessageContextValue {
  statusMessage: string;
  setStatusMessage: (message: string) => void;
  clearStatusMessage: () => void;
  setTemporaryStatus: (message: string, duration?: number) => void;
}

const StatusMessageContext = createContext<StatusMessageContextValue | null>(null);

const DEFAULT_MESSAGE = 'OctaneWebR - React TypeScript + Node.js gRPC';

export function StatusMessageProvider({ children }: { children: React.ReactNode }) {
  const [statusMessage, setStatusMessageState] = useState<string>(DEFAULT_MESSAGE);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const setStatusMessage = useCallback((message: string) => {
    // Clear any existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setStatusMessageState(message);
  }, [timeoutId]);

  const clearStatusMessage = useCallback(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setStatusMessageState(DEFAULT_MESSAGE);
  }, [timeoutId]);

  const setTemporaryStatus = useCallback((message: string, duration: number = 3000) => {
    // Clear any existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    setStatusMessageState(message);

    // Set new timeout to clear message
    const newTimeoutId = setTimeout(() => {
      setStatusMessageState(DEFAULT_MESSAGE);
      setTimeoutId(null);
    }, duration);

    setTimeoutId(newTimeoutId);
  }, [timeoutId]);

  const value: StatusMessageContextValue = {
    statusMessage,
    setStatusMessage,
    clearStatusMessage,
    setTemporaryStatus,
  };

  return (
    <StatusMessageContext.Provider value={value}>
      {children}
    </StatusMessageContext.Provider>
  );
}

export function useStatusMessage(): StatusMessageContextValue {
  const context = useContext(StatusMessageContext);
  if (!context) {
    throw new Error('useStatusMessage must be used within a StatusMessageProvider');
  }
  return context;
}
