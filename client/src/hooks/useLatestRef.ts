import { useRef, useEffect } from 'react';

/**
 * Keeps a ref synchronized with the latest value.
 * Replaces the pattern of creating a ref + useEffect to sync it.
 */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}
