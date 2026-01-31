/**
 * LocalDBTreeItem - Tree item component for LocalDB categories and packages
 * Displays hierarchical LocalDB categories with expandable packages
 */

import React, { useState } from 'react';
import { LocalDBCategory, LocalDBPackage } from './hooks/useLocalDB';

interface LocalDBTreeItemProps {
  category: LocalDBCategory;
  depth: number;
  onLoadCategory: (category: LocalDBCategory) => void;
  onLoadPackage: (pkg: LocalDBPackage) => void;
}

export function LocalDBTreeItem({
  category,
  depth,
  onLoadCategory,
  onLoadPackage,
}: LocalDBTreeItemProps) {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!expanded && !category.loaded) {
      // Load children before expanding
      await onLoadCategory(category);
    }

    setExpanded(!expanded);
  };

  const handleKeyPress = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();

      if (!expanded && !category.loaded) {
        // Load children before expanding
        await onLoadCategory(category);
      }

      setExpanded(!expanded);
    }
  };

  return (
    <>
      <div className={`tree-node level-${depth}`}>
        <div className="node-content">
          <span
            className={`node-toggle ${expanded ? 'expanded' : 'collapsed'}`}
            onClick={handleToggle}
            onKeyPress={handleKeyPress}
            role="button"
            tabIndex={0}
          >
            {expanded ? '−' : '+'}
          </span>
          <span className="node-icon">📁</span>
          <span className="node-name">{category.name}</span>
        </div>
      </div>
      {expanded && (
        <>
          {/* Render subcategories */}
          {category.subcategories.map(subcat => (
            <LocalDBTreeItem
              key={subcat.handle}
              category={subcat}
              depth={depth + 1}
              onLoadCategory={onLoadCategory}
              onLoadPackage={onLoadPackage}
            />
          ))}
          {/* Render packages */}
          {category.packages.map(pkg => (
            <div
              key={pkg.handle}
              className={`tree-node level-${depth + 1}`}
              onDoubleClick={() => onLoadPackage(pkg)}
            >
              <div className="node-content">
                <span className="node-icon">📦</span>
                <span className="node-name">{pkg.name}</span>
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}
