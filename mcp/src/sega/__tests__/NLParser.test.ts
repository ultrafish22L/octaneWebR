import { describe, it, expect } from 'vitest';
import { buildNLParsePrompt, buildNLParseUserMessage, parseNLResponse } from '../NLParser';

describe('NLParser', () => {
  describe('buildNLParsePrompt', () => {
    it('includes all 15 dimensions', () => {
      const prompt = buildNLParsePrompt();
      expect(prompt).toContain('warmth');
      expect(prompt).toContain('contrast');
      expect(prompt).toContain('pleasure');
      expect(prompt).toContain('intimacy');
      expect(prompt).toContain('shot_scale');
    });

    it('includes positive and negative triggers', () => {
      const prompt = buildNLParsePrompt();
      expect(prompt).toContain('warm');
      expect(prompt).toContain('cool');
      expect(prompt).toContain('dramatic');
      expect(prompt).toContain('flat');
    });

    it('includes response format instructions', () => {
      const prompt = buildNLParsePrompt();
      expect(prompt).toContain('"deltas"');
      expect(prompt).toContain('"mode"');
      expect(prompt).toContain('"confidence"');
    });
  });

  describe('buildNLParseUserMessage', () => {
    it('includes user input', () => {
      const msg = buildNLParseUserMessage('make it warm');
      expect(msg).toContain('make it warm');
    });

    it('includes current vector when provided', () => {
      const msg = buildNLParseUserMessage('warmer', { warmth: 0.3 });
      expect(msg).toContain('warmth');
      expect(msg).toContain('0.3');
    });

    it('omits current vector when empty', () => {
      const msg = buildNLParseUserMessage('make it warm', {});
      expect(msg).not.toContain('Current vector');
    });
  });

  describe('parseNLResponse', () => {
    it('parses clean JSON', () => {
      const result = parseNLResponse(
        '{"deltas":{"warmth":0.7,"contrast":0.5},"mode":"absolute","confidence":0.9}'
      );
      expect(result).not.toBeNull();
      expect(result!.deltas.warmth).toBe(0.7);
      expect(result!.deltas.contrast).toBe(0.5);
      expect(result!.mode).toBe('absolute');
      expect(result!.confidence).toBe(0.9);
    });

    it('parses JSON in markdown code block', () => {
      const result = parseNLResponse(
        'Here is the result:\n```json\n{"deltas":{"warmth":0.5},"mode":"relative","confidence":0.8}\n```'
      );
      expect(result).not.toBeNull();
      expect(result!.deltas.warmth).toBe(0.5);
      expect(result!.mode).toBe('relative');
    });

    it('parses JSON embedded in text', () => {
      const result = parseNLResponse(
        'I think this means: {"deltas":{"contrast":0.6},"mode":"absolute","confidence":0.7} right?'
      );
      expect(result).not.toBeNull();
      expect(result!.deltas.contrast).toBe(0.6);
    });

    it('clamps values to [-1, +1]', () => {
      const result = parseNLResponse(
        '{"deltas":{"warmth":2.0,"contrast":-3.0},"mode":"absolute","confidence":0.5}'
      );
      expect(result).not.toBeNull();
      expect(result!.deltas.warmth).toBe(1);
      expect(result!.deltas.contrast).toBe(-1);
    });

    it('returns null for unparseable response', () => {
      expect(parseNLResponse('I have no idea what you mean')).toBeNull();
    });

    it('extracts presetMatch', () => {
      const result = parseNLResponse(
        '{"deltas":{"warmth":0.6},"mode":"absolute","confidence":0.8,"presetMatch":"vermeer"}'
      );
      expect(result).not.toBeNull();
      expect(result!.presetMatch).toBe('vermeer');
    });

    it('defaults confidence to 0.5 if missing', () => {
      const result = parseNLResponse('{"deltas":{"warmth":0.5},"mode":"absolute"}');
      expect(result).not.toBeNull();
      expect(result!.confidence).toBe(0.5);
    });
  });
});
