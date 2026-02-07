/**
 * Layout service — single responsibility: compute generations and edge junctions.
 * Pure functions over nodes/edges; no side effects.
 */
import { ROW_HEIGHT } from '../ontology';

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
