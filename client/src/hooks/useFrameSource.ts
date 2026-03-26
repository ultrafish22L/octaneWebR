/**
 * Lightweight shared state for the current frame delivery source.
 * Written by the viewport on each frame, read by the SS status indicator.
 */

import { useSyncExternalStore } from 'react';

export type FrameSource = 'dxss' | 'grpc' | null;

let currentSource: FrameSource = null;
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): FrameSource {
  return currentSource;
}

export function setFrameSource(source: FrameSource) {
  if (source === currentSource) return;
  currentSource = source;
  listeners.forEach(cb => cb());
}

export function useFrameSource(): FrameSource {
  return useSyncExternalStore(subscribe, getSnapshot);
}
