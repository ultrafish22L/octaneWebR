/**
 * Scene Outliner Context Menu Component
 * Right-click context menu for scene outliner items
 * Matches Octane SE scene outliner context menu exactly
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface SceneOutlinerContextMenuProps {
  x: number;
  y: number;
  onRender: () => void;
  onSave: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onExpand: () => void;
  onShowInGraphEditor: () => void;
  onShowInLuaBrowser: () => void;
  onClose: () => void;
}

export function SceneOutlinerContextMenu({
  x,
  y,
  onRender,
  onSave,
  onCut,
  onCopy,
  onPaste,
  onDelete,
  onExpand,
  onShowInGraphEditor,
  onShowInLuaBrowser,
  onClose,
}: SceneOutlinerContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // Delay adding the listener to prevent immediate closure
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Close menu on Escape key
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [onClose]);

  const handleMenuItemClick = (callback: () => void, disabled = false) => {
    if (disabled) return;
    callback();
    onClose();
  };

  // Render to document.body using portal
  return createPortal(
    <div
      ref={menuRef}
      className="node-context-menu"
      role="menu"
      aria-label="Scene outliner context menu"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 10000,
      }}
    >
      {/* Render */}
      <button
        type="button"
        className="context-menu-item"
        role="menuitem"
        onClick={() => handleMenuItemClick(onRender)}
      >
        Render
      </button>

      {/* Save... */}
      <button
        type="button"
        className="context-menu-item"
        role="menuitem"
        onClick={() => handleMenuItemClick(onSave)}
      >
        Save...
      </button>

      {/* Separator */}
      <div className="context-menu-separator" role="separator" />

      {/* Cut */}
      <button
        type="button"
        className="context-menu-item"
        role="menuitem"
        onClick={() => handleMenuItemClick(onCut)}
      >
        Cut
      </button>

      {/* Copy */}
      <button
        type="button"
        className="context-menu-item"
        role="menuitem"
        onClick={() => handleMenuItemClick(onCopy)}
      >
        Copy
      </button>

      {/* Paste */}
      <button
        type="button"
        className="context-menu-item"
        role="menuitem"
        onClick={() => handleMenuItemClick(onPaste)}
      >
        Paste
      </button>

      {/* Separator */}
      <div className="context-menu-separator" role="separator" />

      {/* Delete */}
      <button
        type="button"
        className="context-menu-item"
        role="menuitem"
        onClick={() => handleMenuItemClick(onDelete)}
      >
        Delete
      </button>

      {/* Separator */}
      <div className="context-menu-separator" role="separator" />

      {/* Expand */}
      <button
        type="button"
        className="context-menu-item"
        role="menuitem"
        onClick={() => handleMenuItemClick(onExpand)}
      >
        Expand
      </button>

      {/* Separator */}
      <div className="context-menu-separator" role="separator" />

      {/* Show in Graph Editor */}
      <button
        type="button"
        className="context-menu-item"
        role="menuitem"
        onClick={() => handleMenuItemClick(onShowInGraphEditor)}
      >
        Show in Graph Editor
      </button>

      {/* Show in Lua API browser */}
      <button
        type="button"
        className="context-menu-item"
        role="menuitem"
        onClick={() => handleMenuItemClick(onShowInLuaBrowser)}
      >
        Show in Lua API browser
      </button>
    </div>,
    document.body
  );
}
