import { describe, it, expect } from 'vitest';
import {
  jsonResult,
  errorResult,
  extractHandle,
  extractValue,
  validateFilePath,
} from '../tools/utils';

describe('jsonResult', () => {
  it('wraps data as MCP text content', () => {
    const result = jsonResult({ success: true, handle: 42 });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.handle).toBe(42);
  });
});

describe('errorResult', () => {
  it('wraps error string with isError flag', () => {
    const result = errorResult('something broke');
    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe('something broke');
  });

  it('extracts message from Error objects', () => {
    const result = errorResult(new Error('crash'));
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe('crash');
  });
});

describe('extractHandle', () => {
  it('extracts from result.handle', () => {
    expect(extractHandle({ result: { handle: '42' } })).toBe(42);
  });

  it('extracts from list.handle', () => {
    expect(extractHandle({ list: { handle: 42 } })).toBe(42);
  });

  it('extracts from top-level handle', () => {
    expect(extractHandle({ handle: 42 })).toBe(42);
  });

  it('extracts from value.handle', () => {
    expect(extractHandle({ value: { handle: '42' } })).toBe(42);
  });

  it('returns undefined for handle 0', () => {
    expect(extractHandle({ result: { handle: 0 } })).toBeUndefined();
  });

  it('returns undefined for handle "0"', () => {
    expect(extractHandle({ result: { handle: '0' } })).toBeUndefined();
  });

  it('returns undefined for null response', () => {
    expect(extractHandle({})).toBeUndefined();
  });

  it('converts string handles to numbers', () => {
    const handle = extractHandle({ result: { handle: '12345' } });
    expect(typeof handle).toBe('number');
    expect(handle).toBe(12345);
  });
});

describe('extractValue', () => {
  it('extracts from result field', () => {
    expect(extractValue({ result: 42 })).toBe(42);
  });

  it('extracts from value field when result is missing', () => {
    expect(extractValue({ value: 'hello' })).toBe('hello');
  });

  it('returns the whole response as fallback', () => {
    const response = { foo: 'bar' };
    expect(extractValue(response)).toBe(response);
  });
});

describe('validateFilePath', () => {
  it('rejects paths outside allowed roots', () => {
    const err = validateFilePath('C:\\Windows\\System32\\evil.exe');
    expect(err).not.toBeNull();
    expect(err).toContain('outside allowed roots');
  });

  it('allows paths within default root', () => {
    const err = validateFilePath('C:\\otoyla\\scenes\\test.orbx');
    expect(err).toBeNull();
  });
});
