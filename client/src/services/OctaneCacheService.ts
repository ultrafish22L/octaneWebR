/**
 * OctaneCacheService — Runtime overlay of API-cached node type metadata.
 *
 * Fetches trimmed Octane API cache from /api/octane-cache at startup.
 * Provides typed accessors that downstream constants (PinTypes.ts, NodeTypes.ts)
 * check before falling back to hardcoded defaults. If the fetch fails or hasn't
 * completed yet, all accessors return undefined and callers use their fallbacks.
 */

import { Logger } from '../utils/Logger';

// Matches the payload shape from the Vite plugin's /api/octane-cache endpoint
export interface ClientCachePayload {
  meta: { octaneVersion: number; octaneName: string; generatedAt: string };
  pinTypes: Record<string, { color: string }>;
  compatibleTypes: Record<string, { nodes: Array<{ key: string; id: number }> }>;
  nodeTypes: Record<
    string,
    {
      name: string;
      category: string;
      color: string;
      outType: string;
      isHidden: boolean;
      movableInputPinCount: number;
      movableInputName: string;
    }
  >;
}

export interface CompatibleNodeType {
  key: string;
  id: number;
}

class OctaneCacheServiceImpl {
  private data: ClientCachePayload | null = null;
  private _ready: Promise<void> | null = null;

  /** Fetch the cache from the server. Non-blocking — fire and forget. */
  initialize(): void {
    if (this._ready) return; // Already initialized
    this._ready = this.fetch();
  }

  private async fetch(): Promise<void> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await window.fetch('/api/octane-cache', {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        Logger.warn(`API cache fetch failed: ${response.status}`);
        return;
      }

      this.data = await response.json();
      Logger.info(
        `API cache loaded: ${Object.keys(this.data!.nodeTypes).length} node types, ` +
          `${Object.keys(this.data!.compatibleTypes).length} pin compatibilities`
      );
    } catch (error) {
      // AbortError = timeout, TypeError = network error — both are expected when
      // Octane isn't running or the cache hasn't been generated yet.
      Logger.warn(`API cache unavailable (using hardcoded defaults): ${error}`);
    }
  }

  isLoaded(): boolean {
    return this.data !== null;
  }

  /** Get compatible node types for a pin type (e.g., PT_TEXTURE → 239 types) */
  getCompatibleNodeTypes(pinType: string): CompatibleNodeType[] | undefined {
    return this.data?.compatibleTypes[pinType]?.nodes;
  }

  /** Get node type info from the cache */
  getNodeTypeInfo(
    nodeType: string
  ): { name: string; category: string; color: string; outType: string } | undefined {
    const nt = this.data?.nodeTypes[nodeType];
    if (!nt || nt.isHidden) return undefined;
    return nt;
  }

  /** Get all non-hidden node types grouped by top-level category */
  getNodeTypeHierarchy():
    | Record<string, Record<string, { name: string; color: string }>>
    | undefined {
    if (!this.data) return undefined;
    const hierarchy: Record<string, Record<string, { name: string; color: string }>> = {};
    for (const [key, nt] of Object.entries(this.data.nodeTypes)) {
      if (nt.isHidden) continue;
      // Category format: "|Materials|Universal material" → top-level = "Materials"
      const parts = nt.category.split('|').filter(Boolean);
      const topCategory = parts[0] || 'Other';
      if (!hierarchy[topCategory]) hierarchy[topCategory] = {};
      hierarchy[topCategory][key] = { name: nt.name, color: nt.color };
    }
    return hierarchy;
  }

  /** Get movable input info for a node type */
  getMovableInputInfo(nodeType: string): { inputName: string; pinsPerInput: number } | undefined {
    const nt = this.data?.nodeTypes[nodeType];
    if (!nt || nt.movableInputPinCount <= 0) return undefined;
    return {
      inputName: nt.movableInputName || 'input',
      pinsPerInput: 1, // Default; cache doesn't have pinsPerInput directly
    };
  }

  /** Get pin type color (hex string) */
  getPinTypeColor(pinType: string): string | undefined {
    return this.data?.pinTypes[pinType]?.color;
  }

  /** Get all node type keys from cache */
  getAllNodeTypes(): string[] | undefined {
    if (!this.data) return undefined;
    return Object.keys(this.data.nodeTypes).filter(k => !this.data!.nodeTypes[k].isHidden);
  }
}

/** Singleton instance */
export const octaneCacheService = new OctaneCacheServiceImpl();
