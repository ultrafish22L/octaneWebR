/**
 * useNodeGraphToolbar Hook
 * Manages node graph editor toolbar state: grid visibility,
 * snap-to-grid, and imperative callbacks from the graph editor.
 * Extracted from App.tsx to reduce state concentration.
 */

import { useState, useCallback } from 'react';

export function useNodeGraphToolbar() {
  const [gridVisible, setGridVisible] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [recenterViewCallback, setRecenterViewCallback] = useState<(() => void) | null>(null);
  const [autoLayoutCallback, setAutoLayoutCallback] = useState<(() => void) | null>(null);

  const handleRecenterViewReady = useCallback(
    (cb: (() => void) | null) => setRecenterViewCallback(() => cb),
    []
  );

  const handleAutoLayoutReady = useCallback(
    (cb: (() => void) | null) => setAutoLayoutCallback(() => cb),
    []
  );

  return {
    gridVisible,
    setGridVisible,
    snapToGrid,
    setSnapToGrid,
    recenterViewCallback,
    autoLayoutCallback,
    handleRecenterViewReady,
    handleAutoLayoutReady,
  };
}
