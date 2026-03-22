/**
 * Animation Tools — query animation data, check animated state, clear animation
 *
 * Octane animation is node-based (animator nodes on pins + scripted graphs),
 * not a traditional keyframe timeline. These tools query and manage animation state.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OctaneMcpClient, mcpLogLazy } from '../OctaneMcpClient';
import { jsonResult, errorResult, gateHandle, extractValue, OBJ_API_ITEM } from './utils';
import { enumeratePins } from './pin-utils';

// ObjectRef type for root node graph (ApiRootNodeGraph)
const OBJ_API_ROOT_NODE_GRAPH = 18;

export function registerAnimationTools(server: McpServer, client: OctaneMcpClient) {
  server.tool(
    'get_animation_range',
    'Get the total time span for all animations in the scene. Returns start/end times in seconds. Useful for knowing the animation duration before rendering frames.',
    {},
    async () => {
      try {
        const rootHandle = await client.getRootNodeGraph();
        const result = await client.callMethod('ApiRootNodeGraph', 'animationTimeSpan', {
          objectPtr: { handle: String(rootHandle), type: OBJ_API_ROOT_NODE_GRAPH },
        });
        const timeSpan = result?.result ?? result;
        return jsonResult({
          success: true,
          time_span: timeSpan,
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'get_animation_data',
    'Read animation values for an attribute. Returns time samples and value arrays. The attribute must have an animator attached (check with is_animated first).',
    {
      handle: z.number().int().nonnegative().describe('Node handle'),
      attribute_id: z.number().describe('Attribute ID to read animation from'),
      expected_type: z.number().describe('AttrType enum value (1=bool, 3=int, 9=float, 11=float3)'),
    },
    async ({ handle, attribute_id, expected_type }) => {
      try {
        const gated = gateHandle('get_animation_data', handle, client.sceneCache);
        if (gated) return gated;

        const result = await client.callMethod('ApiItem', 'getAnimByAttr', {
          item_ref: { handle: String(handle), type: OBJ_API_ITEM },
          attribute_id,
          expected_type,
          want_num_samples: true,
        });

        // Parse the response — contains ApiTimeSampling + typed value array
        const times = result?.times;
        const numSamples = result?.num_time_samples;

        // Extract whichever array type was returned (oneof)
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
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'is_node_animated',
    'Check which attributes on a node are animated. Returns a list of animated attribute IDs. Bulk check — iterates all attributes and tests each for animation.',
    {
      handle: z.number().int().nonnegative().describe('Node handle'),
    },
    async ({ handle }) => {
      try {
        const gated = gateHandle('is_node_animated', handle, client.sceneCache);
        if (gated) return gated;

        // Get attribute count
        const countResult = await client.callMethod('ApiItem', 'attrCount', {
          objectPtr: { handle: String(handle), type: OBJ_API_ITEM },
        });
        const count = Number(countResult?.result ?? 0);

        const animated: { attribute_id: number; description: string }[] = [];
        for (let i = 0; i < count; i++) {
          try {
            // Get attr ID at index
            const idResult = await client.callMethod('ApiItem', 'attrIdIx', {
              objectPtr: { handle: String(handle), type: OBJ_API_ITEM },
              index: i,
            });
            const attrId = Number(idResult?.result ?? 0);

            // Check if animated
            const animResult = await client.callMethod('ApiItem', 'isAnimatedIx', {
              objectPtr: { handle: String(handle), type: OBJ_API_ITEM },
              index: i,
            });
            if (animResult?.result) {
              // Get description
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
            mcpLogLazy(
              'verbose',
              () => `[animation:is_node_animated:attr:${i}] ${e?.message ?? e}`
            );
            // Skip unreadable attributes
          }
        }

        return jsonResult({
          handle,
          total_attributes: count,
          animated_count: animated.length,
          animated_attributes: animated,
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'set_animation_data',
    'Write animation values for an attribute. Provide time pattern + value arrays. Animation type: 0=LOOPING, 1=PING_PONG, 2=SINGLE_SHOT.',
    {
      handle: z.number().int().nonnegative().describe('Node handle'),
      attribute_id: z.number().describe('Attribute ID to animate'),
      expected_type: z.number().describe('AttrType (9=float, 11=float3)'),
      pattern: z.array(z.number()).describe('Time values in seconds (e.g. [0, 0.5, 1.0])'),
      values: z
        .array(z.union([z.number(), z.object({ x: z.number(), y: z.number(), z: z.number() })]))
        .describe('Values at each time point (same length as pattern)'),
      period: z.number().optional().default(1.0).describe('Period in seconds (default 1.0)'),
      animation_type: z
        .number()
        .int()
        .min(0)
        .max(2)
        .optional()
        .default(0)
        .describe('0=LOOPING, 1=PING_PONG, 2=SINGLE_SHOT'),
    },
    async ({ handle, attribute_id, expected_type, pattern, values, period, animation_type }) => {
      try {
        const gated = gateHandle('set_animation_data', handle, client.sceneCache);
        if (gated) return gated;

        if (pattern.length !== values.length) {
          return errorResult(
            `pattern length (${pattern.length}) must match values length (${values.length})`
          );
        }

        // Build time sampling — pattern is TimeArrayT { repeated TimeT data }
        // where TimeT = { value: float }
        const times = {
          pattern: { data: pattern.map((t: number) => ({ value: t })) },
          patternSize: pattern.length,
          period: { value: period },
          animationType: animation_type,
          endTime: { value: Math.max(...pattern) },
        };

        // Build typed value array based on expected_type
        let arrayField: Record<string, any> = {};
        if (expected_type === 9) {
          // AT_FLOAT
          arrayField = { float_array: { data: values as number[] } };
        } else if (expected_type === 11) {
          // AT_FLOAT3
          arrayField = { float3_array: { data: values } };
        } else if (expected_type === 3) {
          // AT_INT
          arrayField = { int_array: { data: values as number[] } };
        } else if (expected_type === 1) {
          // AT_BOOL
          arrayField = { bool_array: { data: values as number[] } };
        } else {
          return errorResult(
            `Unsupported animation type: ${expected_type}. Use 9 (float), 11 (float3), 3 (int), or 1 (bool).`
          );
        }

        const result = await client.callMethod('ApiItem', 'setAnimByAttr', {
          item_ref: { handle: String(handle), type: OBJ_API_ITEM },
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
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.tool(
    'clear_animation',
    'Remove animation from an attribute. The attribute reverts to its static value.',
    {
      handle: z.number().int().nonnegative().describe('Node handle'),
      attribute_id: z.number().describe('Attribute ID to clear animation from'),
    },
    async ({ handle, attribute_id }) => {
      try {
        const gated = gateHandle('clear_animation', handle, client.sceneCache);
        if (gated) return gated;

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
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );
}
