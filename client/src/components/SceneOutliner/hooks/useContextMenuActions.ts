/**
 * useContextMenuActions - Context menu action handlers
 * Manages all context menu actions for scene nodes
 */

import React, { useState, useCallback } from 'react';
import { Logger } from '../../../utils/Logger';
import { useStatusActions } from '../../../contexts/StatusMessageContext';
import { useOctane } from '../../../hooks/useOctane';
import { SceneNode } from '../../../services/OctaneClient';
import { EditCommands } from '../../../commands/EditCommands';

interface UseContextMenuActionsProps {
  onNodeSelect?: (node: SceneNode | null) => void;
}

export function useContextMenuActions({ onNodeSelect }: UseContextMenuActionsProps) {
  const { client } = useOctane();
  const { setTemporaryStatus } = useStatusActions();
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

    Logger.debug('Render action for node:', contextMenuNode.name);

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
            `Render target activated: "${contextMenuNode.name}" (handle: ${contextMenuNode.handle})`
          );
          // Optionally restart rendering with the new target
          await client.restartRender();
          Logger.debug('Rendering restarted with new render target');
        } else {
          Logger.warn(`Failed to activate render target: "${contextMenuNode.name}"`);
          setTemporaryStatus('Failed to activate render target', 3000);
        }
      } catch (error) {
        Logger.error('Error setting render target:', error);
        setTemporaryStatus('Error setting render target', 3000);
      }
    } else {
      Logger.warn('Selected node is not a render target');
      setTemporaryStatus('Selected node is not a render target', 3000);
    }

    handleContextMenuClose();
  }, [contextMenuNode, client, handleContextMenuClose, setTemporaryStatus]);

  // Save action
  const handleSave = useCallback(() => {
    Logger.debug('Save action for node:', contextMenuNode?.name);
    // TODO: Implement save action
  }, [contextMenuNode]);

  // Cut action
  const handleCut = useCallback(async () => {
    if (!contextMenuNode || !client) return;
    await EditCommands.cutNodes({
      client,
      selectedNodes: [contextMenuNode],
      onSelectionClear: () => onNodeSelect?.(null),
      onComplete: () => Logger.debug('Cut completed from SceneOutliner'),
      onError: msg => setTemporaryStatus(msg, 3000),
    });
  }, [contextMenuNode, client, onNodeSelect, setTemporaryStatus]);

  // Copy action
  const handleCopy = useCallback(async () => {
    if (!contextMenuNode || !client) return;
    await EditCommands.copyNodes({
      client,
      selectedNodes: [contextMenuNode],
      onError: msg => setTemporaryStatus(msg, 3000),
    });
  }, [contextMenuNode, client, setTemporaryStatus]);

  // Paste action
  const handlePaste = useCallback(async () => {
    if (!client) return;
    await EditCommands.pasteNodes({
      client,
      selectedNodes: [],
      onComplete: () => Logger.debug('Paste completed from SceneOutliner'),
      onError: msg => setTemporaryStatus(msg, 3000),
    });
  }, [client, setTemporaryStatus]);

  // Delete action
  const handleDelete = useCallback(async () => {
    if (!contextMenuNode || !client) return;

    Logger.debug('Delete action for node:', contextMenuNode.name);

    // Use unified EditCommands for consistent delete behavior
    await EditCommands.deleteNodes({
      client,
      selectedNodes: [contextMenuNode],
      onSelectionClear: () => {
        // Clear selection via parent callback
        onNodeSelect?.(null);
      },
      onComplete: () => {
        Logger.debug('Delete operation completed from SceneOutliner');
      },
      onError: msg => setTemporaryStatus(msg, 3000),
    });
  }, [contextMenuNode, client, onNodeSelect, setTemporaryStatus]);

  // Expand action — expands all items owned by this node's pins
  const handleExpand = useCallback(async () => {
    if (!contextMenuNode || !client) return;

    Logger.debug('Expand action for node:', contextMenuNode.name, contextMenuNode.handle);

    if (contextMenuNode.handle === undefined) return;

    const expanded = await client.expandNode(contextMenuNode.handle);
    if (expanded) {
      Logger.debug('Expanded node:', contextMenuNode.name);
      await client.buildSceneTree();
    }
  }, [contextMenuNode, client]);

  // Show in Graph Editor action
  const handleShowInGraphEditor = useCallback(() => {
    Logger.debug('Show in Graph Editor:', contextMenuNode?.name);
    // The node is already selected, the graph editor should show it
    // TODO: Add explicit navigation to graph editor tab if needed
  }, [contextMenuNode]);

  // Show in Lua Browser action
  const handleShowInLuaBrowser = useCallback(() => {
    Logger.debug('Show in Lua Browser:', contextMenuNode?.name);
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
    handleDelete,
    handleExpand,
    handleShowInGraphEditor,
    handleShowInLuaBrowser,
  };
}
