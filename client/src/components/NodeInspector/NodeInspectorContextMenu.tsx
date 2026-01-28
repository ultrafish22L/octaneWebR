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
      <div
        className="context-menu-item"
        onClick={() => handleMenuItemClick(onSave)}
      >
        Save...
      </div>

      {/* Separator */}
      <div className="context-menu-separator" />

      {/* Cut */}
      <div
        className="context-menu-item"
        onClick={() => handleMenuItemClick(onCut)}
      >
        Cut
      </div>

      {/* Copy */}
      <div
        className="context-menu-item"
        onClick={() => handleMenuItemClick(onCopy)}
      >
        Copy
      </div>

      {/* Paste (disabled for now) */}
      <div
        className="context-menu-item disabled"
        onClick={() => handleMenuItemClick(onPaste, true)}
      >
        Paste
      </div>

      {/* Fill empty node pins */}
      <div
        className="context-menu-item"
        onClick={() => handleMenuItemClick(onFillEmptyPins)}
      >
        Fill empty node pins
      </div>

      {/* Separator */}
      <div className="context-menu-separator" />

      {/* Delete */}
      <div
        className="context-menu-item"
        onClick={() => handleMenuItemClick(onDelete)}
      >
        Delete
      </div>

      {/* Separator */}
      <div className="context-menu-separator" />

      {/* Expand */}
      <div
        className="context-menu-item"
        onClick={() => handleMenuItemClick(onExpand)}
      >
        Expand
      </div>

      {/* Separator */}
      <div className="context-menu-separator" />

      {/* Show in Outliner */}
      <div
        className="context-menu-item"
        onClick={() => handleMenuItemClick(onShowInOutliner)}
      >
        Show in Outliner
      </div>

      {/* Show in Graph Editor */}
      <div
        className="context-menu-item"
        onClick={() => handleMenuItemClick(onShowInGraphEditor)}
      >
        Show in Graph Editor
      </div>

      {/* Show in Lua API browser */}
      <div
        className="context-menu-item"
        onClick={() => handleMenuItemClick(onShowInLuaBrowser)}
      >
        Show in Lua API browser
      </div>
    </div>,
    document.body
  );
}
