/**
 * Node Type Context Menu Component
 * Hierarchical menu for creating new nodes
 * Matches octaneWeb's NodeGraphEditor.js showContextMenu() functionality
 */

import { Logger } from '../../utils/Logger';
import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getCategoriesInOrder, getNodeTypesForCategory, OCTANE_NODE_TYPES, getNodeIconPath } from '../../constants/NodeTypes';

interface NodeTypeContextMenuProps {
  x: number;
  y: number;
  onSelectNodeType: (nodeType: string) => void;
  onClose: () => void;
}

/**
 * Get icon path for a node type
 * Uses the icon mapping to get actual Octane icon file paths
 */
function getNodeIcon(nodeType: string): string {
  return getNodeIconPath(nodeType);
}

export function NodeTypeContextMenu({
  x,
  y,
  onSelectNodeType,
  onClose,
}: NodeTypeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const categoryElementRef = useRef<HTMLDivElement | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [submenuPosition, setSubmenuPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const categories = getCategoriesInOrder();

  // Close menu on click outside (matching octaneWeb line 167: uses 'click' not 'mousedown')
  // Must check BOTH menuRef and submenuRef since submenu renders as sibling, not child
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const isInsideMenu = menuRef.current?.contains(e.target as Node);
      const isInsideSubmenu = submenuRef.current?.contains(e.target as Node);
      
      if (!isInsideMenu && !isInsideSubmenu) {
        onClose();
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [onClose]);

  // Close menu on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

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

  const handleCategoryMouseEnter = useCallback((category: string, e: React.MouseEvent<HTMLDivElement>) => {
    // Clear any pending hide timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    // Store reference to category element for submenu positioning
    categoryElementRef.current = e.currentTarget;
    setHoveredCategory(category);
    
    // Position submenu to the right of the category item (matching octaneWeb lines 294-313)
    const categoryRect = e.currentTarget.getBoundingClientRect();
    let submenuLeft = categoryRect.right + 2;
    let submenuTop = categoryRect.top;

    setSubmenuPosition({ top: submenuTop, left: submenuLeft });
  }, []);

  const handleCategoryMouseLeave = useCallback(() => {
    // Add delay before hiding to allow moving mouse to submenu
    hideTimeoutRef.current = setTimeout(() => {
      setHoveredCategory(null);
    }, 150); // 150ms delay is standard for hover menus
  }, []);

  const handleSubmenuMouseEnter = useCallback(() => {
    // Keep submenu visible when hovering over it
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const handleSubmenuMouseLeave = useCallback(() => {
    // Hide submenu when mouse leaves it
    setHoveredCategory(null);
  }, []);

  // Adjust submenu position if it goes off-screen (matching octaneWeb lines 300-306)
  useEffect(() => {
    if (!hoveredCategory || !submenuRef.current || !categoryElementRef.current) return;

    // Give submenu a frame to render so we can measure it
    const timeoutId = setTimeout(() => {
      if (!submenuRef.current || !categoryElementRef.current) return;

      const submenuRect = submenuRef.current.getBoundingClientRect();
      let adjustedLeft = submenuPosition.left;
      let adjustedTop = submenuPosition.top;

      // If submenu goes off right edge, show on left side instead
      if (submenuRect.right > window.innerWidth) {
        const categoryRect = categoryElementRef.current.getBoundingClientRect();
        adjustedLeft = categoryRect.left - submenuRect.width - 2;
      }

      // If submenu goes off bottom edge, adjust top position
      if (submenuRect.bottom > window.innerHeight) {
        adjustedTop = window.innerHeight - submenuRect.height;
      }

      if (adjustedLeft !== submenuPosition.left || adjustedTop !== submenuPosition.top) {
        setSubmenuPosition({ top: adjustedTop, left: adjustedLeft });
      }
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [hoveredCategory, submenuPosition]);

  const handleNodeTypeClick = useCallback((nodeType: string) => {
    onSelectNodeType(nodeType);
    onClose();
  }, [onSelectNodeType, onClose]);

  // Render menu to document.body using portal (matching octaneWeb line 319: document.body.appendChild)
  return createPortal(
    <>
      {/* Main menu */}
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
        {categories.map((category, index) => {
          // Handle separator
          if (category === '___SEPARATOR___') {
            return <div key={`sep-${index}`} className="context-menu-separator" />;
          }

          const nodeTypes = getNodeTypesForCategory(category);
          if (!nodeTypes || Object.keys(nodeTypes).length === 0) return null;

          return (
            <div
              key={category}
              className="context-menu-category"
              onMouseEnter={(e) => handleCategoryMouseEnter(category, e)}
              onMouseLeave={handleCategoryMouseLeave}
            >
              {category}
            </div>
          );
        })}
        
        {/* Separator before special items */}
        <div className="context-menu-separator" />
        
        {/* Special menu items */}
        <div 
          className="context-menu-category"
          onMouseEnter={(e) => handleCategoryMouseEnter('__ALL_ITEMS__', e)}
          onMouseLeave={handleCategoryMouseLeave}
        >
          All items
        </div>
        <div className="context-menu-item" onClick={() => Logger.debug('Find type')}>
          Find type...
        </div>
        <div className="context-menu-item" onClick={() => Logger.debug('Import')}>
          Import...
        </div>
        <div className="context-menu-item disabled">
          Paste
        </div>
      </div>

      {/* Render active submenu separately (not nested inside category div) */}
      {hoveredCategory && (() => {
        // Handle "All items" - show all nodes from all categories
        let nodeTypes: Record<string, { name: string; color: string }> | undefined;
        if (hoveredCategory === '__ALL_ITEMS__') {
          nodeTypes = {};
          // Collect all nodes from all categories
          Object.values(OCTANE_NODE_TYPES).forEach(categoryNodes => {
            Object.assign(nodeTypes!, categoryNodes);
          });
        } else {
          nodeTypes = getNodeTypesForCategory(hoveredCategory);
        }
        
        if (!nodeTypes || Object.keys(nodeTypes).length === 0) return null;
        
        const isAllItems = hoveredCategory === '__ALL_ITEMS__';
        
        return (
          <div
            ref={submenuRef}
            className={isAllItems ? "context-submenu-multicolumn" : "context-submenu"}
            onMouseEnter={handleSubmenuMouseEnter}
            onMouseLeave={handleSubmenuMouseLeave}
            style={{
              display: 'block', // Override CSS display: none (matching octaneWeb line 308)
              position: 'fixed',
              left: submenuPosition.left,
              top: submenuPosition.top,
              zIndex: 10001, // Ensure it's above main menu
            }}
          >
            {Object.entries(nodeTypes).map(([nodeType, info]) => (
              <div
                key={nodeType}
                className="context-menu-item"
                onClick={() => handleNodeTypeClick(nodeType)}
                title={nodeType}
              >
                <img
                  src={getNodeIcon(nodeType)}
                  alt=""
                  className="node-type-icon"
                  onError={(e) => {
                    // Fallback to colored square if icon doesn't exist
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLSpanElement;
                    if (fallback) fallback.style.display = 'block';
                  }}
                />
                <span
                  className="node-type-color"
                  style={{ backgroundColor: info.color, display: 'none' }}
                />
                {info.name}
              </div>
            ))}
          </div>
        );
      })()}
    </>,
    document.body // Render to document.body (matching octaneWeb approach)
  );
}
