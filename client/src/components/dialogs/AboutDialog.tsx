/**
 * AboutDialog Component
 * Shows application information, version, and credits
 * Matches Octane SE: Help > About
 */

import React, { useRef, useEffect } from 'react';
import { APP_VERSION } from '../../config/apiVersionConfig';

interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AboutDialog({ isOpen, onClose }: AboutDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) dialogRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={handleOverlayClick}>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={dialogRef}
        className="about-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <div className="modal-header">
          <h2 id="about-title">About OctaneRender</h2>
          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close about dialog"
          ></button>
        </div>

        <div className="modal-body">
          <div className="about-content">
            <div className="about-logo">
              <img src="/octane-logo-small.png" alt="OctaneRender Logo" className="app-icon" />
              <h1>OctaneWebR</h1>
              <p className="version">Version {APP_VERSION}</p>
            </div>

            <div className="about-description">
              <p>
                <strong>OctaneWebR</strong> is a pixel-perfect React/TypeScript UI clone of Octane
                Render Studio Standalone Edition with real-time gRPC connectivity.
              </p>
            </div>

            <div className="about-tech-stack">
              <div className="tech-badges">
                <span className="tech-badge">React 18</span>
                <span className="tech-badge">TypeScript</span>
                <span className="tech-badge">ReactFlow</span>
                <span className="tech-badge">gRPC-Web</span>
              </div>
            </div>

            <div className="about-credits">
              <p className="copyright">
                © OTOY Inc. 2014-2026. All rights reserved.
                <br />
                <strong>OctaneRender®</strong> and <strong>OTOY®</strong> are registered trademarks
                of OTOY Inc.
              </p>
            </div>

            <div className="about-links">
              <a
                href="https://home.otoy.com"
                target="_blank"
                rel="noopener noreferrer"
                className="about-link"
              >
                OTOY Home
              </a>
              <a
                href="https://docs.otoy.com/standaloneSE/CoverPage.html"
                target="_blank"
                rel="noopener noreferrer"
                className="about-link"
              >
                Documentation
              </a>
              <a
                href="https://github.com/ultrafish22L/grpcSamples"
                target="_blank"
                rel="noopener noreferrer"
                className="about-link"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="button-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
