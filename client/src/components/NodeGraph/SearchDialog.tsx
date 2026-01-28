/**
 * Search Dialog Component
 * Implements Ctrl+F search functionality per Octane SE manual
 * 
 * Manual Reference: "Search Dialog - Pressing CTRL+F brings up the Search Dialog, 
 * which finds and selects nodes and dynamic pins that contain the entered search string."
 * 
 * Features:
 * - Opens on Ctrl+F keyboard shortcut
 * - Searches node names and pin names
 * - Selects matching nodes in graph
 * - Case-insensitive search
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Node } from '@xyflow/react';
import { OctaneNodeData } from './OctaneNode';

interface SearchDialogProps {
  visible: boolean;
  nodes: Node<OctaneNodeData>[];
  onClose: () => void;
  onSelectNodes: (nodeIds: string[]) => void;
}

interface SearchResult {
  node: Node<OctaneNodeData>;
  matchType: 'nodeName' | 'nodeType' | 'pinName';
  matchedPins?: string[];
}

export function SearchDialog({ visible, nodes, onClose, onSelectNodes }: SearchDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when dialog opens
  useEffect(() => {
    if (visible && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [visible]);

  // Close on Escape key
  useEffect(() => {
    if (!visible) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [visible, onClose]);

  // Search nodes and pins
  useEffect(() => {
    if (!searchTerm.trim()) {
      setResults([]);
      return;
    }

    const term = searchTerm.toLowerCase();
    const matches: SearchResult[] = [];

    nodes.forEach((node) => {
      const data = node.data as OctaneNodeData;
      const nodeName = data.sceneNode.name?.toLowerCase() || '';
      const nodeTypeName = data.sceneNode.nodeInfo?.nodeTypeName?.toLowerCase() || '';
      
      // Search in node name (highest priority)
      if (nodeName.includes(term)) {
        matches.push({ node, matchType: 'nodeName' });
        return;
      }

      // Search in node type name
      if (nodeTypeName.includes(term)) {
        matches.push({ node, matchType: 'nodeType' });
        return;
      }

      // Search in pin names (dynamic pins)
      const inputs = data.sceneNode.children || [];
      const matchedPins: string[] = [];
      
      inputs.forEach((pin: any) => {
        const pinName = pin.name?.toLowerCase() || '';
        if (pinName.includes(term)) {
          matchedPins.push(pin.name);
        }
      });

      if (matchedPins.length > 0) {
        matches.push({ node, matchType: 'pinName', matchedPins });
      }
    });

    setResults(matches);
  }, [searchTerm, nodes]);

  // Select all matching nodes
  const handleSelectAll = () => {
    const nodeIds = results.map((result) => result.node.id);
    onSelectNodes(nodeIds);
    onClose();
  };

  // Close when clicking outside dialog
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!visible) return null;

  return createPortal(
    <div
      className="search-dialog-backdrop"
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '20vh',
        zIndex: 10000,
      }}
    >
      <div
        className="search-dialog"
        style={{
          backgroundColor: '#2a2a2a',
          border: '1px solid #444',
          borderRadius: '4px',
          padding: '20px',
          minWidth: '400px',
          maxWidth: '600px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Title */}
        <div
          style={{
            fontSize: '16px',
            fontWeight: 'bold',
            marginBottom: '15px',
            color: '#ffc107',
          }}
        >
          Search Nodes and Pins
        </div>

        {/* Search Input */}
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Enter search term..."
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: '14px',
            backgroundColor: '#1a1a1a',
            border: '1px solid #555',
            borderRadius: '3px',
            color: '#fff',
            outline: 'none',
            marginBottom: '15px',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results.length > 0) {
              handleSelectAll();
            }
          }}
                              autoComplete="off"
                      name="text-0"
        />

        {/* Results */}
        <div
          style={{
            marginBottom: '15px',
            color: '#aaa',
            fontSize: '13px',
          }}
        >
          {searchTerm.trim() ? (
            results.length > 0 ? (
              <>Found {results.length} matching node{results.length !== 1 ? 's' : ''}</>
            ) : (
              <>No matches found</>
            )
          ) : (
            <>Enter search term to find nodes</>
          )}
        </div>

        {/* Results List */}
        {results.length > 0 && (
          <div
            style={{
              maxHeight: '300px',
              overflowY: 'auto',
              backgroundColor: '#1a1a1a',
              border: '1px solid #444',
              borderRadius: '3px',
              marginBottom: '15px',
            }}
          >
            {results.map((result) => {
              const { node, matchType, matchedPins } = result;
              const data = node.data as OctaneNodeData;
              
              // Format match context message
              let matchContext = '';
              if (matchType === 'nodeName') {
                matchContext = '📌 Matched in node name';
              } else if (matchType === 'nodeType') {
                matchContext = '🏷️ Matched in node type';
              } else if (matchType === 'pinName' && matchedPins) {
                matchContext = `📍 Matched in ${matchedPins.length} pin${matchedPins.length > 1 ? 's' : ''}: ${matchedPins.slice(0, 3).join(', ')}${matchedPins.length > 3 ? '...' : ''}`;
              }
              
              return (
                <div
                  key={node.id}
                  style={{
                    padding: '8px 12px',
                    borderBottom: '1px solid #333',
                    cursor: 'pointer',
                    color: '#ddd',
                    fontSize: '13px',
                  }}
                  onClick={() => {
                    onSelectNodes([node.id]);
                    onClose();
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#333';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>
                    {data.sceneNode.name || 'Unnamed'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#888', marginBottom: '3px' }}>
                    {data.sceneNode.nodeInfo?.nodeTypeName || 'Unknown type'}
                  </div>
                  <div style={{ fontSize: '10px', color: '#ffc107', fontStyle: 'italic' }}>
                    {matchContext}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              fontSize: '13px',
              backgroundColor: '#444',
              border: '1px solid #555',
              borderRadius: '3px',
              color: '#ddd',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#555';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#444';
            }}
          >
            Cancel
          </button>
          {results.length > 0 && (
            <button
              onClick={handleSelectAll}
              style={{
                padding: '6px 16px',
                fontSize: '13px',
                backgroundColor: '#ffc107',
                border: '1px solid #ffc107',
                borderRadius: '3px',
                color: '#000',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#ffcd38';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ffc107';
              }}
            >
              Select All ({results.length})
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
