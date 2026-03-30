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
const MCP_BUILD = 70;
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

export function registerInfoTools(
  server: McpServer,
  client: OctaneMcpClient,
  cache: ApiCache | null
) {
  server.tool(
    'get_octane_version',
    'Get the Octane version, license information, and octaneWebR version',
    {},
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

  server.tool(
    'get_device_info',
    'Get GPU device information including name and memory usage',
    { device_index: z.number().default(0).describe('GPU device index (default 0)') },
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

  server.tool(
    'list_node_types',
    'List available Octane node types, attribute types, and attribute IDs. Use category to filter node types by prefix (e.g. "CAM" for cameras, "MAT" for materials, "TEX" for textures, "GEO" for geometry, "LIGHT" for lights, "ENV" for environments, "KERN" for kernels).',
    {
      category: z
        .string()
        .optional()
        .describe('Filter node types by prefix, e.g. "CAM", "MAT", "TEX", "GEO", "LIGHT"'),
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

  // ── Profiling tools ──────────────────────────────────────────────

  server.tool(
    'profile_start',
    'Start a named profile span. Use to time high-level phases (e.g. "infra_setup", "geo_build", "materials").',
    { label: z.string().describe('Name for this profile span') },
    async ({ label }) => {
      profileStart(label);
      return jsonResult({ started: label });
    }
  );

  server.tool(
    'profile_end',
    'End a named profile span started with profile_start.',
    { label: z.string().describe('Name of the span to end') },
    async ({ label }) => {
      const ms = profileEnd(label);
      return jsonResult({ ended: label, durationMs: Math.round(ms) });
    }
  );

  server.tool(
    'profile_report',
    'Get profiling report: wall clock time, gRPC call breakdown by method, overhead analysis. Call after a build to see where time went.',
    {},
    async () => {
      const report = profileReport();
      // Format a human-readable summary too
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
  );

  server.tool(
    'profile_reset',
    'Reset all profiling data. Call before starting a timed build run.',
    {},
    async () => {
      profileReset();
      return jsonResult({ reset: true });
    }
  );

  server.tool(
    'clear_log',
    'Clear the log_mcp.log file to start with a fresh log. Returns the line count of the old log.',
    {},
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
}
