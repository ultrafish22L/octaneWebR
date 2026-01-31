/**
 * MaterialDatabase.tsx - Material Browser Component
 *
 * Octane SE Material Database UI clone with LiveDB and LocalDB tabs
 * Allows browsing and downloading materials from OTOY material library
 *
 * References:
 * - Octane SE Manual: Materials Database section
 * - gRPC API: ApiDBMaterialManager (getCategories, getMaterials, downloadMaterial)
 *
 * React 18 Modernization:
 * - Uses React Query (useMaterialCategories, useMaterialsForCategory, useDownloadMaterial)
 * - Automatic caching and background refetching
 * - Declarative data fetching with loading/error states
 */

import { Logger } from '../../utils/Logger';
import { useState } from 'react';
import {
  useMaterialCategories,
  useMaterialsForCategory,
  useDownloadMaterial,
  type DBType,
} from '../../hooks/useMaterialQueries';
import { SkeletonMaterialGrid } from '../Skeleton';

interface MaterialDatabaseProps {
  visible: boolean;
  onClose: () => void;
}

export function MaterialDatabase({ visible, onClose }: MaterialDatabaseProps) {
  const [activeTab, setActiveTab] = useState<DBType>('livedb');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  // React Query hooks - declarative data fetching
  const categoriesQuery = useMaterialCategories(activeTab, visible);
  const materialsQuery = useMaterialsForCategory(selectedCategory, activeTab, visible);
  const downloadMaterialMutation = useDownloadMaterial();

  // Derived state from queries
  const categories = categoriesQuery.data ?? [];
  const materials = materialsQuery.data ?? [];
  const loading = categoriesQuery.isLoading || materialsQuery.isLoading;
  const error = categoriesQuery.error?.message || materialsQuery.error?.message || null;

  // Handle material download using React Query mutation
  const handleDownloadMaterial = (materialId: number, materialName: string) => {
    downloadMaterialMutation.mutate(
      { materialId, materialName, dbType: activeTab },
      {
        onSuccess: () => {
          Logger.debug(`✅ Download complete: ${materialName}`);
          // TODO: Show success notification
        },
        onError: (error: any) => {
          Logger.error(`❌ Download failed: ${materialName}`, error);
          // Error is already logged by the mutation hook
        },
      }
    );
  };

  const handleCategoryChange = (categoryId: string) => {
    const id = parseInt(categoryId, 10);
    setSelectedCategory(id);
    // React Query will automatically fetch materials for the new category
  };

  const handleTabChange = (tab: DBType) => {
    setActiveTab(tab);
    setSelectedCategory(null); // Reset category when switching tabs
    // React Query will automatically refetch categories for the new tab
  };

  if (!visible) return null;

  return (
    <div
      className="material-database-overlay"
      onClick={onClose}
      onKeyDown={e => {
        if (e.key === 'Escape') onClose();
      }}
      role="button"
      tabIndex={0}
      aria-label="Close dialog"
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        className="material-database-window"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="material-database-header">
          <h2>Material Database</h2>
          <button className="close-button" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        {/* Tab Buttons: LiveDB / LocalDB */}
        <div className="material-database-tabs">
          <button
            className={`tab-button ${activeTab === 'livedb' ? 'active' : ''}`}
            onClick={() => handleTabChange('livedb')}
          >
            LiveDB
          </button>
          <button
            className={`tab-button ${activeTab === 'localdb' ? 'active' : ''}`}
            onClick={() => handleTabChange('localdb')}
          >
            LocalDB
          </button>
        </div>

        {/* Category Selector */}
        <div className="material-database-controls">
          <label htmlFor="category-select">Category:</label>
          <select
            id="category-select"
            value={selectedCategory || ''}
            onChange={e => handleCategoryChange(e.target.value)}
            disabled={loading || categories.length === 0}
            name="select-0"
          >
            <option value="">Select a category...</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Error Display */}
        {error && <div className="material-database-error">⚠️ {error}</div>}

        {/* Material Grid */}
        <div className="material-database-content">
          {loading && <SkeletonMaterialGrid count={12} />}

          {!loading && materials.length === 0 && selectedCategory && (
            <div className="material-database-empty">
              {activeTab === 'livedb'
                ? 'No materials available in this category'
                : 'No materials saved locally in this category'}
            </div>
          )}

          {!loading && materials.length > 0 && (
            <div className="material-grid">
              {materials.map(material => (
                <div
                  key={material.id}
                  className="material-card"
                  onDoubleClick={() => handleDownloadMaterial(material.id, material.name)}
                  title={`Double-click to download: ${material.name}`}
                >
                  <div className="material-preview">
                    {material.preview ? (
                      <img src={material.preview} alt={material.name} />
                    ) : (
                      <div className="material-preview-placeholder">No Preview</div>
                    )}
                  </div>
                  <div className="material-name">{material.name}</div>
                </div>
              ))}
            </div>
          )}

          {!loading && !selectedCategory && (
            <div className="material-database-instructions">
              Select a category to browse materials
            </div>
          )}
        </div>

        <div className="material-database-footer">
          <div className="material-database-info">
            {activeTab === 'livedb'
              ? 'LiveDB: Download pre-built materials from OTOY'
              : 'LocalDB: Browse locally saved materials'}
          </div>
        </div>
      </div>
    </div>
  );
}
