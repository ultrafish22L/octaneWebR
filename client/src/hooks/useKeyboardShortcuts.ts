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

import { useEffect, useCallback, useRef, useMemo } from 'react';

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

/** Build a composite key for O(1) shortcut lookup: "ctrl+shift+key" */
function shortcutKey(key: string, ctrl: boolean, shift: boolean, alt: boolean): string {
  return `${ctrl ? 'c' : ''}${shift ? 's' : ''}${alt ? 'a' : ''}:${key.toLowerCase()}`;
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

  // Build O(1) lookup map, rebuilt when shortcuts array identity changes
  const shortcutMap = useMemo(() => {
    const map = new Map<string, KeyboardShortcut>();
    for (const s of shortcuts) {
      const k = shortcutKey(s.key, s.ctrl ?? false, s.shift ?? false, s.alt ?? false);
      map.set(k, s);
    }
    return map;
  }, [shortcuts]);
  const shortcutMapRef = useRef(shortcutMap);
  useEffect(() => {
    shortcutMapRef.current = shortcutMap;
  }, [shortcutMap]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Skip if disabled or if typing in an input field
      if (!enabled) return;

      const target = event.target as HTMLElement | null;
      const isInputField =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      // O(1) lookup by composite key
      const k = shortcutKey(
        event.key,
        event.ctrlKey || event.metaKey,
        event.shiftKey,
        event.altKey
      );
      const shortcut = shortcutMapRef.current.get(k);

      if (shortcut) {
        // Allow input fields to use their native shortcuts unless explicitly overridden
        if (isInputField && !shortcut.preventDefault) {
          return;
        }

        // Prevent default browser behavior if requested
        if (preventDefault || shortcut.preventDefault) {
          event.preventDefault();
          event.stopPropagation();
        }

        // Call the handler
        shortcut.handler(event);
      }
    },
    [enabled, preventDefault]
  );

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

  const isMac = /mac/i.test(navigator.platform);

  if (shortcut.ctrl) parts.push(isMac ? '\u2318' : 'Ctrl');
  if (shortcut.shift) parts.push(isMac ? '\u21E7' : 'Shift');
  if (shortcut.alt) parts.push(isMac ? '\u2325' : 'Alt');
  if (shortcut.meta) parts.push('Meta');

  // Capitalize key for display
  const key = shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key;
  parts.push(key);

  return parts.join('+');
}
