/**
 * Node Context Menu Component
 * Context menu displayed when right-clicking on nodes in the graph editor
 * Provides full node operations matching Octane SE
 *
 * ReactFlow v12 Best Practices:
 * - Uses createPortal for proper rendering outside parent DOM
 * - Screen boundary detection to keep menu visible
 * - Standardized click event handling
 * - Proper disabled state prevents clicks
 */

import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface NodeContextMenuProps {
  x: number;
  y: number;
  selectedNodeCount: number;
  onRenderNode: () => void;
  onSaveAsMacro: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDeleteSelected: () => void;
  onCollapseItems: () => void;
  onExpandItems: () => void;
  onGroupItems: () => void;
  onShowInOutliner: () => void;
  onShowInLuaBrowser: () => void;
  onClose: () => void;
}

export function NodeContextMenu({
  x,
  y,
  selectedNodeCount,
  onRenderNode,
  onSaveAsMacro,
  onCut,
  onCopy,
  onPaste,
  onDeleteSelected,
  onCollapseItems,
  onExpandItems,
  onGroupItems,
  onShowInOutliner,
  onShowInLuaBrowser,
  onClose,
}: NodeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Focus the menu when mounted
  useEffect(() => {
    menuRef.current?.focus();
  }, []);

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

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [onClose]);

  // Adjust menu position to stay on screen
  useEffect(() => {
    if (!menuRef.current) return;

    const rect = menuRef.current.getBoundingClientRect();
    let adjustedX = x;
    let adjustedY = y;

    // Keep menu on screen
    if (rect.right > window.innerWidth) {
      adjustedX = x - rect.width;
    }
    if (rect.bottom > window.innerHeight) {
      adjustedY = y - rect.height;
    }

    if (adjustedX !== x || adjustedY !== y) {
      menuRef.current.style.left = `${adjustedX}px`;
      menuRef.current.style.top = `${adjustedY}px`;
    }
  }, [x, y]);

  const handleMenuItemClick = (action: () => void, disabled = false) => {
    if (disabled) return;
    action();
    onClose();
  };

  // Render to document.body using portal
  return createPortal(
    <div
      ref={menuRef}
      className="node-context-menu"
      role="menu"
      aria-label="Node context menu"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 10000,
      }}
    >
      <button
        type="button"
        role="menuitem"
        className="context-menu-item"
        onClick={() => handleMenuItemClick(onRenderNode)}
      >
        Render
      </button>
      <button
        type="button"
        role="menuitem"
        className="context-menu-item"
        onClick={() => handleMenuItemClick(onSaveAsMacro)}
      >
        Save...
      </button>

      <div className="context-menu-separator" role="separator" />

      <button
        type="button"
        role="menuitem"
        className="context-menu-item"
        onClick={() => handleMenuItemClick(onCut)}
      >
        Cut
      </button>
      <button
        type="button"
        role="menuitem"
        className="context-menu-item"
        onClick={() => handleMenuItemClick(onCopy)}
      >
        Copy
      </button>
      <button
        type="button"
        role="menuitem"
        className="context-menu-item"
        onClick={() => handleMenuItemClick(onPaste)}
      >
        Paste
      </button>

      <div className="context-menu-separator" role="separator" />

      <button
        type="button"
        role="menuitem"
        className="context-menu-item"
        onClick={() => handleMenuItemClick(onDeleteSelected)}
      >
        Delete
      </button>

      <div className="context-menu-separator" role="separator" />

      <button
        type="button"
        role="menuitem"
        className="context-menu-item"
        onClick={() => handleMenuItemClick(onCollapseItems)}
      >
        Collapse items
      </button>
      <button
        type="button"
        role="menuitem"
        className="context-menu-item"
        onClick={() => handleMenuItemClick(onExpandItems)}
      >
        Expand items
      </button>
      <button
        type="button"
        role="menuitem"
        className={`context-menu-item ${selectedNodeCount < 2 ? 'disabled' : ''}`}
        aria-disabled={selectedNodeCount < 2}
        onClick={() => handleMenuItemClick(onGroupItems, selectedNodeCount < 2)}
      >
        Group items
      </button>

      <div className="context-menu-separator" role="separator" />

      <button
        type="button"
        role="menuitem"
        className="context-menu-item"
        onClick={() => handleMenuItemClick(onShowInOutliner)}
      >
        Show in Outliner
      </button>
      <button
        type="button"
        role="menuitem"
        className="context-menu-item"
        onClick={() => handleMenuItemClick(onShowInLuaBrowser)}
      >
        Show in Lua API browser
      </button>
    </div>,
    document.body
  );
}
