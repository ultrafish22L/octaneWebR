/**
 * AboutDialog Component
 * Shows application information, version, and credits
 * Matches Octane SE: Help > About
 */

interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AboutDialog({ isOpen, onClose }: AboutDialogProps) {
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
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="about-title"
      tabIndex={-1}
    >
      <div className="about-dialog">
        <div className="modal-header">
          <h2 id="about-title">About OctaneRender</h2>
          <button className="modal-close-button" onClick={onClose} aria-label="Close about dialog">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="about-content">
            <div className="about-logo">
              <img src="/octane-logo-small.png" alt="OctaneRender Logo" className="app-icon" />
              <h1>OctaneWebR</h1>
              <p className="version">Version 1.0.0</p>
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
                © OTOY Inc. 2014-2025. All rights reserved.
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
