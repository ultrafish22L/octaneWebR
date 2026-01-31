/**
 * Skeleton Loader Components
 * Reusable skeleton loaders for better loading UX
 * Used within Suspense boundaries and loading states
 */

import './skeleton.css';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
}

/**
 * Generic skeleton loader
 */
export function Skeleton({ width = '100%', height = 20, className = '' }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    />
  );
}

/**
 * Skeleton for tree items in SceneOutliner
 */
export function SkeletonTreeItem() {
  return (
    <div className="skeleton-tree-item">
      <Skeleton width={16} height={16} className="skeleton-icon" />
      <Skeleton width="60%" height={14} />
    </div>
  );
}

/**
 * Skeleton for tree view (multiple items)
 */
interface SkeletonTreeProps {
  count?: number;
}

export function SkeletonTree({ count = 5 }: SkeletonTreeProps) {
  return (
    <div className="skeleton-tree">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonTreeItem key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for parameter items in NodeInspector
 */
export function SkeletonParameter() {
  return (
    <div className="skeleton-parameter">
      <Skeleton width="40%" height={14} className="skeleton-label" />
      <Skeleton width="100%" height={32} className="skeleton-input" />
    </div>
  );
}

/**
 * Skeleton for parameter list
 */
interface SkeletonParameterListProps {
  count?: number;
}

export function SkeletonParameterList({ count = 8 }: SkeletonParameterListProps) {
  return (
    <div className="skeleton-parameter-list">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonParameter key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for viewport/image loading
 */
export function SkeletonViewport() {
  return (
    <div className="skeleton-viewport">
      <div className="skeleton-viewport-content">
        <Skeleton width={200} height={200} className="skeleton-image" />
        <div className="skeleton-viewport-text">
          <Skeleton width={150} height={16} />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for material cards in MaterialDatabase
 */
export function SkeletonMaterialCard() {
  return (
    <div className="skeleton-material-card">
      <Skeleton width="100%" height={120} className="skeleton-preview" />
      <Skeleton width="80%" height={14} className="skeleton-title" />
    </div>
  );
}

/**
 * Skeleton for material grid
 */
interface SkeletonMaterialGridProps {
  count?: number;
}

export function SkeletonMaterialGrid({ count = 12 }: SkeletonMaterialGridProps) {
  return (
    <div className="skeleton-material-grid">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonMaterialCard key={i} />
      ))}
    </div>
  );
}
