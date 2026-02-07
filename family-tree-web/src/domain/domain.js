/**
 * Family Tree domain — canonical types and constants.
 * Single source of truth for domain concepts used across the app.
 */

// ——— Constants ———
export const STORAGE_KEY = 'family-tree-data';
export const BG_STORAGE_KEY = 'family-tree-bg';
export const URL_PARAM = 'tree';
export const ROW_HEIGHT = 80;
/** Half-size of a new family member node (for centering on click). Aligns with layoutService node width. */
export const NEW_MEMBER_NODE_HALF_WIDTH = 60;
export const NEW_MEMBER_NODE_HALF_HEIGHT = 22;
export const DEFAULT_LABEL = 'Sem nome';
export const NEW_MEMBER_LABEL = 'Novo membro';

export const defaultViewport = Object.freeze({ x: 0, y: 0, zoom: 1 });

// ——— Domain types (conceptual; JS has no nominal types) ———
// FlowNode: { id, type, position, data }
// FlowEdge: { id?, source, target, type?, data?, ... }
// Viewport: { x, y, zoom }

/** Default advanced settings (shared via link + localStorage) */
export const defaultSettings = Object.freeze({
  nodeSize: 1,
  nodeColor: 'rgba(255,255,255,0.92)',
  edgeStrokeWidth: 2,
  edgeStrokeColor: '#6b4c3b',
});

/** Persisted payload: nodes (minimal), edges, viewport, settings */
export const payloadShape = {
  nodes: [], // [{ id, type, position, data: { label } }]
  edges: [], // [{ source, target, ... }]
  viewport: defaultViewport,
  settings: defaultSettings,
};

/** Node types registered with React Flow */
export const NODE_TYPES = Object.freeze({
  FAMILY_MEMBER: 'familyMember',
  GENERATION_LINES: 'generationLines',
});

export const EDGE_TYPES = Object.freeze({
  FORK: 'fork',
});
