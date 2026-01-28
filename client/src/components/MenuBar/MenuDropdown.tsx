/**
 * MenuDropdown Component
 * Renders dropdown menus and submenus with proper positioning
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { MenuItem, MenuAction } from './types';

interface MenuDropdownProps {
  items: MenuItem[];
  anchorElement: HTMLElement;
  onItemClick: (action: MenuAction, data?: any) => void | Promise<void>;
  onClose: () => void;
  isSubmenu?: boolean;
}

export function MenuDropdown({ 
  items, 
  anchorElement, 
  onItemClick, 
  onClose,
  isSubmenu = false 
}: MenuDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [submenuAnchor, setSubmenuAnchor] = useState<HTMLElement | null>(null);
  const submenuTimer = useRef<number | null>(null);

  // Position dropdown relative to anchor
  useEffect(() => {
    if (!dropdownRef.current) return;

    const rect = anchorElement.getBoundingClientRect();
    const dropdown = dropdownRef.current;

    if (isSubmenu) {
      // Position submenu to the right of parent item
      dropdown.style.position = 'fixed';
      dropdown.style.left = `${rect.right}px`;
      dropdown.style.top = `${rect.top}px`;
      dropdown.style.zIndex = '10001';
    } else {
      // Position dropdown below menu item
      dropdown.style.position = 'fixed';
      dropdown.style.left = `${rect.left}px`;
      dropdown.style.top = `${rect.bottom}px`;
      dropdown.style.zIndex = '10000';
    }

    // Adjust if dropdown would go off-screen
    requestAnimationFrame(() => {
      const dropdownRect = dropdown.getBoundingClientRect();

      // Adjust horizontal position
      if (dropdownRect.right > window.innerWidth) {
        if (isSubmenu) {
          dropdown.style.left = `${rect.left - dropdownRect.width}px`;
        } else {
          dropdown.style.left = `${rect.right - dropdownRect.width}px`;
        }
      }

      // Adjust vertical position
      if (dropdownRect.bottom > window.innerHeight) {
        if (isSubmenu) {
          dropdown.style.top = `${rect.bottom - dropdownRect.height}px`;
        } else {
          dropdown.style.top = `${rect.top - dropdownRect.height}px`;
        }
      }
    });
  }, [anchorElement, isSubmenu]);

  const handleItemClick = useCallback((item: MenuItem) => {
    if (item.enabled === false) return;
    if (item.submenu && item.submenu.length > 0) return;
    
    if (item.action) {
      onItemClick(item.action as MenuAction, item.data);
    }
  }, [onItemClick]);

  const handleItemMouseEnter = useCallback((item: MenuItem, element: HTMLElement) => {
    // Clear any pending submenu close
    if (submenuTimer.current) {
      clearTimeout(submenuTimer.current);
      submenuTimer.current = null;
    }

    if (item.submenu && item.submenu.length > 0 && item.action) {
      setActiveSubmenu(item.action);
      setSubmenuAnchor(element);
    } else {
      setActiveSubmenu(null);
      setSubmenuAnchor(null);
    }
  }, []);

  const handleItemMouseLeave = useCallback(() => {
    // Delay hiding submenu to allow mouse movement
    submenuTimer.current = window.setTimeout(() => {
      setActiveSubmenu(null);
      setSubmenuAnchor(null);
    }, 100);
  }, []);

  const renderMenuItem = (item: MenuItem, index: number) => {
    if (item.type === 'separator') {
      return <div key={`sep-${index}`} className="context-menu-separator" />;
    }

    const isDisabled = item.enabled === false;
    const hasSubmenu = item.submenu && item.submenu.length > 0;
    const isActive = activeSubmenu === item.action;

    return (
      <div
        key={item.action || `item-${index}`}
        className={`context-menu-item ${isDisabled ? 'disabled' : ''} ${hasSubmenu ? 'has-submenu' : ''} ${isActive ? 'active' : ''}`}
        onClick={() => !isDisabled && handleItemClick(item)}
        onMouseEnter={(e) => handleItemMouseEnter(item, e.currentTarget)}
        onMouseLeave={handleItemMouseLeave}
      >
        {item.checked !== undefined && (
          <span className="context-menu-check">{item.checked ? '✓' : ' '}</span>
        )}
        {item.icon && <span className="context-menu-icon">{item.icon}</span>}
        <span className="context-menu-label">{item.label}</span>
        {item.shortcut && <span className="context-menu-shortcut">{item.shortcut}</span>}
        {hasSubmenu && <span className="context-menu-arrow">▶</span>}
      </div>
    );
  };

  const activeSubmenuItem = items.find(item => item.action === activeSubmenu);

  return (
    <>
      <div ref={dropdownRef} className={`context-menu menu-dropdown ${isSubmenu ? 'submenu' : ''}`}>
        {items.map((item, index) => renderMenuItem(item, index))}
      </div>

      {/* Render active submenu */}
      {activeSubmenuItem && activeSubmenuItem.submenu && submenuAnchor && (
        <MenuDropdown
          items={activeSubmenuItem.submenu}
          anchorElement={submenuAnchor}
          onItemClick={onItemClick}
          onClose={onClose}
          isSubmenu={true}
        />
      )}
    </>
  );
}
