import React, { type ErrorInfo } from 'react';
import { ErrorBoundary as ReactErrorBoundary, FallbackProps } from 'react-error-boundary';
import { Logger } from '../../utils/Logger';

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;

  return (
    <div className="error-boundary-fallback">
      <div className="error-content">
        <h2>⚠️ Something went wrong</h2>
        <p className="error-message">{errorMessage}</p>
        <details className="error-details">
          <summary>Error details</summary>
          <pre>{errorStack || 'No stack trace available'}</pre>
        </details>
        <button className="error-reset-button" onClick={resetErrorBoundary}>
          Try again
        </button>
      </div>
    </div>
  );
}

function onError(error: unknown, info: ErrorInfo) {
  Logger.error('Error Boundary caught error:', error);
  Logger.error('Component Stack:', info.componentStack);
}

interface Props {
  children: React.ReactNode;
  fallback?: React.ComponentType<FallbackProps>;
  onReset?: () => void;
}

export function ErrorBoundary({ children, fallback, onReset }: Props) {
  return (
    <ReactErrorBoundary
      FallbackComponent={fallback || ErrorFallback}
      onError={onError}
      onReset={() => {
        if (onReset) {
          onReset();
        } else {
          // Default: reload page
          window.location.reload();
        }
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}
