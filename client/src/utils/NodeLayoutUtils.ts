/**
 * Node layout utilities for the NodeGraph editor.
 *
 * Provides a dependency-free DAG layout algorithm that arranges nodes
 * left-to-right by topological depth:
 *   - Column 0: source nodes (no incoming edges, e.g. textures, geometry)
 *   - Last column: sink nodes (no outgoing edges, e.g. RenderTarget)
 *
 * The algorithm is an adaptation of Kahn's topological sort with a simple
 * row-assignment heuristic to minimise edge crossings.
 */

export interface LayoutNode {
  id: string;
  /** Number of input pins — used to estimate visual width. */
  inputCount: number;
}

export interface LayoutEdge {
  source: string;
  target: string;
}

export interface LayoutPosition {
  x: number;
  y: number;
}

// ── Single scale factor for all node dimensions ────────────────────────────
// Change this one value to resize nodes + pins uniformly.
// 1.0 = original size, 0.75 = 75% etc.
export const NODE_SCALE = 0.75;

// Base (unscaled) dimensions — these define the 1.0× reference size
const BASE_HEIGHT = 32;
const BASE_MIN_WIDTH = 60;
const BASE_MAX_WIDTH = 320;
const BASE_PIN_SPACING = 30;
const BASE_WIDTH_PAD = 40;
const BASE_BORDER_RADIUS = 8;
const BASE_PADDING_RIGHT = 13;
const BASE_PADDING_LEFT = 39;
const BASE_ICON_BOX = 26;
const BASE_ICON_RADIUS = 7;
const BASE_ICON_SIZE = 20;
const BASE_FONT_SIZE = 13;
const BASE_PIN_SIZE = 12;
const BASE_PIN_BORDER = 2;
const BASE_PIN_OFFSET = 2;

// Scaled dimensions — imported by OctaneNode.tsx
export const NODE_HEIGHT = Math.round(BASE_HEIGHT * NODE_SCALE);
export const NODE_MIN_WIDTH = Math.round(BASE_MIN_WIDTH * NODE_SCALE);
export const NODE_MAX_WIDTH = Math.round(BASE_MAX_WIDTH * NODE_SCALE);
export const NODE_PIN_SPACING = Math.round(BASE_PIN_SPACING * NODE_SCALE);
export const NODE_WIDTH_PAD = Math.round(BASE_WIDTH_PAD * NODE_SCALE);
export const NODE_BORDER_RADIUS = Math.round(BASE_BORDER_RADIUS * NODE_SCALE);
export const NODE_PADDING_RIGHT = Math.round(BASE_PADDING_RIGHT * NODE_SCALE);
export const NODE_PADDING_LEFT = Math.round(BASE_PADDING_LEFT * NODE_SCALE);
export const NODE_ICON_BOX = Math.round(BASE_ICON_BOX * NODE_SCALE);
export const NODE_ICON_RADIUS = Math.round(BASE_ICON_RADIUS * NODE_SCALE);
export const NODE_ICON_SIZE = Math.round(BASE_ICON_SIZE * NODE_SCALE);
export const NODE_FONT_SIZE = Math.round(BASE_FONT_SIZE * NODE_SCALE);
export const NODE_PIN_SIZE = Math.round(BASE_PIN_SIZE * NODE_SCALE);
export const NODE_PIN_BORDER = +(BASE_PIN_BORDER * NODE_SCALE).toFixed(1);
export const NODE_PIN_OFFSET = Math.round(BASE_PIN_OFFSET * NODE_SCALE);

/** Lazily created canvas context for measuring text width. */
let measureCtx: CanvasRenderingContext2D | null = null;

/** Measure the pixel width of a label string at NODE_FONT_SIZE. */
function measureTextWidth(text: string): number {
  if (!measureCtx) {
    const canvas = document.createElement('canvas');
    measureCtx = canvas.getContext('2d');
  }
  if (measureCtx) {
    measureCtx.font = `${NODE_FONT_SIZE}px Arial, sans-serif`;
    return measureCtx.measureText(text).width;
  }
  // Fallback for non-browser environments
  return text.length * NODE_FONT_SIZE * 0.48;
}

/**
 * Estimate the rendered pixel width of a node based on pin count and label.
 * Padding around the label is fixed (NODE_PADDING_LEFT / NODE_PADDING_RIGHT),
 * so every node has the same gap on both sides of its name.
 */
export function estimateNodeWidth(inputCount: number, label?: string): number {
  const pinWidth = inputCount * NODE_PIN_SPACING + NODE_WIDTH_PAD;
  const labelWidth = label
    ? Math.ceil(measureTextWidth(label)) + 4 + NODE_PADDING_LEFT + NODE_PADDING_RIGHT
    : 0;
  // Pin width is never clamped — high-pin-count nodes (e.g. cameras with 30-63 inputs)
  // must be wide enough to fit all pins without overlap.
  // Label width is clamped to NODE_MAX_WIDTH to prevent excessively wide nodes from long names.
  const clampedLabelWidth = Math.min(NODE_MAX_WIDTH, labelWidth);
  return Math.max(NODE_MIN_WIDTH, pinWidth, clampedLabelWidth);
}

/**
 * Convert Octane center-based position to ReactFlow top-left position.
 */
export function octaneToReactFlow(
  pos: { x: number; y: number },
  inputCount: number,
  label?: string
): { x: number; y: number } {
  const w = estimateNodeWidth(inputCount, label);
  return { x: pos.x + w / 2, y: pos.y + NODE_HEIGHT / 2 };
}

/**
 * Convert ReactFlow top-left position to Octane center-based position.
 */
export function reactFlowToOctane(
  pos: { x: number; y: number },
  inputCount: number,
  label?: string
): { x: number; y: number } {
  const w = estimateNodeWidth(inputCount, label);
  return { x: pos.x - w / 2, y: pos.y - NODE_HEIGHT / 2 };
}

/** Horizontal gap between columns (pixels). */
const COL_GAP = 80;

/** Vertical gap between nodes in the same column (pixels). */
const ROW_GAP = 48;

/**
 * Compute a left-to-right DAG layout for the given nodes and edges.
 *
 * Returns a map from node id to its computed {x, y} position.
 * Nodes that are part of a cycle (should not occur in Octane scenes) are
 * placed in column 0.
 *
 * @param nodes  - All ReactFlow nodes (only id and inputCount are used)
 * @param edges  - All ReactFlow edges (source → target direction)
 * @param includeSubgraphs - Reserved for future use when sub-graphs are visible.
 *                           Currently behaves identically for both values.
 */
export function computeDAGLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  _includeSubgraphs = false
): Map<string, LayoutPosition> {
  if (nodes.length === 0) return new Map();

  // ── 1. Build adjacency maps ─────────────────────────────────────────────────
  const inEdges = new Map<string, Set<string>>(); // nodeId → set of source ids
  const outEdges = new Map<string, Set<string>>(); // nodeId → set of target ids

  for (const node of nodes) {
    inEdges.set(node.id, new Set());
    outEdges.set(node.id, new Set());
  }

  for (const edge of edges) {
    inEdges.get(edge.target)?.add(edge.source);
    outEdges.get(edge.source)?.add(edge.target);
  }

  // ── 2. Assign column depth via longest-path (handles diamonds correctly) ────
  const column = new Map<string, number>();
  const inDegree = new Map<string, number>();

  for (const node of nodes) {
    inDegree.set(node.id, inEdges.get(node.id)?.size ?? 0);
  }

  // Queue starts with all nodes that have no inputs (in-degree = 0)
  const queue: string[] = [];
  for (const node of nodes) {
    if ((inDegree.get(node.id) ?? 0) === 0) {
      queue.push(node.id);
      column.set(node.id, 0);
    }
  }

  // Process nodes in topological order; each node's column = max(column of inputs) + 1
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const col = column.get(nodeId) ?? 0;

    for (const targetId of outEdges.get(nodeId) ?? []) {
      const newCol = col + 1;
      if ((column.get(targetId) ?? -1) < newCol) {
        column.set(targetId, newCol);
      }

      const remaining = (inDegree.get(targetId) ?? 1) - 1;
      inDegree.set(targetId, remaining);
      if (remaining === 0) {
        queue.push(targetId);
      }
    }
  }

  // Nodes not reached (cycles) fall back to column 0
  for (const node of nodes) {
    if (!column.has(node.id)) {
      column.set(node.id, 0);
    }
  }

  // ── 3. Group nodes by column ─────────────────────────────────────────────────
  const columnGroups = new Map<number, string[]>();
  for (const [id, col] of column) {
    if (!columnGroups.has(col)) columnGroups.set(col, []);
    columnGroups.get(col)!.push(id);
  }

  // Sort each column by average output column to reduce edge crossings
  for (const [, group] of columnGroups) {
    group.sort((a, b) => {
      const avgOut = (id: string) => {
        const outs = outEdges.get(id) ?? new Set();
        if (outs.size === 0) return Infinity;
        let sum = 0;
        for (const t of outs) sum += column.get(t) ?? 0;
        return sum / outs.size;
      };
      return avgOut(a) - avgOut(b);
    });
  }

  // ── 4. Compute x positions per column ───────────────────────────────────────
  // Column x starts at 0 and advances by (max width in col + gap)
  const colValues = [...column.values()];
  const maxCols = colValues.length > 0 ? Math.max(...colValues) + 1 : 1;
  const colX: number[] = new Array(maxCols).fill(0);
  const nodeById = new Map(nodes.map(n => [n.id, n]));

  for (let col = 1; col < maxCols; col++) {
    const prevGroup = columnGroups.get(col - 1) ?? [];
    const maxWidth = prevGroup.reduce((mx, id) => {
      const n = nodeById.get(id);
      return Math.max(mx, n ? estimateNodeWidth(n.inputCount) : 180);
    }, 180);
    colX[col] = colX[col - 1] + maxWidth + COL_GAP;
  }

  // ── 5. Assign y positions within each column (vertically centred) ────────────
  const positions = new Map<string, LayoutPosition>();

  for (const [col, group] of columnGroups) {
    const totalH = group.length * NODE_HEIGHT + (group.length - 1) * ROW_GAP;
    const startY = -totalH / 2;

    group.forEach((id, row) => {
      positions.set(id, {
        x: colX[col],
        y: startY + row * (NODE_HEIGHT + ROW_GAP),
      });
    });
  }

  return positions;
}
