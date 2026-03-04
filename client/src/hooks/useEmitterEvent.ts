/**
 * useEmitterEvent Hook
 * Subscribe to an EventEmitter event with automatic cleanup on unmount.
 * Replaces manual on()/off() boilerplate in useEffect blocks.
 */

import { useEffect, useRef } from 'react';
import { EventEmitter } from '../utils/EventEmitter';

/**
 * Subscribe to an event on an EventEmitter. The handler is automatically
 * registered on mount (or when dependencies change) and unregistered on
 * cleanup. A stable ref is used so the handler identity can change between
 * renders without causing re-subscription.
 *
 * @param emitter  The EventEmitter instance (typically `client` from useOctane)
 * @param event    Event name string
 * @param handler  Callback — may be an inline arrow; ref keeps it stable
 */
export function useEmitterEvent(
  emitter: EventEmitter | null | undefined,
  event: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (...args: any[]) => void
): void {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!emitter) return;

    const wrapped = (...args: unknown[]) => handlerRef.current(...args);
    emitter.on(event, wrapped);
    return () => {
      emitter.off(event, wrapped);
    };
  }, [emitter, event]);
}
