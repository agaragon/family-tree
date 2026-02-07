/**
 * Layout service — single responsibility: compute generations and edge junctions.
 * Pure functions over nodes/edges; no side effects.
 */
const MIN_H_GAP = 40;
const MIN_V_GAP = 80;
/** Assumed node size for spacing; larger than base to avoid overlap with long names/scaling. */
const LAYOUT_NODE_WIDTH = 180;
const LAYOUT_NODE_HEIGHT = 70;
const COL_GAP = LAYOUT_NODE_WIDTH + MIN_H_GAP;
const ALIGN_ROW_HEIGHT = LAYOUT_NODE_HEIGHT + MIN_V_GAP;

/**
 * Compute aligned positions for family nodes: one row per generation, symmetric columns.
 * Returns { nodeId -> { x, y } }. Compact layout (no full-page stretch).
 */
export function computeAlignPositions(nodes, edges, generations) {
  const familyNodes = nodes.filter((n) => n.type !== 'generationLines');
  if (familyNodes.length === 0) return {};

  const getParentIds = (id) =>
    edges.filter((e) => e.target === id).map((e) => e.source).sort();

  const byGen = {};
  for (const n of familyNodes) {
    const g = generations[n.id] ?? 0;
    if (!byGen[g]) byGen[g] = [];
    byGen[g].push(n);
  }

  const result = {};
  for (const g of Object.keys(byGen).map(Number).sort((a, b) => a - b)) {
    const row = byGen[g];
    row.sort((a, b) => {
      const pa = getParentIds(a.id).join(',');
      const pb = getParentIds(b.id).join(',');
      if (pa !== pb) return pa.localeCompare(pb);
      return a.id.localeCompare(b.id);
    });
    const n = row.length;
    const totalWidth = (n - 1) * COL_GAP;
    const startX = -totalWidth / 2;
    row.forEach((node, i) => {
      result[node.id] = { x: startX + i * COL_GAP, y: g * ALIGN_ROW_HEIGHT };
    });
  }

  const xs = Object.values(result).map((p) => p.x);
  const ys = Object.values(result).map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  for (const id of Object.keys(result)) {
    result[id] = {
      x: result[id].x - centerX,
      y: result[id].y - centerY,
    };
  }
  return result;
}

export function getGenerations(nodes, edges) {
  const gen = {};
  const ids = new Set(nodes.map((n) => n.id));
  ids.forEach((id) => (gen[id] = null));
  const getParentIds = (id) =>
    edges.filter((e) => e.target === id).map((e) => e.source);
  while (true) {
    let changed = false;
    for (const id of ids) {
      if (gen[id] != null) continue;
      const parents = getParentIds(id);
      if (parents.length === 0) {
        gen[id] = 0;
        changed = true;
      } else {
        const parentGens = parents.map((p) => gen[p]);
        if (parentGens.every((g) => g != null)) {
          gen[id] = 1 + Math.max(...parentGens);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  ids.forEach((id) => {
    if (gen[id] == null) gen[id] = 0;
  });
  return gen;
}

const NODE_CENTER_X = 60;
const JUNCTION_OFFSET_Y = 40;

export function enrichEdgesWithJunctions(nodes, edges) {
  const familyNodes = nodes.filter((n) => n.type !== 'generationLines');
  const parentKeyToChildren = {};
  for (const node of familyNodes) {
    const parents = edges
      .filter((e) => e.target === node.id)
      .map((e) => e.source)
      .sort();
    if (parents.length !== 2) continue;
    const key = `${parents[0]},${parents[1]}`;
    if (!parentKeyToChildren[key]) parentKeyToChildren[key] = [];
    parentKeyToChildren[key].push(node.id);
  }
  const siblingJunction = {};
  for (const [key, childIds] of Object.entries(parentKeyToChildren)) {
    const [p1, p2] = key.split(',');
    const n1 = familyNodes.find((n) => n.id === p1);
    const n2 = familyNodes.find((n) => n.id === p2);
    const childNodes = childIds
      .map((id) => familyNodes.find((n) => n.id === id))
      .filter(Boolean);
    if (!n1 || !n2 || childNodes.length === 0) continue;
    const junctionY =
      Math.min(...childNodes.map((n) => n.position.y)) - JUNCTION_OFFSET_Y;
    const junctionX = (n1.position.x + n2.position.x) / 2 + NODE_CENTER_X;
    siblingJunction[key] = { x: junctionX, y: junctionY };
  }
  return edges.map((edge) => {
    const parents = edges
      .filter((e) => e.target === edge.target)
      .map((e) => e.source)
      .sort();
    if (parents.length !== 2) return edge;
    const key = `${parents[0]},${parents[1]}`;
    const junction = siblingJunction[key];
    if (!junction) return edge;
    return {
      ...edge,
      type: 'fork',
      data: { ...edge.data, junction },
    };
  });
}
