/**
 * Node Inspector Component (React TypeScript)
 * Professional parameter editing interface matching Octane Render Studio exactly
 * 
 * This component replicates the exact layout and styling from the reference screenshot:
 * - Compact parameter rows with proper spacing
 * - Blue parameter icons on the left
 * - Parameter names in the center
 * - Input controls on the right (numbers with spinners, checkboxes, color bars)
 * - Proper grouping with collapsible sections
 * - Professional dark theme matching Octane Studio
 */

import { Logger } from '../../utils/Logger';
import React, { useState, useEffect } from 'react';
import { SceneNode } from '../../services/OctaneClient';
import { useOctane } from '../../hooks/useOctane';
import { AttributeId, AttrType } from '../../constants/OctaneTypes';
import { getIconForType, getCompatibleNodeTypes } from '../../constants/PinTypes';
import { getNodeTypeInfo } from '../../constants/NodeTypes';
import { USE_ALPHA5_API } from '../../config/apiVersionConfig';
import { formatColorValue, formatNodeColor } from '../../utils/ColorUtils';
import { NodeInspectorContextMenu } from './NodeInspectorContextMenu';
import { EditCommands } from '../../commands/EditCommands';
import { getPinTypeInfo } from '../../constants/PinTypes';

/**
 * Format float value to maximum 6 decimal places
 * Handles null/undefined by returning 0
 */
function formatFloat(value: number | null | undefined): number {
  if (value == null || isNaN(value)) return 0;
  return parseFloat(value.toFixed(6));
}

interface NodeInspectorProps {
  node: SceneNode | null;
}

interface ParameterValue {
  value: any;
  type: number;
}

// Parameter group display component
function ParameterGroup({ 
  groupName, 
  children, 
  defaultExpanded = true 
}: { 
  groupName: string; 
  children: React.ReactNode; 
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="inspector-group-indent">
      <div 
        className={`inspector-group-header ${expanded ? 'expanded' : 'collapsed'}`}
        onClick={() => setExpanded(!expanded)}
      >
        <span className="inspector-group-icon">{expanded ? '▼' : '▶'}</span>
        <span className="inspector-group-label">{groupName}</span>
      </div>
      <div 
        className="inspector-group-content" 
        style={{ display: expanded ? 'block' : 'none' }}
      >
        {children}
      </div>
    </div>
  );
}

// Node parameter item component
function NodeParameter({ 
  node, 
  level, 
  onToggle,
  hasGroupMap
}: { 
  node: SceneNode; 
  level: number; 
  onToggle: (nodeId: string) => void;
  hasGroupMap: Map<number, boolean>;
}) {
  const { client } = useOctane();
  const [paramValue, setParamValue] = useState<ParameterValue | null>(null);
  const [expanded, setExpanded] = useState(level < 2);
  
  const hasChildren = node.children && node.children.length > 0;
  const isEndNode = !hasChildren && node.attrInfo;
  const nodeId = `node-${node.handle}`;
  const typeStr = String(node.type || node.outType || 'unknown');
  const icon = node.icon || getIconForType(typeStr, node.name);
  const name = node.pinInfo?.staticLabel || node.name;
  var color = node.nodeInfo?.nodeColor ? formatNodeColor(node.nodeInfo.nodeColor) : '#666';
  if (node.pinInfo) {
    const info = getPinTypeInfo((node.pinInfo.type as string));
    if (info) {
      color = info.color;
    }
  } 
  // Determine if we should show dropdown (non-end nodes with a valid pin type)
  // Show dropdown for any non-end node (nodes with children, not value attributes)
  const pinType = typeStr.startsWith('PT_') ? typeStr : null;
  const compatibleNodeTypes = pinType ? getCompatibleNodeTypes(pinType) : [];
  const showDropdown = !isEndNode && compatibleNodeTypes.length > 0;
  
  // Get current node type (for nodes, not pins)
  const currentNodeType = node.nodeInfo?.type || '';
  
  // Handler for node type change
  const handleNodeTypeChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newNodeType = event.target.value;
    if (!node.handle || !newNodeType || newNodeType === currentNodeType) {
      return;
    }
    
    Logger.debug(`🔄 Replacing node ${node.handle} (${currentNodeType}) with ${newNodeType}`);
    
    try {
      // Call API to replace node
      await client.replaceNode(node.handle, newNodeType);
      Logger.debug(`✅ Node replaced successfully`);
    } catch (error) {
      Logger.error('❌ Failed to replace node:', error);
      alert(`Failed to replace node: ${error}`);
    }
  };

  // Fetch parameter value for end nodes (matching octaneWeb's GenericNodeRenderer.getValue())
  useEffect(() => {
    const fetchValue = async () => {
      // Verbose parameter logging (commented out to reduce log flooding)
      // Log every node to understand the tree structure
      // if (level < 3) {  // Only log first 3 levels to avoid spam
      //   Logger.debug(`📋 NodeParameter: "${node.name}" - hasChildren:${hasChildren}, has attrInfo:${!!node.attrInfo}, isEndNode:${isEndNode}, handle:${node.handle}`);
      // }
      
      if (!node.attrInfo || !node.handle || !isEndNode) {
        return;  // Skip without verbose logging
      }
      
      // Only call value fetch on simple value types (not complex nodes like geometry, materials, etc.)
      // Both APIs are stricter with non-value nodes
      // These PT_ types match PinTypeId enum from octaneids.proto - only primitive value nodes
      const valueTypes = ['PT_BOOL', 'PT_INT', 'PT_FLOAT', 'PT_STRING', 'PT_ENUM'];
      
      if (!node.outType || !valueTypes.includes(String(node.outType))) {
        Logger.debug(`🚫 Skipping value fetch for ${node.name} (outType: ${node.outType}) - not a simple value type`);
        return;  // Skip nodes that aren't simple value types
      }
      
      // Alpha 5 uses 'getByAttrID', Beta 2 uses 'getValueByAttrID'
      const methodName = USE_ALPHA5_API ? 'getByAttrID' : 'getValueByAttrID';
      Logger.debug(`✅ Calling ${methodName} for ${node.name} (outType: ${node.outType})`);

      try {
        // attrInfo.type is already a STRING like "AT_FLOAT3" from the API
        // Use it directly, no conversion needed
        const expectedType = AttrType[node.attrInfo.type as keyof typeof AttrType];
        
        if (USE_ALPHA5_API) {
          Logger.debug(`🔍 Alpha 5 API call: ApiItem.${methodName}`);
          Logger.debug(`  - handle: ${node.handle}`);
          Logger.debug(`  - attribute_id: ${AttributeId.A_VALUE} (A_VALUE)`);
          Logger.debug(`  - expected_type: ${expectedType} (${node.attrInfo.type})`);
        }

        // Pass just the handle string - callApi will wrap it in objectPtr automatically
        // Server-side will transform objectPtr → item_ref for Alpha 5's getByAttrID
        const response = await client.callApi(
          'ApiItem',
          methodName,  // Use correct method name for API version
          node.handle,  // Pass handle as string
          {
            attribute_id: AttributeId.A_VALUE, // 185 - Use constant instead of hardcoded value
            expected_type: expectedType  // number
          }
        );
        
        if (response) {
          // Extract the actual value from the response
          // API returns format like: {float_value: 2, value: "float_value"}
          // We need to get the value from the field indicated by response.value
          const valueField = response.value || Object.keys(response)[0];
          const actualValue = response[valueField];
          
          if (USE_ALPHA5_API) {
            Logger.debug(`✅ Alpha 5 value fetch SUCCESS for ${node.name}: ${actualValue}`);
          }
          
          setParamValue({
            value: actualValue,
            type: expectedType
          });
        }
      } catch (error: any) {
        // Log Alpha 5 errors for debugging, silently ignore Beta 2 errors
        if (USE_ALPHA5_API) {
          Logger.error(`❌ Alpha 5 ${methodName} error for ${node.name}: ${error.message || error}`);
        }
      }
    };
    
    fetchValue();
  }, [isEndNode, node.handle, node.attrInfo, client]);

  const handleToggle = () => {
    setExpanded(!expanded);
    onToggle(nodeId);
  };

  // Handle parameter value change
  const handleValueChange = async (newValue: any) => {
    if (!node.handle || !node.attrInfo) return;
    
    try {
      const expectedType = AttrType[node.attrInfo.type as keyof typeof AttrType];
      
      // Determine the correct value field name based on type
      // CRITICAL: Must match exact field names used by octaneWeb and Octane API
      let valueField: string;
      let formattedValue: any;
      
      switch (expectedType) {
        case AttrType.AT_BOOL:
          valueField = 'bool_value';
          formattedValue = Boolean(newValue);
          break;
        case AttrType.AT_INT:
          valueField = 'int_value';
          formattedValue = newValue;
          break;
        case AttrType.AT_INT2:
          valueField = 'int2_value';
          formattedValue = newValue;
          break;
        case AttrType.AT_INT3:
          valueField = 'int3_value';
          formattedValue = newValue;
          break;
        case AttrType.AT_INT4:
          valueField = 'int4_value';
          formattedValue = newValue;
          break;
        case AttrType.AT_LONG:
          valueField = 'long_value';
          formattedValue = newValue;
          break;
        case AttrType.AT_LONG2:
          valueField = 'long2_value';
          formattedValue = newValue;
          break;
        case AttrType.AT_FLOAT:
          valueField = 'float_value';
          formattedValue = newValue;
          break;
        case AttrType.AT_FLOAT2:
          valueField = 'float2_value';
          formattedValue = newValue;
          break;
        case AttrType.AT_FLOAT3:
          valueField = 'float3_value';
          formattedValue = newValue;
          break;
        case AttrType.AT_FLOAT4:
          valueField = 'float4_value';
          formattedValue = newValue;
          break;
        case AttrType.AT_STRING:
          valueField = 'string_value';
          formattedValue = String(newValue);
          break;
        default:
          Logger.warn(`⚠️  Unsupported type for setValue: ${node.attrInfo.type}`);
          return;
      }
      
      Logger.debug(`📝 Setting ${node.name} = ${JSON.stringify(formattedValue)}`);
      
      // Call setValueByAttrID to update the value in Octane
      // Note: evaluate: false is required (matches octaneWeb behavior)
      await client.callApi(
        'ApiItem',
        'setValueByAttrID',
        node.handle,
        {
          attribute_id: AttributeId.A_VALUE,
          expected_type: expectedType,
          [valueField]: formattedValue,
          evaluate: false  // Required parameter from octaneWeb
        }
      );
      
      // Update local state to reflect the change
      setParamValue({
        value: formattedValue,
        type: expectedType
      });
      
      Logger.debug(`✅ Successfully updated ${node.name}`);
      
      // Trigger render update to see changes
      await client.callApi('ApiChangeManager', 'update', {});
      
    } catch (error: any) {
      Logger.error(`❌ Failed to update ${node.name}:`, error.message || error);
    }
  };

  // Render the parameter control based on type (matching octaneWeb GenericNodeRenderer exactly)
  const renderParameterControl = () => {
    if (!paramValue) return null;

    const { value, type } = paramValue;

    // Controls must be wrapped in parameter-control-container or parameter-checkbox-container
    // which are then wrapped in node-parameter-controls div (matching octaneWeb structure)
    let controlHtml = null;

    switch (type) {
      case AttrType.AT_BOOL: {
        const boolValue = typeof value === 'boolean' ? value : false;
        controlHtml = (
          <div className="parameter-checkbox-container">
            <input 
              type="checkbox" 
              className="octane-checkbox parameter-control" 
              checked={boolValue}
              onChange={(e) => handleValueChange(e.target.checked)}
              id={`checkbox-${node.handle}`}
                                      autoComplete="off"
                          name="octane-checkbox-0"
            />
          </div>
        );
        break;
      }
      
      case AttrType.AT_FLOAT: {
        const floatValue = typeof value === 'number' ? formatFloat(value) : 0;
        const floatInfo = node.pinInfo?.floatInfo;
        const useSliders = floatInfo?.useSliders ?? true;
        const step = floatInfo?.dimInfos?.[0]?.sliderStep ?? 0.001;
        
        controlHtml = (
          <div className="parameter-control-container">
            <div className="parameter-number-with-spinner">
              <input 
                type="number" 
                className="octane-number-input parameter-control" 
                value={floatValue || 0}
                step={step}
                onChange={(e) => handleValueChange(formatFloat(parseFloat(e.target.value)))}
                                          autoComplete="off"
                            name="octane-number-input-1"
              />
              {useSliders && (
                <div className="parameter-spinner-container">
                  <button 
                    className="parameter-spinner-btn"
                    onClick={() => handleValueChange(formatFloat((floatValue || 0) + step))}
                    title="Increase value"
                  >
                    ▲
                  </button>
                  <button 
                    className="parameter-spinner-btn"
                    onClick={() => handleValueChange(formatFloat((floatValue || 0) - step))}
                    title="Decrease value"
                  >
                    ▼
                  </button>
                </div>
              )}
            </div>
          </div>
        );
        break;
      }
      
      case AttrType.AT_FLOAT2: {
        if (value && typeof value === 'object' && 'x' in value) {
          const { x = 0, y = 0 } = value;
          const floatInfo = node.pinInfo?.floatInfo;
          const dimCount = floatInfo?.dimCount ?? 2;
          const step = floatInfo?.dimInfos?.[0]?.sliderStep ?? 0.001;
          
          controlHtml = (
            <div className="parameter-control-container">
              <input 
                type="number" 
                className="octane-number-input parameter-control" 
                value={formatFloat(x)}
                step={step}
                onChange={(e) => handleValueChange({ x: formatFloat(parseFloat(e.target.value)), y })}
                                          autoComplete="off"
                            name="octane-number-input-2"
              />
              {dimCount >= 2 && (
                <input 
                  type="number" 
                  className="octane-number-input parameter-control" 
                  value={formatFloat(y)}
                  step={step}
                  onChange={(e) => handleValueChange({ x, y: formatFloat(parseFloat(e.target.value)) })}
                                              autoComplete="off"
                              name="octane-number-input-3"
                />
              )}
            </div>
          );
        }
        break;
      }
      
      case AttrType.AT_FLOAT3: {
        if (value && typeof value === 'object' && 'x' in value) {
          const { x = 0, y = 0, z = 0 } = value;
          const floatInfo = node.pinInfo?.floatInfo;
          const dimCount = floatInfo?.dimCount ?? 3;
          const step = floatInfo?.dimInfos?.[0]?.sliderStep ?? 0.001;
          const isColor = floatInfo?.isColor || node.nodeInfo?.type === 'NT_TEX_RGB';
          
          // Check if this is a color (NT_TEX_RGB)
          if (isColor) {
            const hexColor = formatColorValue(value);
            controlHtml = (
              <div className="parameter-control-container">
                <input 
                  type="color" 
                  className="octane-color-input parameter-control" 
                  value={hexColor}
                  style={{ background: hexColor, color: hexColor }}
                  onChange={(e) => {
                    const hex = e.target.value;
                    const r = parseInt(hex.substring(1, 3), 16) / 255;
                    const g = parseInt(hex.substring(3, 5), 16) / 255;
                    const b = parseInt(hex.substring(5, 7), 16) / 255;
                    handleValueChange({ x: formatFloat(r), y: formatFloat(g), z: formatFloat(b) });
                  }}
                                              autoComplete="off"
                              name="octane-color-input-4"
                />
              </div>
            );
          } else {
            controlHtml = (
              <div className="parameter-control-container">
                <input 
                  type="number" 
                  className="octane-number-input parameter-control" 
                  value={formatFloat(x)}
                  step={step}
                  onChange={(e) => handleValueChange({ x: formatFloat(parseFloat(e.target.value)), y, z })}
                                              autoComplete="off"
                              name="octane-number-input-5"
                />
                {dimCount >= 2 && (
                  <input 
                    type="number" 
                    className="octane-number-input parameter-control" 
                    value={formatFloat(y)}
                    step={step}
                    onChange={(e) => handleValueChange({ x, y: formatFloat(parseFloat(e.target.value)), z })}
                                                  autoComplete="off"
                                name="octane-number-input-6"
                  />
                )}
                {dimCount >= 3 && (
                  <input 
                    type="number" 
                    className="octane-number-input parameter-control" 
                    value={formatFloat(z)}
                    step={step}
                    onChange={(e) => handleValueChange({ x, y, z: formatFloat(parseFloat(e.target.value)) })}
                                                  autoComplete="off"
                                name="octane-number-input-7"
                  />
                )}
              </div>
            );
          }
        }
        break;
      }
      
      case AttrType.AT_FLOAT4: {
        if (value && typeof value === 'object' && 'x' in value) {
          const { x = 0, y = 0, z = 0, w = 0 } = value;
          const floatInfo = node.pinInfo?.floatInfo;
          const dimCount = floatInfo?.dimCount ?? 4;
          const step = floatInfo?.dimInfos?.[0]?.sliderStep ?? 0.001;
          
          // Render based on dimension count (matching octaneWeb exactly)
          switch (dimCount) {
            case 1:
              controlHtml = (
                <div className="parameter-control-container">
                  <input 
                    type="number" 
                    className="octane-number-input parameter-control" 
                    value={formatFloat(x)}
                    step={step}
                    onChange={(e) => handleValueChange({ x: formatFloat(parseFloat(e.target.value)), y, z, w })}
                                                  autoComplete="off"
                                name="octane-number-input-8"
                  />
                </div>
              );
              break;
            case 2:
              controlHtml = (
                <div className="parameter-control-container">
                  <input 
                    type="number" 
                    className="octane-number-input parameter-control" 
                    value={formatFloat(x)}
                    step={step}
                    onChange={(e) => handleValueChange({ x: formatFloat(parseFloat(e.target.value)), y, z, w })}
                                                  autoComplete="off"
                                name="octane-number-input-9"
                  />
                  <input 
                    type="number" 
                    className="octane-number-input parameter-control" 
                    value={formatFloat(y)}
                    step={step}
                    onChange={(e) => handleValueChange({ x, y: formatFloat(parseFloat(e.target.value)), z, w })}
                                                  autoComplete="off"
                                name="octane-number-input-10"
                  />
                </div>
              );
              break;
            case 3:
              controlHtml = (
                <div className="parameter-control-container">
                  <input 
                    type="number" 
                    className="octane-number-input parameter-control" 
                    value={formatFloat(x)}
                    step={step}
                    onChange={(e) => handleValueChange({ x: formatFloat(parseFloat(e.target.value)), y, z, w })}
                                                  autoComplete="off"
                                name="octane-number-input-11"
                  />
                  <input 
                    type="number" 
                    className="octane-number-input parameter-control" 
                    value={formatFloat(y)}
                    step={step}
                    onChange={(e) => handleValueChange({ x, y: formatFloat(parseFloat(e.target.value)), z, w })}
                                                  autoComplete="off"
                                name="octane-number-input-12"
                  />
                  <input 
                    type="number" 
                    className="octane-number-input parameter-control" 
                    value={formatFloat(z)}
                    step={step}
                    onChange={(e) => handleValueChange({ x, y, z: formatFloat(parseFloat(e.target.value)), w })}
                                                  autoComplete="off"
                                name="octane-number-input-13"
                  />
                </div>
              );
              break;
            default: // 4 components
              controlHtml = (
                <div className="parameter-control-container">
                  <input 
                    type="number" 
                    className="octane-number-input parameter-control" 
                    value={formatFloat(x)}
                    step={step}
                    onChange={(e) => handleValueChange({ x: formatFloat(parseFloat(e.target.value)), y, z, w })}
                                                  autoComplete="off"
                                name="octane-number-input-14"
                  />
                  <input 
                    type="number" 
                    className="octane-number-input parameter-control" 
                    value={formatFloat(y)}
                    step={step}
                    onChange={(e) => handleValueChange({ x, y: formatFloat(parseFloat(e.target.value)), z, w })}
                                                  autoComplete="off"
                                name="octane-number-input-15"
                  />
                  <input 
                    type="number" 
                    className="octane-number-input parameter-control" 
                    value={formatFloat(z)}
                    step={step}
                    onChange={(e) => handleValueChange({ x, y, z: formatFloat(parseFloat(e.target.value)), w })}
                                                  autoComplete="off"
                                name="octane-number-input-16"
                  />
                  <input 
                    type="number" 
                    className="octane-number-input parameter-control" 
                    value={formatFloat(w)}
                    step={step}
                    onChange={(e) => handleValueChange({ x, y, z, w: formatFloat(parseFloat(e.target.value)) })}
                                                  autoComplete="off"
                                name="octane-number-input-17"
                  />
                </div>
              );
              break;
          }
        }
        break;
      }
      
      case AttrType.AT_INT: {
        const intValue = typeof value === 'number' ? value : 0;
        
        // Check if this is an enum (NT_ENUM) - render dropdown
        if (node.nodeInfo?.type === 'NT_ENUM' && node.pinInfo?.enumInfo?.values) {
          const enumOptions = node.pinInfo.enumInfo.values;
          controlHtml = (
            <div className="parameter-control-container">
              <select 
                className="octane-dropdown parameter-control" 
                value={intValue || 0}
                onChange={(e) => handleValueChange(parseInt(e.target.value))}
                                          name="octane-dropdown-18"
              >
                {enumOptions.map((option: any, idx: number) => (
                  <option key={idx} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          );
        } else {
          const intInfo = node.pinInfo?.intInfo;
          const useSliders = intInfo?.useSliders ?? true;
          const step = intInfo?.dimInfos?.[0]?.sliderStep ?? 1;
          
          controlHtml = (
            <div className="parameter-control-container">
              <div className="parameter-number-with-spinner">
                <input 
                  type="number" 
                  className="octane-number-input parameter-control" 
                  value={intValue || 0}
                  step={step}
                  onChange={(e) => handleValueChange(parseInt(e.target.value))}
                                              autoComplete="off"
                              name="octane-number-input-19"
                />
                {useSliders && (
                  <div className="parameter-spinner-container">
                    <button 
                      className="parameter-spinner-btn"
                      onClick={() => handleValueChange((intValue || 0) + step)}
                      title="Increase value"
                    >
                      ▲
                    </button>
                    <button 
                      className="parameter-spinner-btn"
                      onClick={() => handleValueChange((intValue || 0) - step)}
                      title="Decrease value"
                    >
                      ▼
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        }
        break;
      }
      
      case AttrType.AT_INT2: {
        if (value && typeof value === 'object' && 'x' in value) {
          const { x = 0, y = 0 } = value;
          const intInfo = node.pinInfo?.intInfo;
          const dimCount = intInfo?.dimCount ?? 2;
          const step = intInfo?.dimInfos?.[0]?.sliderStep ?? 1;
          
          controlHtml = (
            <div className="parameter-control-container">
              <input 
                type="number" 
                className="octane-number-input parameter-control" 
                value={x || 0}
                step={step}
                onChange={(e) => handleValueChange({ x: parseInt(e.target.value), y })}
                                          autoComplete="off"
                            name="octane-number-input-20"
              />
              {dimCount >= 2 && (
                <input 
                  type="number" 
                  className="octane-number-input parameter-control" 
                  value={y || 0}
                  step={step}
                  onChange={(e) => handleValueChange({ x, y: parseInt(e.target.value) })}
                                              autoComplete="off"
                              name="octane-number-input-21"
                />
              )}
            </div>
          );
        }
        break;
      }
      
      case AttrType.AT_INT3: {
        if (value && typeof value === 'object' && 'x' in value) {
          const { x = 0, y = 0, z = 0 } = value;
          const intInfo = node.pinInfo?.intInfo;
          const dimCount = intInfo?.dimCount ?? 3;
          const step = intInfo?.dimInfos?.[0]?.sliderStep ?? 1;
          
          controlHtml = (
            <div className="parameter-control-container">
              <input 
                type="number" 
                className="octane-number-input parameter-control" 
                value={x || 0}
                step={step}
                onChange={(e) => handleValueChange({ x: parseInt(e.target.value), y, z })}
                                          autoComplete="off"
                            name="octane-number-input-22"
              />
              {dimCount >= 2 && (
                <input 
                  type="number" 
                  className="octane-number-input parameter-control" 
                  value={y || 0}
                  step={step}
                  onChange={(e) => handleValueChange({ x, y: parseInt(e.target.value), z })}
                                              autoComplete="off"
                              name="octane-number-input-23"
                />
              )}
              {dimCount >= 3 && (
                <input 
                  type="number" 
                  className="octane-number-input parameter-control" 
                  value={z || 0}
                  step={step}
                  onChange={(e) => handleValueChange({ x, y, z: parseInt(e.target.value) })}
                                              autoComplete="off"
                              name="octane-number-input-24"
                />
              )}
            </div>
          );
        }
        break;
      }
      
      case AttrType.AT_INT4: {
        if (value && typeof value === 'object' && 'x' in value) {
          const { x = 0, y = 0, z = 0, w = 0 } = value;
          const intInfo = node.pinInfo?.intInfo;
          const dimCount = intInfo?.dimCount ?? 4;
          const step = intInfo?.dimInfos?.[0]?.sliderStep ?? 1;
          
          const inputs = [];
          if (dimCount >= 1) {
            inputs.push(
              <input 
                key="x"
                type="number" 
                className="octane-number-input parameter-control" 
                value={x || 0}
                step={step}
                onChange={(e) => handleValueChange({ x: parseInt(e.target.value), y, z, w })}
                                          autoComplete="off"
                            name="octane-number-input-25"
              />
            );
          }
          if (dimCount >= 2) {
            inputs.push(
              <input 
                key="y"
                type="number" 
                className="octane-number-input parameter-control" 
                value={y || 0}
                step={step}
                onChange={(e) => handleValueChange({ x, y: parseInt(e.target.value), z, w })}
                                          autoComplete="off"
                            name="octane-number-input-26"
              />
            );
          }
          if (dimCount >= 3) {
            inputs.push(
              <input 
                key="z"
                type="number" 
                className="octane-number-input parameter-control" 
                value={z || 0}
                step={step}
                onChange={(e) => handleValueChange({ x, y, z: parseInt(e.target.value), w })}
                                          autoComplete="off"
                            name="octane-number-input-27"
              />
            );
          }
          if (dimCount >= 4) {
            inputs.push(
              <input 
                key="w"
                type="number" 
                className="octane-number-input parameter-control" 
                value={w || 0}
                step={step}
                onChange={(e) => handleValueChange({ x, y, z, w: parseInt(e.target.value) })}
                                          autoComplete="off"
                            name="octane-number-input-28"
              />
            );
          }
          
          controlHtml = (
            <div className="parameter-control-container">
              {inputs}
            </div>
          );
        }
        break;
      }
      
      case AttrType.AT_LONG: {
        const longValue = typeof value === 'number' ? value : 0;
        controlHtml = (
          <div className="parameter-control-container">
            <div className="parameter-number-with-spinner">
              <input 
                type="number" 
                className="octane-number-input parameter-control" 
                value={longValue || 0}
                step="1"
                onChange={(e) => handleValueChange(parseInt(e.target.value))}
                                          autoComplete="off"
                            name="octane-number-input-29"
              />
              <div className="parameter-spinner-container">
                <button 
                  className="parameter-spinner-btn"
                  onClick={() => handleValueChange((longValue || 0) + 1)}
                  title="Increase value"
                >
                  ▲
                </button>
                <button 
                  className="parameter-spinner-btn"
                  onClick={() => handleValueChange((longValue || 0) - 1)}
                  title="Decrease value"
                >
                  ▼
                </button>
              </div>
            </div>
          </div>
        );
        break;
      }
      
      case AttrType.AT_LONG2: {
        if (value && typeof value === 'object' && 'x' in value) {
          const { x = 0, y = 0 } = value;
          controlHtml = (
            <div className="parameter-control-container">
              <input 
                type="number" 
                className="octane-number-input parameter-control" 
                value={x || 0}
                step="1"
                onChange={(e) => handleValueChange({ x: parseInt(e.target.value), y })}
                                          autoComplete="off"
                            name="octane-number-input-30"
              />
              <input 
                type="number" 
                className="octane-number-input parameter-control" 
                value={y || 0}
                step="1"
                onChange={(e) => handleValueChange({ x, y: parseInt(e.target.value) })}
                                          autoComplete="off"
                            name="octane-number-input-31"
              />
            </div>
          );
        }
        break;
      }
      
      case AttrType.AT_STRING: {
        const stringValue = typeof value === 'string' ? value : '';
        controlHtml = (
          <input 
            type="text" 
            className="octane-text-input parameter-control" 
            value={stringValue}
            onChange={(e) => handleValueChange(e.target.value)}
                                  autoComplete="off"
                        name="octane-text-input-32"
          />
        );
        break;
      }
      
      default: {
        // For unknown types, render as text input
        const stringValue = typeof value === 'string' ? value : '';
        controlHtml = (
          <input 
            type="text" 
            className="octane-text-input parameter-control" 
            value={stringValue}
            onChange={(e) => handleValueChange(e.target.value)}
                                  autoComplete="off"
                        name="octane-text-input-33"
          />
        );
        break;
      }
    }

    // Wrap in node-parameter-controls div (matching octaneWeb GenericNodeRenderer structure)
    return controlHtml ? (
      <div className="node-parameter-controls">
        {controlHtml}
      </div>
    ) : null;
  };

  // Determine the indent class (matching GenericNodeRenderer logic exactly)
  // octaneWeb logic: if ANY group exists at this level, ALL items at this level use node-indent-done
  // This is the hasGroup[level] logic from octaneWeb
  const hasGroupAtLevel = hasGroupMap.get(level) || false;
  const indentClass = level === 0 ? 'node-indent-0' : 
                     hasGroupAtLevel ? 'node-indent-done' : 
                     'node-indent';

  // Determine collapse/expand icon
  const collapseIcon = hasChildren && level > 0 ? (expanded ? '▼' : '▶') : '';

  // Render as parameter node (end node with attrInfo)
  if (node.attrInfo) {
    return (
      <div className={indentClass} style={{ display: 'block' }}>
        <div className="node-box-parameter" data-node-handle={node.handle} data-node-id={nodeId}>
          <div className="node-icon-box" style={{ backgroundColor: color }}>
            <img 
              src={icon} 
              alt="" 
              className="node-icon"
              width={20}
              height={20}
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/icons/EMPTY.png';
              }}
            />
          </div>
          <div className="node-content">
            <div className="node-label" onClick={hasChildren ? handleToggle : undefined}>
              {collapseIcon && <span className="collapse-icon">{collapseIcon}</span>}
              <span className="node-title">{name}</span>
              {renderParameterControl()}
            </div>
          </div>
        </div>
        {hasChildren && (
          <div 
            className="node-toggle-content"
            data-toggle-content={nodeId}
            style={{ display: expanded ? 'block' : 'none' }}
          >
            {node.children!.map((child, childIdx) => (
              <NodeParameter
                key={`${child.handle}-${childIdx}`}
                node={child}
                level={level + 1}
                onToggle={onToggle}
                hasGroupMap={hasGroupMap}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Render as node group (non-parameter nodes)
  return (
    <div className={indentClass} style={{ display: 'block' }}>
      <div className="node-box" data-node-handle={node.handle} data-node-id={nodeId}>
        <div className="node-icon-box" style={{ backgroundColor: color }}>
          <img 
            src={icon} 
            alt="" 
            className="node-icon"
            width={20}
            height={20}
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/icons/EMPTY.png';
            }}
          />
        </div>
        <div className="node-content">
          <div className="node-label" onClick={hasChildren ? handleToggle : undefined}>
            {collapseIcon && <span className="collapse-icon">{collapseIcon}</span>}
            <span className="node-title">{name}</span>
            {showDropdown && (
              <div 
                className="octane-inspector-dropdown-inline"
                onClick={(e) => e.stopPropagation()}
              >
                <select 
                  className="octane-inspector-target-select"
                  name="octane-inspector-target-select"
                  autoComplete="off"
                  value={currentNodeType}
                  onChange={handleNodeTypeChange}
                  onClick={(e) => e.stopPropagation()}
                >
                  {compatibleNodeTypes.map((nodeType) => {
                    const nodeTypeInfo = getNodeTypeInfo(nodeType);
                    const displayName = nodeTypeInfo?.name || nodeType.replace('NT_', '').replace(/_/g, ' ');
                    return (
                      <option key={nodeType} value={nodeType}>
                        {displayName}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>
      {hasChildren && (
        <div 
          className="node-toggle-content"
          data-toggle-content={nodeId}
          style={{ display: expanded ? 'block' : 'none' }}
        >
          {groupChildren(node.children!).map(({ groupName, children }, idx, arr) => {
            // Check if ANY child at this level has a group (matching octaneWeb's hasGroup[level] logic)
            const hasGroups = hasGroupMap.get(level + 1) || false;
            // Check if previous item had a groupName (octaneWeb's lgroup logic)
            const prevGroupName = idx > 0 ? arr[idx - 1].groupName : null;
            
            if (groupName) {
              return (
                <ParameterGroup key={`group-${groupName}-${idx}`} groupName={groupName}>
                  {children.map((child, childIdx) => (
                    <NodeParameter
                      key={`${child.handle}-${childIdx}`}
                      node={child}
                      level={level + 1}
                      onToggle={onToggle}
                      hasGroupMap={hasGroupMap}
                    />
                  ))}
                </ParameterGroup>
              );
            } else {
              // octaneWeb logic: ALL non-grouped items need .inspector-group-indent wrapper when hasGroups is true
              // - Items BEFORE first group: wrap WITHOUT empty header (no gap, but still indented)
              // - Items AFTER a group: wrap WITH empty header (maintains alignment after group)
              if (hasGroups) {
                if (prevGroupName) {
                  // After a group ended - include empty header for proper spacing
                  return (
                    <div key={`nogroup-${idx}`} className="inspector-group-indent">
                      <div className="inspector-group-header">
                        <span className="inspector-group-label"> </span>
                      </div>
                      <div>
                        {children.map((child, childIdx) => (
                          <NodeParameter
                            key={`${child.handle}-${childIdx}`}
                            node={child}
                            level={level + 1}
                            onToggle={onToggle}
                            hasGroupMap={hasGroupMap}
                          />
                        ))}
                      </div>
                    </div>
                  );
                } else {
                  // Before first group - just wrapper for indentation, NO header (no gap)
                  return (
                    <div key={`nogroup-${idx}`} className="inspector-group-indent">
                      {children.map((child, childIdx) => (
                        <NodeParameter
                          key={`${child.handle}-${childIdx}`}
                          node={child}
                          level={level + 1}
                          onToggle={onToggle}
                          hasGroupMap={hasGroupMap}
                        />
                      ))}
                    </div>
                  );
                }
              } else {
                // No groups at this level - no wrapper needed
                return (
                  <React.Fragment key={`nogroup-${idx}`}>
                    {children.map((child, childIdx) => (
                      <NodeParameter
                        key={`${child.handle}-${childIdx}`}
                        node={child}
                        level={level + 1}
                        onToggle={onToggle}
                        hasGroupMap={hasGroupMap}
                      />
                    ))}
                  </React.Fragment>
                );
              }
            }
          })}
        </div>
      )}
    </div>
  );
}

// Helper: Build a map of which levels have groups (matches octaneWeb's hasGroup[] array)
// This is used to determine indentation for all nodes at each level globally
function buildHasGroupMap(node: SceneNode, level: number, map: Map<number, boolean>): void {
  if (node.children && node.children.length > 0) {
    // Check if any child at the next level has a group
    const hasGroups = node.children.some(child => child.pinInfo?.groupName != null);
    if (hasGroups) {
      map.set(level + 1, true);
    }
    
    // Recursively process children
    for (const child of node.children) {
      buildHasGroupMap(child, level + 1, map);
    }
  }
}

// Helper: Group children by pinInfo.groupName
function groupChildren(children: SceneNode[]): Array<{ groupName: string | null; children: SceneNode[] }> {
  const groups: Array<{ groupName: string | null; children: SceneNode[] }> = [];
  let currentGroup: { groupName: string | null; children: SceneNode[] } | null = null;

  for (const child of children) {
    const groupName = child.pinInfo?.groupName || null;
    
    if (!currentGroup || currentGroup.groupName !== groupName) {
      currentGroup = { groupName, children: [] };
      groups.push(currentGroup);
    }
    
    currentGroup.children.push(child);
  }

  return groups;
}

export const NodeInspector = React.memo(function NodeInspector({ node }: NodeInspectorProps) {
  const { client } = useOctane();
  
  // Context menu state
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  
  // NOTE: Node expansion state is managed internally by NodeParameter component
  const handleToggle = (_nodeId: string) => {
    // Placeholder for future centralized expansion state management
  };
  
  // Context menu handler
  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
    setContextMenuVisible(true);
  };
  
  // Context menu action handlers
  const handleContextMenuClose = () => {
    setContextMenuVisible(false);
  };
  
  const handleSave = () => {
    Logger.debug('💾 Save action for node:', node?.name);
    // TODO: Implement save action
  };
  
  const handleCut = () => {
    Logger.debug('✂️ Cut action for node:', node?.name);
    // TODO: Implement cut action
  };
  
  const handleCopy = () => {
    Logger.debug('📋 Copy action for node:', node?.name);
    // TODO: Implement copy action
  };
  
  const handlePaste = () => {
    Logger.debug('📌 Paste action for node:', node?.name);
    // TODO: Implement paste action
  };
  
  const handleFillEmptyPins = () => {
    Logger.debug('📌 Fill empty pins for node:', node?.name);
    // TODO: Implement fill empty pins action
  };
  
  const handleDelete = async () => {
    if (!node || !client) return;
    
    Logger.debug('🗑️ Delete action for node:', node.name);
    
    // Use unified EditCommands for consistent delete behavior
    // Note: App.tsx listens to 'nodeDeleted' event and clears selection
    await EditCommands.deleteNodes({
      client,
      selectedNodes: [node],
      onComplete: () => {
        Logger.debug('✅ Delete operation completed from NodeInspector');
      }
    });
  };
  
  const handleExpand = () => {
    Logger.debug('📂 Expand action for node:', node?.name);
    // TODO: Implement expand all children action
  };
  
  const handleShowInOutliner = () => {
    Logger.debug('🔍 Show in Outliner:', node?.name);
    // TODO: Implement outliner navigation
  };
  
  const handleShowInGraphEditor = () => {
    Logger.debug('🔍 Show in Graph Editor:', node?.name);
    // TODO: Implement graph editor navigation
  };
  
  const handleShowInLuaBrowser = () => {
    Logger.debug('🔍 Show in Lua Browser:', node?.name);
    // TODO: Implement Lua browser navigation
  };

  if (!node) {
    return (
      <div className="node-inspector">
        <div className="inspector-content">
          <div className="scene-loading">Click refresh to load scene</div>
        </div>
      </div>
    );
  }

  // Build hasGroup map for all levels (matches octaneWeb's hasGroup[] array logic)
  // This ensures that all siblings at the same level have consistent indentation
  const hasGroupMap = new Map<number, boolean>();
  buildHasGroupMap(node, 0, hasGroupMap);

  return (
    <div className="octane-node-inspector" onContextMenu={handleContextMenu}>
      {/* Content */}
      <div className="octane-inspector-content">
        <NodeParameter 
          node={node} 
          level={0} 
          onToggle={handleToggle}
          hasGroupMap={hasGroupMap}
        />
      </div>
      
      {/* Context Menu */}
      {contextMenuVisible && (
        <NodeInspectorContextMenu
          x={contextMenuPosition.x}
          y={contextMenuPosition.y}
          onSave={handleSave}
          onCut={handleCut}
          onCopy={handleCopy}
          onPaste={handlePaste}
          onFillEmptyPins={handleFillEmptyPins}
          onDelete={handleDelete}
          onExpand={handleExpand}
          onShowInOutliner={handleShowInOutliner}
          onShowInGraphEditor={handleShowInGraphEditor}
          onShowInLuaBrowser={handleShowInLuaBrowser}
          onClose={handleContextMenuClose}
        />
      )}
    </div>
  );
});
