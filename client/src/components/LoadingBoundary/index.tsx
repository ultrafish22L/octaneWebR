/**
 * LoadingBoundary Component
 * Enhanced Suspense boundary with context-aware loading states
 * Can render skeleton loaders or custom fallbacks
 */

import { Suspense, ReactNode, useState, useEffect } from 'react';
import { LoadingFallback } from '../LoadingFallback';
import {
  SkeletonTree,
  SkeletonParameterList,
  SkeletonViewport,
  SkeletonMaterialGrid,
} from '../Skeleton';

export type LoadingType = 'spinner' | 'tree' | 'parameters' | 'viewport' | 'materials' | 'custom';

interface LoadingBoundaryProps {
  children: ReactNode;
  type?: LoadingType;
  name?: string;
  fallback?: ReactNode;
  /** Minimum time to show loading state (prevents flash) */
  minLoadingTime?: number;
}

/**
 * Get appropriate fallback component based on loading type
 */
function getDefaultFallback(type: LoadingType, name?: string): ReactNode {
  switch (type) {
    case 'tree':
      return <SkeletonTree count={8} />;
    case 'parameters':
      return <SkeletonParameterList count={10} />;
    case 'viewport':
      return <SkeletonViewport />;
    case 'materials':
      return <SkeletonMaterialGrid count={12} />;
    case 'spinner':
    default:
      return <LoadingFallback name={name} />;
  }
}

/**
 * DelayedFallback - Prevents loading flashes for fast operations
 * Only shows fallback if loading takes longer than delay
 */
interface DelayedFallbackProps {
  children: ReactNode;
  delay: number;
}

function DelayedFallback({ children, delay }: DelayedFallbackProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return show ? <>{children}</> : null;
}

/**
 * LoadingBoundary - Suspense wrapper with type-aware fallbacks
 *
 * Usage:
 * ```tsx
 * <LoadingBoundary type="tree" name="Scene Tree">
 *   <SceneOutliner />
 * </LoadingBoundary>
 * ```
 */
export function LoadingBoundary({
  children,
  type = 'spinner',
  name,
  fallback,
  minLoadingTime,
}: LoadingBoundaryProps) {
  const defaultFallback = getDefaultFallback(type, name);
  const finalFallback = fallback || defaultFallback;

  // If minLoadingTime is specified, wrap fallback with delay
  const delayedFallback = minLoadingTime ? (
    <DelayedFallback delay={minLoadingTime}>{finalFallback}</DelayedFallback>
  ) : (
    finalFallback
  );

  return <Suspense fallback={delayedFallback}>{children}</Suspense>;
}
