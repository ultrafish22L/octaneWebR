/**
 * Critique Stats — append-only JSONL log per scene for audit trail and system tuning.
 *
 * Each critique_render call appends one line to {scene_folder}/critique_stats.jsonl.
 * Tracks Sonnet comparison scores plus orchestrator grades.
 */

import fs from 'fs';
import path from 'path';
import { mcpLog } from '../OctaneMcpClient';
import type { CritiqueScores } from '../ArtDirectionState';
import type { ComparisonCritiqueResult } from './index';

export interface CritiqueStatsEntry {
  timestamp: string;
  iteration: number;
  phase?: number;
  render_path: string;
  structural: {
    framing: number;
    depth: number;
    composition: number;
    lighting: number;
    placement: number;
    overall: number;
    passed: boolean;
  };
  comparison?: {
    grade: string;
    mood_match: number;
    density_match: number;
    composition_match: number;
    missing_elements: string[];
    top_fixes: string[];
  };
  orchestrator?: {
    grade: string;
    agrees_with_sonnet: boolean;
    notes: string;
  };
  sonnet_model?: string;
  sonnet_latency_ms?: number;
  structural_model?: string;
  structural_latency_ms?: number;
}

/**
 * Append a critique stats entry to the scene's JSONL file.
 * Derives scene folder from render_path (goes up until it finds critique_stats.jsonl
 * or uses the render's parent directory).
 */
export function appendCritiqueStats(
  renderPath: string,
  iteration: number,
  structuralScores: CritiqueScores,
  structuralOverall: number,
  structuralPassed: boolean,
  options?: {
    phase?: number;
    comparison?: ComparisonCritiqueResult;
    orchestrator?: { grade: string; agrees_with_sonnet: boolean; notes: string };
    structuralModel?: string;
    structuralLatencyMs?: number;
  }
): void {
  try {
    // Write stats next to the render (typically scene_folder/temp/ or scene_folder/)
    const renderDir = path.dirname(path.resolve(renderPath));
    // Go up one level if we're in temp/
    const sceneDir = path.basename(renderDir) === 'temp' ? path.dirname(renderDir) : renderDir;
    const statsPath = path.join(sceneDir, 'critique_stats.jsonl');

    const entry: CritiqueStatsEntry = {
      timestamp: new Date().toISOString(),
      iteration,
      phase: options?.phase,
      render_path: path.resolve(renderPath),
      structural: {
        ...structuralScores,
        overall: structuralOverall,
        passed: structuralPassed,
      },
    };

    if (options?.comparison) {
      entry.comparison = {
        grade: options.comparison.grade,
        mood_match: options.comparison.mood_match,
        density_match: options.comparison.density_match,
        composition_match: options.comparison.composition_match,
        missing_elements: options.comparison.missing_elements,
        top_fixes: options.comparison.top_fixes,
      };
      entry.sonnet_model = options.comparison.model;
      entry.sonnet_latency_ms = options.comparison.latency_ms;
    }

    if (options?.orchestrator) {
      entry.orchestrator = options.orchestrator;
    }

    if (options?.structuralModel) {
      entry.structural_model = options.structuralModel;
    }
    if (options?.structuralLatencyMs !== undefined) {
      entry.structural_latency_ms = options.structuralLatencyMs;
    }

    fs.appendFileSync(statsPath, JSON.stringify(entry) + '\n', 'utf-8');
    mcpLog(`VISION/stats: appended critique #${iteration} to ${statsPath}`, 'info');
  } catch (error: any) {
    mcpLog(`VISION/stats: failed to write stats: ${error.message}`, 'warn');
    // Non-fatal — don't break critique flow for stats
  }
}
