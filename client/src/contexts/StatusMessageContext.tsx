/**
 * Status Message Context - Global status message management
 * Provides a way to show live status updates in the status bar.
 *
 * Split into two contexts so that the 11+ components that only call
 * setTemporaryStatus/setStatusMessage don't re-render when the message changes.
 * Only the status bar (App.tsx) subscribes to the value context.
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

interface StatusMessageActions {
  setStatusMessage: (message: string) => void;
  clearStatusMessage: () => void;
  setTemporaryStatus: (message: string, duration?: number) => void;
}

interface StatusMessageContextValue extends StatusMessageActions {
  statusMessage: string;
}

// Value context — only subscribe if you need to READ the current message
const StatusMessageValueContext = createContext<string | null>(null);

// Actions context — subscribe here if you only need to SET messages (no re-render on change)
const StatusMessageActionsContext = createContext<StatusMessageActions | null>(null);

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

  const actions = useMemo<StatusMessageActions>(
    () => ({ setStatusMessage, clearStatusMessage, setTemporaryStatus }),
    [setStatusMessage, clearStatusMessage, setTemporaryStatus]
  );

  return (
    <StatusMessageActionsContext.Provider value={actions}>
      <StatusMessageValueContext.Provider value={statusMessage}>
        {children}
      </StatusMessageValueContext.Provider>
    </StatusMessageActionsContext.Provider>
  );
}

/**
 * Full context — use when you need BOTH the current message AND setters.
 * Components using this WILL re-render on every message change.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useStatusMessage(): StatusMessageContextValue {
  const statusMessage = useContext(StatusMessageValueContext);
  const actions = useContext(StatusMessageActionsContext);
  if (statusMessage === null || !actions) {
    throw new Error('useStatusMessage must be used within a StatusMessageProvider');
  }
  return { statusMessage, ...actions };
}

/**
 * Actions-only hook — use when you only need to SET messages (not read them).
 * Components using this will NOT re-render when the message changes.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useStatusActions(): StatusMessageActions {
  const actions = useContext(StatusMessageActionsContext);
  if (!actions) {
    throw new Error('useStatusActions must be used within a StatusMessageProvider');
  }
  return actions;
}
