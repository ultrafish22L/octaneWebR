/**
 * Connection Status Component
 * Shows real-time connection state with LED indicator
 */

// React import not needed with new JSX transform
import { useOctane } from '../../hooks/useOctane';

export function ConnectionStatus() {
  const { connected } = useOctane();

  return (
    <div className="connection-status">
      <div
        className={`status-led ${connected ? 'status-led-connected' : 'status-led-disconnected'}`}
      ></div>
      <span className="status-text">{connected ? 'Connected' : 'Disconnected'}</span>
    </div>
  );
}
