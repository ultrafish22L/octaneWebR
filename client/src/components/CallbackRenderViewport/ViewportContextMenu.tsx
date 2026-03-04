/**
 * Viewport Context Menu Component
 *
 * Context menu for the Render Viewport matching Octane SE behavior:
 * - Appears on right-click (without drag)
 * - Right-click + drag = camera pan (no menu)
 *
 * Actions per Octane SE Manual:
 * - Copy to Clipboard
 * - Save Render
 * - Export Render Passes
 * - Set Background Image
 * - Lock Viewport
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { getGeneralUIIcon, getWindowControlIcon } from '../../constants/UIIconMapping';

interface ViewportContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  onClose: () => void;
  onCopyToClipboard: () => void;
  onSaveRender: () => void;
  onExportPasses: () => void;
  onSetBackgroundImage: () => void;
  onToggleLockViewport: () => void;
  viewportLocked: boolean;
}

export const ViewportContextMenu: React.FC<ViewportContextMenuProps> = ({
  visible,
  x,
  y,
  onClose,
  onCopyToClipboard,
  onSaveRender,
  onExportPasses,
  onSetBackgroundImage,
  onToggleLockViewport,
  viewportLocked,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Focus the menu when it becomes visible
  useEffect(() => {
    if (visible && menuRef.current) {
      menuRef.current.focus();
    }
  }, [visible]);

  const handleMenuClick = (action: () => void) => {
    action();
    onClose();
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const menu = menuRef.current;
        if (!menu) return;
        const items = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]'));
        if (items.length === 0) return;
        const currentIndex = items.indexOf(document.activeElement as HTMLElement);
        let nextIndex: number;
        if (e.key === 'ArrowDown') {
          nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        } else {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        }
        items[nextIndex].focus();
      }
    },
    [onClose]
  );

  if (!visible) return null;

  return (
    <>
      {/* Backdrop to close menu when clicking outside */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 999,
        }}
        role="presentation"
        onClick={onClose}
        onContextMenu={e => {
          e.preventDefault();
          onClose();
        }}
      />

      {/* Context Menu */}
      <div
        ref={menuRef}
        className="context-menu"
        style={{
          position: 'fixed',
          left: `${x}px`,
          top: `${y}px`,
          zIndex: 1000,
        }}
        role="menu"
        aria-label="Viewport context menu"
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <button
          type="button"
          role="menuitem"
          className="context-menu-item"
          onClick={() => handleMenuClick(onCopyToClipboard)}
        >
          <img
            src={getGeneralUIIcon('COPY_TO_CLIPBOARD_IMAGE')}
            alt=""
            style={{ width: 14, height: 14, marginRight: 8 }}
          />
          Copy to Clipboard
        </button>
        <button
          type="button"
          role="menuitem"
          className="context-menu-item"
          onClick={() => handleMenuClick(onSaveRender)}
        >
          <img
            src={getGeneralUIIcon('LOAD_GENERAL')}
            alt=""
            style={{ width: 14, height: 14, marginRight: 8 }}
          />
          Save Render
        </button>
        <button
          type="button"
          role="menuitem"
          className="context-menu-item"
          onClick={() => handleMenuClick(onExportPasses)}
        >
          <img
            src={getGeneralUIIcon('LOAD_ALL')}
            alt=""
            style={{ width: 14, height: 14, marginRight: 8 }}
          />
          Export Render Passes
        </button>
        <div className="context-menu-separator" role="separator" />
        <button
          type="button"
          role="menuitem"
          className="context-menu-item"
          onClick={() => handleMenuClick(onSetBackgroundImage)}
        >
          <img
            src={getGeneralUIIcon('BACKGROUND')}
            alt=""
            style={{ width: 14, height: 14, marginRight: 8 }}
          />
          Set Background Image
        </button>
        <div className="context-menu-separator" role="separator" />
        <button
          type="button"
          role="menuitem"
          className="context-menu-item"
          onClick={() => handleMenuClick(onToggleLockViewport)}
        >
          <img
            src={viewportLocked ? getWindowControlIcon('UNLOCK') : getWindowControlIcon('LOCK')}
            alt=""
            style={{ width: 14, height: 14, marginRight: 8 }}
          />
          {viewportLocked ? 'Unlock Viewport' : 'Lock Viewport'}
        </button>
      </div>
    </>
  );
};
