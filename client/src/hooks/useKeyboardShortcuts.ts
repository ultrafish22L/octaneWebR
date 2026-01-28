/**
 * useKeyboardShortcuts Hook
 * Global keyboard shortcut management system
 * 
 * Handles keyboard shortcuts across the application with support for:
 * - Modifier keys (Ctrl, Shift, Alt, Meta)
 * - Prevention of default browser behavior
 * - Multiple shortcut registrations
 * - Platform-specific handling (Cmd on Mac, Ctrl on Windows/Linux)
 */

import { useEffect, useCallback, useRef } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  handler: (event: KeyboardEvent) => void;
  description?: string;
  preventDefault?: boolean;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  preventDefault?: boolean;
}

/**
 * Register global keyboard shortcuts
 * @param shortcuts Array of keyboard shortcut definitions
 * @param options Configuration options
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true, preventDefault = true } = options;
  const shortcutsRef = useRef(shortcuts);

  // Update shortcuts ref when shortcuts change
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Skip if disabled or if typing in an input field
    if (!enabled) return;
    
    const target = event.target as HTMLElement;
    const isInputField = (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    );

    // Find matching shortcut
    for (const shortcut of shortcutsRef.current) {
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatch = (shortcut.ctrl ?? false) === (event.ctrlKey || event.metaKey);
      const shiftMatch = (shortcut.shift ?? false) === event.shiftKey;
      const altMatch = (shortcut.alt ?? false) === event.altKey;

      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        // Allow input fields to use their native shortcuts unless explicitly overridden
        if (isInputField && !shortcut.preventDefault) {
          continue;
        }

        // Prevent default browser behavior if requested
        if (preventDefault || shortcut.preventDefault) {
          event.preventDefault();
          event.stopPropagation();
        }

        // Call the handler
        shortcut.handler(event);
        break; // Only trigger first matching shortcut
      }
    }
  }, [enabled, preventDefault]);

  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [enabled, handleKeyDown]);
}

/**
 * Helper to format shortcut for display
 * @param shortcut Keyboard shortcut definition
 * @returns Formatted string like "Ctrl+S" or "Ctrl+Shift+N"
 */
export function formatShortcut(shortcut: Omit<KeyboardShortcut, 'handler'>): string {
  const parts: string[] = [];
  
  // Detect platform
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  
  if (shortcut.ctrl) parts.push(isMac ? '⌘' : 'Ctrl');
  if (shortcut.shift) parts.push('Shift');
  if (shortcut.alt) parts.push(isMac ? '⌥' : 'Alt');
  if (shortcut.meta) parts.push('Meta');
  
  // Capitalize key for display
  const key = shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key;
  parts.push(key);
  
  return parts.join('+');
}
