/**
 * Shared Surface Status Indicator
 * Shows whether frames are arriving via dxSS (GPU DMA) or standard gRPC pixel path.
 */

import { useFrameSource } from '../../hooks/useFrameSource';
import { useOctane } from '../../hooks/useOctane';

export function SharedSurfaceIndicator() {
  const { connected } = useOctane();
  const source = useFrameSource();

  if (!connected) return null;

  const isDxSS = source === 'dxss';

  return (
    <div
      className="ss-indicator"
      title={isDxSS ? 'Shared Surface (GPU DMA)' : 'Standard pixel path (gRPC)'}
    >
      <div className={`ss-led ${isDxSS ? 'ss-led-active' : 'ss-led-inactive'}`} />
      <span className="ss-label">{isDxSS ? 'SS' : 'PX'}</span>
    </div>
  );
}
