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

/**
 * Estimate the rendered pixel width of a node based on its input count.
 * Must match OctaneNode.tsx: Math.max(180, inputCount * 30 + 40)
 */
function estimateNodeWidth(inputCount: number): number {
  return Math.max(180, inputCount * 30 + 40);
}

/** Fixed node height — OctaneNode renders at height:32 in its container div. */
const NODE_HEIGHT = 32;

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
  const maxCols = Math.max(...column.values()) + 1;
  const colX: number[] = new Array(maxCols).fill(0);

  for (let col = 1; col < maxCols; col++) {
    const prevGroup = columnGroups.get(col - 1) ?? [];
    const nodeById = new Map(nodes.map(n => [n.id, n]));
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
