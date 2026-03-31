/**
 * Animation Tool — consolidated query, set, and clear animation data
 *
 * Octane animation is node-based (animator nodes on pins + scripted graphs),
 * not a traditional keyframe timeline. This tool manages animation state.
 *
 * Actions:
 *   range  — get total animation time span
 *   check  — check if a single attribute is animated
 *   list   — list all animated attributes on a node
 *   get    — read animation keyframes for an attribute
 *   set    — write animation keyframes for an attribute
 *   clear  — remove animation from an attribute
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OctaneMcpClient, mcpLogLazy } from '../OctaneMcpClient';
import { jsonResult, errorResult, extractValue, OBJ_API_ITEM } from './utils';

// ObjectRef type for root node graph (ApiRootNodeGraph)
const OBJ_API_ROOT_NODE_GRAPH = 18;

export function registerAnimationTools(server: McpServer, client: OctaneMcpClient) {
  server.registerTool(
    'animation',
    {
      title: 'Animation',
      description:
        'Manage node animation. Call describe_tool("animation") for params. Actions: range, check, list, get, set, clear.',
      inputSchema: {
        action: z.enum(['range', 'check', 'list', 'get', 'set', 'clear']),
        handle: z.number().int().nonnegative().optional(),
        attribute_id: z.number().optional(),
        expected_type: z.number().optional(),
        pattern: z.array(z.number()).optional(),
        values: z
          .array(z.union([z.number(), z.object({ x: z.number(), y: z.number(), z: z.number() })]))
          .optional(),
        period: z.number().optional().default(1.0),
        animation_type: z.number().int().min(0).max(2).optional().default(0),
      },
    },
    async ({
      action,
      handle,
      attribute_id,
      expected_type,
      pattern,
      values,
      period,
      animation_type,
    }) => {
      try {
        switch (action) {
          case 'range': {
            const rootHandle = await client.getRootNodeGraph();
            const result = await client.callMethod('ApiRootNodeGraph', 'animationTimeSpan', {
              objectPtr: { handle: String(rootHandle), type: OBJ_API_ROOT_NODE_GRAPH },
            });
            const timeSpan = result?.result ?? result;
            return jsonResult({ success: true, time_span: timeSpan });
          }

          case 'check': {
            if (handle === undefined) return errorResult('handle is required for action "check"');
            if (attribute_id === undefined)
              return errorResult('attribute_id is required for action "check"');
            const result = await client.callMethod('ApiItem', 'isAnimated', {
              objectPtr: { handle: String(handle), type: OBJ_API_ITEM },
              id: attribute_id,
            });
            return jsonResult({
              handle,
              attribute_id,
              is_animated: result?.result ?? false,
            });
          }

          case 'list': {
            if (handle === undefined) return errorResult('handle is required for action "list"');
            const countResult = await client.callMethod('ApiItem', 'attrCount', {
              objectPtr: { handle: String(handle), type: OBJ_API_ITEM },
            });
            const count = Number(countResult?.result ?? 0);

            const animated: { attribute_id: number; description: string }[] = [];
            for (let i = 0; i < count; i++) {
              try {
                const idResult = await client.callMethod('ApiItem', 'attrIdIx', {
                  objectPtr: { handle: String(handle), type: OBJ_API_ITEM },
                  index: i,
                });
                const attrId = Number(idResult?.result ?? 0);

                const animResult = await client.callMethod('ApiItem', 'isAnimatedIx', {
                  objectPtr: { handle: String(handle), type: OBJ_API_ITEM },
                  index: i,
                });
                if (animResult?.result) {
                  const infoResult = await client.callMethod('ApiItem', 'attrInfoIx', {
                    objectPtr: { handle: String(handle), type: OBJ_API_ITEM },
                    index: i,
                  });
                  animated.push({
                    attribute_id: attrId,
                    description: infoResult?.result?.description ?? '',
                  });
                }
              } catch (e: any) {
                mcpLogLazy('verbose', () => `[animation:list:attr:${i}] ${e?.message ?? e}`);
              }
            }

            return jsonResult({
              handle,
              total_attributes: count,
              animated_count: animated.length,
              animated_attributes: animated,
            });
          }

          case 'get': {
            if (handle === undefined) return errorResult('handle is required for action "get"');
            if (attribute_id === undefined)
              return errorResult('attribute_id is required for action "get"');
            if (expected_type === undefined)
              return errorResult('expected_type is required for action "get"');

            const result = await client.callMethod('ApiItem', 'getAnimByAttr', {
              objectPtr: { handle: String(handle), type: OBJ_API_ITEM },
              attribute_id,
              expected_type,
              want_num_samples: true,
            });

            const times = result?.times;
            const numSamples = result?.num_time_samples;
            const arrayData =
              result?.float_array ??
              result?.float3_array ??
              result?.int_array ??
              result?.bool_array ??
              result?.string_array ??
              null;

            return jsonResult({
              handle,
              attribute_id,
              time_sampling: times
                ? {
                    pattern: times.pattern,
                    pattern_size: times.patternSize,
                    period: times.period,
                    animation_type: times.animationType,
                    end_time: times.endTime,
                  }
                : null,
              num_time_samples: numSamples,
              values: arrayData,
            });
          }

          case 'set': {
            if (handle === undefined) return errorResult('handle is required for action "set"');
            if (attribute_id === undefined)
              return errorResult('attribute_id is required for action "set"');
            if (expected_type === undefined)
              return errorResult('expected_type is required for action "set"');
            if (!pattern) return errorResult('pattern is required for action "set"');
            if (!values) return errorResult('values is required for action "set"');
            if (pattern.length !== values.length) {
              return errorResult(
                `pattern length (${pattern.length}) must match values length (${values.length})`
              );
            }

            const times = {
              pattern: { data: pattern.map((t: number) => ({ value: t })) },
              patternSize: pattern.length,
              period: { value: period },
              animationType: animation_type,
              endTime: { value: Math.max(...pattern) },
            };

            let arrayField: Record<string, any> = {};
            if (expected_type === 9) {
              arrayField = { float_array: { data: values as number[] } };
            } else if (expected_type === 11) {
              arrayField = { float3_array: { data: values } };
            } else if (expected_type === 3) {
              arrayField = { int_array: { data: values as number[] } };
            } else if (expected_type === 1) {
              arrayField = { bool_array: { data: values as number[] } };
            } else {
              return errorResult(
                `Unsupported animation type: ${expected_type}. Use 9 (float), 11 (float3), 3 (int), or 1 (bool).`
              );
            }

            const result = await client.callMethod('ApiItem', 'setAnimByAttr', {
              objectPtr: { handle: String(handle), type: OBJ_API_ITEM },
              attribute_id,
              times,
              num_time_samples: pattern.length,
              evaluate: true,
              ...arrayField,
            });

            return jsonResult({
              success: result?.success ?? true,
              handle,
              attribute_id,
              keyframe_count: pattern.length,
              error_message: result?.error_message,
            });
          }

          case 'clear': {
            if (handle === undefined) return errorResult('handle is required for action "clear"');
            if (attribute_id === undefined)
              return errorResult('attribute_id is required for action "clear"');

            await client.callMethod('ApiItem', 'clearAnim', {
              objectPtr: { handle: String(handle), type: OBJ_API_ITEM },
              id: attribute_id,
            });

            return jsonResult({
              success: true,
              handle,
              attribute_id,
              message: 'Animation cleared — attribute reverted to static value.',
            });
          }
        }
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );
}
