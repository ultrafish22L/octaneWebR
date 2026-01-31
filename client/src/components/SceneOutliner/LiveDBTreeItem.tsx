/**
 * LiveDBTreeItem - Tree item component for LiveDB categories and materials
 * Displays hierarchical LiveDB categories with expandable materials
 */

import React from 'react';
import { LiveDBCategory, LiveDBMaterial } from './hooks/useLiveDB';

interface LiveDBTreeItemProps {
  category: LiveDBCategory;
  depth: number;
  onToggleCategory: (category: LiveDBCategory) => void;
  onDownloadMaterial: (material: LiveDBMaterial) => void;
}

export function LiveDBTreeItem({
  category,
  depth,
  onToggleCategory,
  onDownloadMaterial,
}: LiveDBTreeItemProps) {
  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleCategory(category);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle(e as any);
    }
  };

  return (
    <>
      <div className={`tree-node level-${depth}`}>
        <div className="node-content">
          <span
            className={`node-toggle ${category.expanded ? 'expanded' : 'collapsed'}`}
            onClick={handleToggle}
            onKeyPress={handleKeyPress}
            role="button"
            tabIndex={0}
          >
            {category.expanded ? '−' : '+'}
          </span>
          <span className="node-icon">📁</span>
          <span className="node-name">{category.name}</span>
        </div>
      </div>
      {category.expanded && category.loaded && (
        <>
          {/* Render materials in this category */}
          {category.materials.map(material => (
            <div
              key={material.id}
              className={`tree-node level-${depth + 1}`}
              onDoubleClick={() => onDownloadMaterial(material)}
            >
              <div className="node-content">
                {material.previewUrl && (
                  <img
                    src={material.previewUrl}
                    alt={material.name}
                    style={{
                      width: '16px',
                      height: '16px',
                      marginRight: '4px',
                      objectFit: 'cover',
                    }}
                  />
                )}
                <span className="node-name">{material.name || material.nickname}</span>
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}
