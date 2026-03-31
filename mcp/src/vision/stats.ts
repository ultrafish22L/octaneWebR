/**
 * Score Stats — append-only JSONL log per scene for audit trail and system tuning.
 *
 * Each score_render call appends one line to {scene_folder}/score_stats.jsonl.
 * Tracks Sonnet comparison scores plus orchestrator grades.
 */

import fs from 'fs';
import path from 'path';
import { mcpLog } from '../OctaneMcpClient';
import type { ScoreScores } from '../ArtDirectionState';
import type { ComparisonScoreResult } from './index';

export interface ScoreStatsEntry {
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
    composition_match: number;
    lighting_match: number;
    material_match: number;
    mood_match: number;
    depth_match: number;
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
 * Append a score stats entry to the scene's JSONL file.
 * Derives scene folder from render_path (goes up until it finds score_stats.jsonl
 * or uses the render's parent directory).
 */
export function appendScoreStats(
  renderPath: string,
  iteration: number,
  structuralScores: ScoreScores,
  structuralOverall: number,
  structuralPassed: boolean,
  options?: {
    phase?: number;
    comparison?: ComparisonScoreResult;
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
    const statsPath = path.join(sceneDir, 'score_stats.jsonl');

    const entry: ScoreStatsEntry = {
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
        composition_match: options.comparison.composition_match,
        lighting_match: options.comparison.lighting_match,
        material_match: options.comparison.material_match,
        mood_match: options.comparison.mood_match,
        depth_match: options.comparison.depth_match,
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
    mcpLog(`VISION/stats: appended score #${iteration} to ${statsPath}`, 'info');
  } catch (error: any) {
    mcpLog(`VISION/stats: failed to write stats: ${error.message}`, 'warn');
    // Non-fatal — don't break score flow for stats
  }
}
