/**
 * useContextMenuActions - Context menu action handlers
 * Manages all context menu actions for scene nodes
 */

import React, { useState, useCallback } from 'react';
import { Logger } from '../../../utils/Logger';
import { useOctane } from '../../../hooks/useOctane';
import { SceneNode } from '../../../services/OctaneClient';
import { EditCommands } from '../../../commands/EditCommands';

interface UseContextMenuActionsProps {
  onNodeSelect?: (node: SceneNode | null) => void;
}

export function useContextMenuActions({ onNodeSelect }: UseContextMenuActionsProps) {
  const { client } = useOctane();
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuNode, setContextMenuNode] = useState<SceneNode | null>(null);

  // Context menu handler
  const handleNodeContextMenu = useCallback((node: SceneNode, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
    setContextMenuNode(node);
    setContextMenuVisible(true);
  }, []);

  // Close context menu
  const handleContextMenuClose = useCallback(() => {
    setContextMenuVisible(false);
    setContextMenuNode(null);
  }, []);

  // Render action
  const handleRender = useCallback(async () => {
    if (!contextMenuNode) return;

    Logger.debug('🎬 Render action for node:', contextMenuNode.name);

    // If the node is a render target, set it as the active render target
    if (
      contextMenuNode.type === 'PT_RENDERTARGET' &&
      contextMenuNode.handle &&
      contextMenuNode.handle !== -1
    ) {
      try {
        const success = await client.setRenderTargetNode(contextMenuNode.handle);
        if (success) {
          Logger.debug(
            `✅ Render target activated: "${contextMenuNode.name}" (handle: ${contextMenuNode.handle})`
          );
          // Optionally restart rendering with the new target
          await client.restartRender();
          Logger.debug('🔄 Rendering restarted with new render target');
        } else {
          Logger.warn(`⚠️ Failed to activate render target: "${contextMenuNode.name}"`);
        }
      } catch (error) {
        Logger.error('❌ Error setting render target:', error);
      }
    } else {
      Logger.warn('⚠️ Selected node is not a render target');
    }

    handleContextMenuClose();
  }, [contextMenuNode, client, handleContextMenuClose]);

  // Save action
  const handleSave = useCallback(() => {
    Logger.debug('💾 Save action for node:', contextMenuNode?.name);
    // TODO: Implement save action
  }, [contextMenuNode]);

  // Cut action
  const handleCut = useCallback(() => {
    Logger.debug('✂️ Cut action for node:', contextMenuNode?.name);
    // TODO: Implement cut action
  }, [contextMenuNode]);

  // Copy action
  const handleCopy = useCallback(() => {
    Logger.debug('📋 Copy action for node:', contextMenuNode?.name);
    // TODO: Implement copy action
  }, [contextMenuNode]);

  // Paste action
  const handlePaste = useCallback(() => {
    Logger.debug('📌 Paste action for node:', contextMenuNode?.name);
    // TODO: Implement paste action
  }, [contextMenuNode]);

  // Fill empty pins action
  const handleFillEmptyPins = useCallback(() => {
    Logger.debug('📌 Fill empty pins for node:', contextMenuNode?.name);
    // TODO: Implement fill empty pins action
  }, [contextMenuNode]);

  // Delete action
  const handleDelete = useCallback(async () => {
    if (!contextMenuNode || !client) return;

    Logger.debug('🗑️ Delete action for node:', contextMenuNode.name);

    // Use unified EditCommands for consistent delete behavior
    await EditCommands.deleteNodes({
      client,
      selectedNodes: [contextMenuNode],
      onSelectionClear: () => {
        // Clear selection via parent callback
        onNodeSelect?.(null);
      },
      onComplete: () => {
        Logger.debug('✅ Delete operation completed from SceneOutliner');
      },
    });
  }, [contextMenuNode, client, onNodeSelect]);

  // Show in Graph Editor action
  const handleShowInGraphEditor = useCallback(() => {
    Logger.debug('🔍 Show in Graph Editor:', contextMenuNode?.name);
    // The node is already selected, the graph editor should show it
    // TODO: Add explicit navigation to graph editor tab if needed
  }, [contextMenuNode]);

  // Show in Lua Browser action
  const handleShowInLuaBrowser = useCallback(() => {
    Logger.debug('🔍 Show in Lua Browser:', contextMenuNode?.name);
    // TODO: Implement Lua browser navigation
  }, [contextMenuNode]);

  return {
    contextMenuVisible,
    contextMenuPosition,
    contextMenuNode,
    handleNodeContextMenu,
    handleContextMenuClose,
    handleRender,
    handleSave,
    handleCut,
    handleCopy,
    handlePaste,
    handleFillEmptyPins,
    handleDelete,
    handleShowInGraphEditor,
    handleShowInLuaBrowser,
  };
}
