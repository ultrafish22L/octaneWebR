/**
 * MaterialDatabase.tsx - Material Browser Component
 * 
 * Octane SE Material Database UI clone with LiveDB and LocalDB tabs
 * Allows browsing and downloading materials from OTOY material library
 * 
 * References:
 * - Octane SE Manual: Materials Database section
 * - gRPC API: ApiDBMaterialManager (getCategories, getMaterials, downloadMaterial)
 */

import { Logger } from '../../utils/Logger';
import { useState, useEffect } from 'react';
import { useOctane } from '../../hooks/useOctane';

interface MaterialCategory {
  name: string;
  id: number;
}

interface Material {
  id: number;
  name: string;
  previewUrl?: string;
  category: string;
}

interface MaterialDatabaseProps {
  visible: boolean;
  onClose: () => void;
}

export function MaterialDatabase({ visible, onClose }: MaterialDatabaseProps) {
  const { connected, client } = useOctane();
  const [activeTab, setActiveTab] = useState<'livedb' | 'localdb'>('livedb');
  const [categories, setCategories] = useState<MaterialCategory[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load categories when database opens
  useEffect(() => {
    if (!visible || !connected) return;

    const loadCategories = async () => {
      setLoading(true);
      setError(null);

      try {
        Logger.debug(`🗂️ Loading ${activeTab === 'livedb' ? 'LiveDB' : 'LocalDB'} categories...`);
        
        // Call gRPC API to get categories
        const response = await client.callApi('ApiDBMaterialManager', 'getCategories', {
          dbType: activeTab === 'livedb' ? 0 : 1 // 0 = LiveDB, 1 = LocalDB
        });

        if (response && response.categories) {
          setCategories(response.categories);
          Logger.debug(`✅ Loaded ${response.categories.length} categories`);
        } else {
          setCategories([]);
          Logger.warn('⚠️ No categories returned from API');
        }
      } catch (err: any) {
        Logger.error('❌ Failed to load categories:', err);
        setError(`Failed to load categories: ${err.message}`);
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };

    loadCategories();
  }, [visible, connected, activeTab, client]);

  // Load materials when category is selected
  useEffect(() => {
    if (!selectedCategory || !connected) return;

    const loadMaterials = async () => {
      setLoading(true);
      setError(null);

      try {
        Logger.debug(`📦 Loading materials for category ${selectedCategory}...`);
        
        const response = await client.callApi('ApiDBMaterialManager', 'getMaterials', {
          categoryId: selectedCategory,
          dbType: activeTab === 'livedb' ? 0 : 1
        });

        if (response && response.materials) {
          setMaterials(response.materials);
          Logger.debug(`✅ Loaded ${response.materials.length} materials`);
        } else {
          setMaterials([]);
          Logger.warn('⚠️ No materials returned from API');
        }
      } catch (err: any) {
        Logger.error('❌ Failed to load materials:', err);
        setError(`Failed to load materials: ${err.message}`);
        setMaterials([]);
      } finally {
        setLoading(false);
      }
    };

    loadMaterials();
  }, [selectedCategory, connected, activeTab, client]);

  const handleDownloadMaterial = async (materialId: number, materialName: string) => {
    if (!connected) {
      Logger.warn('⚠️ Cannot download material: not connected');
      return;
    }

    try {
      Logger.debug(`⬇️ Downloading material: ${materialName} (ID: ${materialId})`);
      
      await client.callApi('ApiDBMaterialManager', 'downloadMaterial', {
        materialId,
        dbType: activeTab === 'livedb' ? 0 : 1
      });

      Logger.debug(`✅ Material downloaded: ${materialName}`);
      
      // TODO: Show success notification
    } catch (err: any) {
      Logger.error(`❌ Failed to download material ${materialName}:`, err);
      setError(`Failed to download material: ${err.message}`);
    }
  };

  const handleCategoryChange = (categoryId: string) => {
    const id = parseInt(categoryId, 10);
    setSelectedCategory(id);
    setMaterials([]); // Clear materials while loading
  };

  if (!visible) return null;

  return (
    <div className="material-database-overlay" onClick={onClose}>
      <div className="material-database-window" onClick={(e) => e.stopPropagation()}>
        <div className="material-database-header">
          <h2>Material Database</h2>
          <button className="close-button" onClick={onClose} title="Close">✕</button>
        </div>

        {/* Tab Buttons: LiveDB / LocalDB */}
        <div className="material-database-tabs">
          <button
            className={`tab-button ${activeTab === 'livedb' ? 'active' : ''}`}
            onClick={() => setActiveTab('livedb')}
          >
            LiveDB
          </button>
          <button
            className={`tab-button ${activeTab === 'localdb' ? 'active' : ''}`}
            onClick={() => setActiveTab('localdb')}
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
            onChange={(e) => handleCategoryChange(e.target.value)}
            disabled={loading || categories.length === 0}
                                  name="select-0"
          >
            <option value="">Select a category...</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Error Display */}
        {error && (
          <div className="material-database-error">
            ⚠️ {error}
          </div>
        )}

        {/* Material Grid */}
        <div className="material-database-content">
          {loading && (
            <div className="material-database-loading">
              Loading...
            </div>
          )}

          {!loading && materials.length === 0 && selectedCategory && (
            <div className="material-database-empty">
              {activeTab === 'livedb' 
                ? 'No materials available in this category'
                : 'No materials saved locally in this category'}
            </div>
          )}

          {!loading && materials.length > 0 && (
            <div className="material-grid">
              {materials.map((material) => (
                <div
                  key={material.id}
                  className="material-card"
                  onDoubleClick={() => handleDownloadMaterial(material.id, material.name)}
                  title={`Double-click to download: ${material.name}`}
                >
                  <div className="material-preview">
                    {material.previewUrl ? (
                      <img src={material.previewUrl} alt={material.name} />
                    ) : (
                      <div className="material-preview-placeholder">
                        No Preview
                      </div>
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
