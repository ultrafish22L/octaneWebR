/**
 * Info Tools — list_node_types, get_device_info, get_octane_version
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

// Read MCP server version from package.json at startup
const mcpPkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8'));
const MCP_SERVER_VERSION: string = mcpPkg.version || 'unknown';

// Build number — increment on every code change to verify running code matches build.
// Check with get_octane_version() → mcp_build field.
const MCP_BUILD = 74;
import {
  OctaneMcpClient,
  MCP_LOG_PATH,
  mcpLogReset,
  profileReport,
  profileReset,
  profileStart,
  profileEnd,
} from '../OctaneMcpClient';

import { AttrType, AttributeId, OBJ_API_ITEM, OBJ_API_NODE } from '../shared/OctaneConstants';
import { ApiCache } from '../ApiCache';

import { jsonResult, errorResult } from './utils';
import { searchCatalog, getCatalogEntry, TOOL_CATALOG } from './tool-catalog';

export function registerInfoTools(
  server: McpServer,
  client: OctaneMcpClient,
  cache: ApiCache | null
) {
  server.registerTool(
    'get_octane_version',
    {
      title: 'Octane Version',
      description: 'Get the Octane version, license information, and octaneWebR version',
      annotations: { readOnlyHint: true },
    },
    async () => {
      try {
        const info = await client.getSessionInfo();
        let serv_build = 0;
        let serv_diagnostics: Record<string, number> | undefined;
        try {
          const sv = await client.callMethod('LiveLink', 'GetServVersion', {});
          serv_build = (sv as any)?.build ?? 0;
          const handleCount = Number((sv as any)?.handle_count ?? (sv as any)?.handleCount ?? 0);
          const staleEvictions = Number(
            (sv as any)?.stale_evictions ?? (sv as any)?.staleEvictions ?? 0
          );
          if (handleCount || staleEvictions) {
            serv_diagnostics = { handle_count: handleCount, stale_evictions: staleEvictions };
          }
        } catch {
          /* old serv without GetServVersion */
        }
        return jsonResult({
          ...info,
          octaneweb_version: MCP_SERVER_VERSION,
          mcp_build: MCP_BUILD,
          serv_build,
          ...(serv_diagnostics ? { serv_diagnostics } : {}),
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    'get_device_info',
    {
      title: 'Device Info',
      description: 'Get GPU device name and memory usage.',
      inputSchema: { device_index: z.number().default(0) },
      annotations: { readOnlyHint: true },
    },
    async ({ device_index }) => {
      try {
        const count = await client.getDeviceCount();
        const name = await client.getDeviceName(device_index);
        // Memory is dynamic — always query fresh
        const memory = await client.callMethod('ApiRenderEngine', 'getMemoryUsage', {
          deviceIndex: device_index,
        });
        return jsonResult({
          device_count: count,
          name: name,
          memory: memory,
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  server.registerTool(
    'list_node_types',
    {
      title: 'List Node Types',
      description:
        'List available Octane node types, attribute types, and attribute IDs. Filter by category prefix (e.g. "CAM", "MAT", "TEX", "GEO", "LIGHT").',
      inputSchema: {
        category: z
          .string()
          .optional()
          .describe('Filter node types by prefix, e.g. "CAM", "MAT", "TEX", "GEO", "LIGHT"'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ category }) => {
      try {
        // Build node type → id map from cache
        let nodeTypes: Record<string, number> = {};
        if (cache) {
          for (const name of cache.getNodeTypeNames()) {
            const id = cache.getNodeTypeId(name);
            if (id !== undefined) nodeTypes[name] = id;
          }
        }

        if (category) {
          const prefix = `NT_${category.toUpperCase()}`;
          const filtered: Record<string, number> = {};
          for (const [key, value] of Object.entries(nodeTypes)) {
            if (key.startsWith(prefix)) {
              filtered[key] = value;
            }
          }
          nodeTypes = filtered;
        }

        return jsonResult({
          node_types: nodeTypes,
          attr_types: AttrType,
          attribute_ids: AttributeId,
          object_types: { ApiItem: OBJ_API_ITEM, ApiNode: OBJ_API_NODE },
        });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  // ── Profiling tool (consolidated) ─────────────────────────────────

  server.registerTool(
    'profile',
    {
      title: 'Profile',
      description: '[Debug] Performance profiling. Call describe_tool("profile") for params.',
      inputSchema: {
        action: z.enum(['start', 'end', 'report', 'reset']),
        label: z.string().optional(),
      },
    },
    async ({ action, label }) => {
      switch (action) {
        case 'start':
          if (!label) return errorResult('label is required for action "start"');
          profileStart(label);
          return jsonResult({ started: label });

        case 'end':
          if (!label) return errorResult('label is required for action "end"');
          const ms = profileEnd(label);
          return jsonResult({ ended: label, durationMs: Math.round(ms) });

        case 'report': {
          const report = profileReport();
          const lines = [
            `=== PROFILE REPORT ===`,
            `Wall clock:    ${(report.wallClockMs / 1000).toFixed(1)}s`,
            `gRPC total:    ${(report.totalGrpcMs / 1000).toFixed(1)}s (${report.grpcCallCount} calls)`,
            `Overhead:      ${(report.totalOverheadMs / 1000).toFixed(1)}s (mutex waits + serialization + MCP transport)`,
            ``,
            `── gRPC by method ──`,
            ...report.grpcByMethod.map(
              m =>
                `  ${m.method.padEnd(40)} ${String(m.count).padStart(3)}x  ${String(m.avgMs).padStart(4)}ms avg  ${String(m.totalMs).padStart(6)}ms total`
            ),
          ];
          if (report.spans.length > 0) {
            lines.push(``, `── Manual spans ──`);
            for (const s of report.spans) {
              lines.push(`  ${s.label.padEnd(40)} ${String(s.durationMs).padStart(6)}ms`);
            }
          }
          return {
            content: [{ type: 'text' as const, text: lines.join('\n') }],
          };
        }

        case 'reset':
          profileReset();
          return jsonResult({ reset: true });
      }
    }
  );

  server.registerTool(
    'clear_log',
    {
      title: 'Clear Log',
      description: 'Clear log_mcp.log for fresh debugging session.',
      annotations: { destructiveHint: true },
    },
    async () => {
      try {
        let oldLines = 0;
        if (fs.existsSync(MCP_LOG_PATH)) {
          const content = fs.readFileSync(MCP_LOG_PATH, 'utf-8');
          oldLines = content.split('\n').length;
          // Close the write stream before truncating, then let it reopen on next write
          mcpLogReset();
          fs.writeFileSync(MCP_LOG_PATH, '');
        }
        return jsonResult({ cleared: true, old_line_count: oldLines, path: MCP_LOG_PATH });
      } catch (error: any) {
        return errorResult(error);
      }
    }
  );

  // ── Discovery tools ─────────────────────────────────────────────

  server.registerTool(
    'search_tools',
    {
      title: 'Search Tools',
      description:
        'Search all MCP tools by keyword. Returns matching tool names, summaries, and categories. Use before calling unfamiliar tools.',
      inputSchema: {
        query: z
          .string()
          .describe('Keywords to search (e.g. "lighting", "animation set", "phase 2")'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query }) => {
      const results = searchCatalog(query);
      if (results.length === 0) {
        return jsonResult({
          query,
          matches: 0,
          hint: `No tools match "${query}". Try broader terms. Categories: ${[...new Set(TOOL_CATALOG.map(t => t.category))].join(', ')}`,
        });
      }
      return jsonResult({
        query,
        matches: results.length,
        tools: results.map(t => ({
          name: t.name,
          summary: t.summary,
          category: t.category,
          ...(t.phase ? { phase: t.phase } : {}),
          has_detailed_docs: !!t.params,
        })),
      });
    }
  );

  server.registerTool(
    'describe_tool',
    {
      title: 'Describe Tool',
      description:
        'Get full parameter documentation for a tool. Essential for long-tail tools with slim schemas — returns the complete param descriptions.',
      inputSchema: {
        name: z.string().describe('Tool name (e.g. "animation", "save_render_passes")'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ name }) => {
      const entry = getCatalogEntry(name);
      if (!entry) {
        return errorResult(`Unknown tool: "${name}". Use search_tools to find available tools.`);
      }
      return jsonResult({
        name: entry.name,
        summary: entry.summary,
        category: entry.category,
        ...(entry.phase ? { phase: entry.phase } : {}),
        params: entry.params ?? 'Full parameter docs are in the tool schema (core tool).',
      });
    }
  );
}
