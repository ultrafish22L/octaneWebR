/**
 * NLParser — builds prompts for LLM-based natural language → semantic vector parsing.
 *
 * No custom NLP — the dimension registry (names + aliases) is injected into
 * a structured prompt. The LLM maps speech to delta vectors.
 *
 * Self-learning hook: could analyze LearnedAdjustments to weight common
 * user phrasings → dimension mappings, but for now is purely prompt-based.
 */

import type { SemanticVector } from './types';
import { DIMENSIONS } from './registry';

export interface NLParseResult {
  deltas: SemanticVector;
  mode: 'absolute' | 'relative';
  confidence: number;
  presetMatch?: string; // if NL maps to a known preset
}

/**
 * Build the system prompt for NL → semantic vector parsing.
 * Inject the full dimension registry so the LLM knows what's available.
 */
export function buildNLParsePrompt(): string {
  const dimList = DIMENSIONS.map(d => {
    const posAliases = d.aliases.join(', ');
    const negAliases = d.negativeAliases.join(', ');
    return `- **${d.name}** [${d.negativeLabel} ← → ${d.positiveLabel}]
    Positive triggers: ${posAliases}
    Negative triggers: ${negAliases}`;
  }).join('\n');

  return `You are a semantic vector parser for a 3D rendering system.
Given a natural language description, map it to dimension values in [-1.0, +1.0].

AVAILABLE DIMENSIONS:
${dimList}

RULES:
1. Only use dimensions listed above. Ignore words that don't match any dimension.
2. Absolute descriptions ("make it warm") → mode: "absolute", set final value.
3. Relative descriptions ("warmer", "more contrast") → mode: "relative", set delta only.
4. Compound descriptions ("moody and warm") → set multiple dimensions.
5. Named styles ("Vermeer lighting", "cyberpunk") → set presetMatch if you recognize it, AND provide the vector interpretation.
6. Magnitude: mild adjectives ("slightly", "a bit") = ±0.2, normal = ±0.5, strong ("very", "extremely") = ±0.8.
7. Negation: "less contrast" = contrast: -0.3 (relative), "no fog" = atmosphere: -1.0 (absolute).
8. Only include dimensions you're confident about. Confidence = how sure you are overall (0-1).

Respond as JSON only:
{"deltas":{"dimension_name":value},"mode":"absolute"|"relative","confidence":0.0-1.0,"presetMatch":"name_or_null"}`;
}

/**
 * Build the user message for NL parsing.
 * Includes the current vector state for context (helps with relative adjustments).
 */
export function buildNLParseUserMessage(userInput: string, currentVector?: SemanticVector): string {
  let msg = `Parse this artistic direction: "${userInput}"`;
  if (currentVector && Object.keys(currentVector).length > 0) {
    msg += `\n\nCurrent vector state: ${JSON.stringify(currentVector)}`;
  }
  return msg;
}

/**
 * Parse the LLM's JSON response into a typed NLParseResult.
 * Handles markdown code blocks, bare JSON, and malformed responses.
 */
export function parseNLResponse(response: string): NLParseResult | null {
  // Try extracting JSON from various wrappers
  const candidates: string[] = [response];

  // Markdown code blocks
  const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) candidates.push(codeBlockMatch[1]);

  // Bare JSON object
  const braceMatch = response.match(/\{[\s\S]*\}/);
  if (braceMatch) candidates.push(braceMatch[0]);

  for (const candidate of candidates) {
    try {
      const data = JSON.parse(candidate.trim());
      if (data.deltas && typeof data.mode === 'string') {
        // Validate and clamp values
        const deltas: SemanticVector = {};
        for (const [k, v] of Object.entries(data.deltas)) {
          if (typeof v === 'number') {
            deltas[k] = Math.max(-1, Math.min(1, v));
          }
        }
        return {
          deltas,
          mode: data.mode === 'relative' ? 'relative' : 'absolute',
          confidence: typeof data.confidence === 'number' ? data.confidence : 0.5,
          presetMatch: data.presetMatch || undefined,
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}
