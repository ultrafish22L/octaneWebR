/**
 * Node Inspector Context Menu Component
 * Right-click context menu for node inspector panel
 * Matches Octane SE node inspector context menu exactly
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface NodeInspectorContextMenuProps {
  x: number;
  y: number;
  onSave: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onFillEmptyPins: () => void;
  onDelete: () => void;
  onExpand: () => void;
  onShowInOutliner: () => void;
  onShowInGraphEditor: () => void;
  onShowInLuaBrowser: () => void;
  onClose: () => void;
}

export function NodeInspectorContextMenu({
  x,
  y,
  onSave,
  onCut,
  onCopy,
  onPaste,
  onFillEmptyPins,
  onDelete,
  onExpand,
  onShowInOutliner,
  onShowInGraphEditor,
  onShowInLuaBrowser,
  onClose,
}: NodeInspectorContextMenuProps) {
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
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 10000,
      }}
    >
      {/* Save... */}
      <button
        type="button"
        className="context-menu-item"
        onClick={() => handleMenuItemClick(onSave)}
      >
        Save...
      </button>

      {/* Separator */}
      <div className="context-menu-separator" />

      {/* Cut */}
      <button
        type="button"
        className="context-menu-item"
        onClick={() => handleMenuItemClick(onCut)}
      >
        Cut
      </button>

      {/* Copy */}
      <button
        type="button"
        className="context-menu-item"
        onClick={() => handleMenuItemClick(onCopy)}
      >
        Copy
      </button>

      {/* Paste (disabled for now) */}
      <button
        type="button"
        className="context-menu-item disabled"
        onClick={() => handleMenuItemClick(onPaste, true)}
      >
        Paste
      </button>

      {/* Fill empty node pins */}
      <button
        type="button"
        className="context-menu-item"
        onClick={() => handleMenuItemClick(onFillEmptyPins)}
      >
        Fill empty node pins
      </button>

      {/* Separator */}
      <div className="context-menu-separator" />

      {/* Delete */}
      <button
        type="button"
        className="context-menu-item"
        onClick={() => handleMenuItemClick(onDelete)}
      >
        Delete
      </button>

      {/* Separator */}
      <div className="context-menu-separator" />

      {/* Expand */}
      <button
        type="button"
        className="context-menu-item"
        onClick={() => handleMenuItemClick(onExpand)}
      >
        Expand
      </button>

      {/* Separator */}
      <div className="context-menu-separator" />

      {/* Show in Outliner */}
      <button
        type="button"
        className="context-menu-item"
        onClick={() => handleMenuItemClick(onShowInOutliner)}
      >
        Show in Outliner
      </button>

      {/* Show in Graph Editor */}
      <button
        type="button"
        className="context-menu-item"
        onClick={() => handleMenuItemClick(onShowInGraphEditor)}
      >
        Show in Graph Editor
      </button>

      {/* Show in Lua API browser */}
      <button
        type="button"
        className="context-menu-item"
        onClick={() => handleMenuItemClick(onShowInLuaBrowser)}
      >
        Show in Lua API browser
      </button>
    </div>,
    document.body
  );
}
