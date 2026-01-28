/**
 * Viewport Context Menu Component
 * 
 * Context menu for the Render Viewport matching Octane SE behavior:
 * - Appears on right-click (without drag)
 * - Right-click + drag = camera pan (no menu)
 * 
 * Actions per Octane SE Manual:
 * - Copy to Clipboard
 * - Save Render
 * - Export Render Passes
 * - Set Background Image
 * - Lock Viewport
 */

import React from 'react';
import { getGeneralUIIcon, getWindowControlIcon } from '../../constants/UIIconMapping';

interface ViewportContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  onClose: () => void;
  onCopyToClipboard: () => void;
  onSaveRender: () => void;
  onExportPasses: () => void;
  onSetBackgroundImage: () => void;
  onToggleLockViewport: () => void;
  viewportLocked: boolean;
}

export const ViewportContextMenu: React.FC<ViewportContextMenuProps> = ({
  visible,
  x,
  y,
  onClose,
  onCopyToClipboard,
  onSaveRender,
  onExportPasses,
  onSetBackgroundImage,
  onToggleLockViewport,
  viewportLocked
}) => {
  if (!visible) return null;

  const handleMenuClick = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <>
      {/* Backdrop to close menu when clicking outside */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 999
        }}
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      
      {/* Context Menu */}
      <div
        className="context-menu"
        style={{
          position: 'fixed',
          left: `${x}px`,
          top: `${y}px`,
          zIndex: 1000
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="context-menu-item" onClick={() => handleMenuClick(onCopyToClipboard)}>
          <img src={getGeneralUIIcon('COPY_TO_CLIPBOARD_IMAGE')} alt="" style={{ width: 14, height: 14, marginRight: 8 }} />
          Copy to Clipboard
        </div>
        <div className="context-menu-item" onClick={() => handleMenuClick(onSaveRender)}>
          <img src={getGeneralUIIcon('LOAD_GENERAL')} alt="" style={{ width: 14, height: 14, marginRight: 8 }} />
          Save Render
        </div>
        <div className="context-menu-item" onClick={() => handleMenuClick(onExportPasses)}>
          <img src={getGeneralUIIcon('LOAD_ALL')} alt="" style={{ width: 14, height: 14, marginRight: 8 }} />
          Export Render Passes
        </div>
        <div className="context-menu-separator" />
        <div className="context-menu-item" onClick={() => handleMenuClick(onSetBackgroundImage)}>
          <img src={getGeneralUIIcon('BACKGROUND')} alt="" style={{ width: 14, height: 14, marginRight: 8 }} />
          Set Background Image
        </div>
        <div className="context-menu-separator" />
        <div className="context-menu-item" onClick={() => handleMenuClick(onToggleLockViewport)}>
          <img 
            src={viewportLocked ? getWindowControlIcon('UNLOCK') : getWindowControlIcon('LOCK')} 
            alt="" 
            style={{ width: 14, height: 14, marginRight: 8 }} 
          />
          {viewportLocked ? 'Unlock Viewport' : 'Lock Viewport'}
        </div>
      </div>
    </>
  );
};
