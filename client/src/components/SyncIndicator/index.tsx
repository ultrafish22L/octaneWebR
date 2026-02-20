/**
 * Sync Indicator Component
 * Shows an animated rotating arrow with "Syncing" text during scene sync.
 * Only visible when syncing is active.
 */

interface SyncIndicatorProps {
  syncing: boolean;
}

export function SyncIndicator({ syncing }: SyncIndicatorProps) {
  if (!syncing) return null;

  return (
    <div className="sync-indicator">
      <svg
        className="sync-spinner"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Two-arrow circular refresh icon */}
        <path d="M21 2v6h-6" />
        <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
        <path d="M3 22v-6h6" />
        <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      </svg>
      <span className="sync-text">Syncing</span>
    </div>
  );
}
