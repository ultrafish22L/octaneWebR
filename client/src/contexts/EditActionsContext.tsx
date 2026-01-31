/**
 * Edit Actions Context
 * Provides global access to edit actions (cut, copy, paste, delete, group, ungroup, find)
 * Allows MenuBar to trigger actions that are handled by the currently focused component
 */

import { Logger } from '../utils/Logger';
import { createContext, useContext, useRef, useCallback, ReactNode } from 'react';

export interface EditActionsHandler {
  cut?: () => void;
  copy?: () => void;
  paste?: () => void;
  delete?: () => void;
  group?: () => void;
  ungroup?: () => void;
  find?: () => void;
}

export interface EditActionsContextType {
  // eslint-disable-next-line no-unused-vars
  registerHandlers: (handlers: EditActionsHandler) => void;
  unregisterHandlers: () => void;
  cut: () => void;
  copy: () => void;
  paste: () => void;
  delete: () => void;
  group: () => void;
  ungroup: () => void;
  find: () => void;
}

const EditActionsContext = createContext<EditActionsContextType | undefined>(undefined);

export function EditActionsProvider({ children }: { children: ReactNode }) {
  const handlersRef = useRef<EditActionsHandler>({});

  const registerHandlers = useCallback((newHandlers: EditActionsHandler) => {
    handlersRef.current = newHandlers;
  }, []);

  const unregisterHandlers = useCallback(() => {
    handlersRef.current = {};
  }, []);

  const cut = useCallback(() => {
    if (handlersRef.current.cut) {
      handlersRef.current.cut();
    } else {
      Logger.debug('✂️ Cut action - no handler registered');
    }
  }, []);

  const copy = useCallback(() => {
    if (handlersRef.current.copy) {
      handlersRef.current.copy();
    } else {
      Logger.debug('📋 Copy action - no handler registered');
    }
  }, []);

  const paste = useCallback(() => {
    if (handlersRef.current.paste) {
      handlersRef.current.paste();
    } else {
      Logger.debug('📋 Paste action - no handler registered');
    }
  }, []);

  const deleteAction = useCallback(() => {
    if (handlersRef.current.delete) {
      handlersRef.current.delete();
    } else {
      Logger.debug('🗑️ Delete action - no handler registered');
    }
  }, []);

  const group = useCallback(() => {
    if (handlersRef.current.group) {
      handlersRef.current.group();
    } else {
      Logger.debug('🔗 Group action - no handler registered');
    }
  }, []);

  const ungroup = useCallback(() => {
    if (handlersRef.current.ungroup) {
      handlersRef.current.ungroup();
    } else {
      Logger.debug('🔓 Ungroup action - no handler registered');
    }
  }, []);

  const find = useCallback(() => {
    if (handlersRef.current.find) {
      handlersRef.current.find();
    } else {
      Logger.debug('🔍 Find action - no handler registered');
    }
  }, []);

  return (
    <EditActionsContext.Provider
      value={{
        registerHandlers,
        unregisterHandlers,
        cut,
        copy,
        paste,
        delete: deleteAction,
        group,
        ungroup,
        find,
      }}
    >
      {children}
    </EditActionsContext.Provider>
  );
}

export function useEditActions() {
  const context = useContext(EditActionsContext);
  if (!context) {
    throw new Error('useEditActions must be used within EditActionsProvider');
  }
  return context;
}
