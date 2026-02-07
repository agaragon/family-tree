/**
 * Persistence service — single responsibility: load/save tree payload.
 * Depends on domain constants (STORAGE_KEY, URL_PARAM, defaultViewport).
 */
import {
  STORAGE_KEY,
  BG_STORAGE_KEY,
  URL_PARAM,
  defaultViewport,
  defaultSettings,
  DEFAULT_LABEL,
} from '../domain';
import { syncIdFromNodes } from '../domain/idGenerator';

export function clearUrlTreeParam() {
  const params = new URLSearchParams(window.location.search);
  if (params.has(URL_PARAM)) {
    params.delete(URL_PARAM);
    const clean = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', clean);
  }
}

function parseSettings(data) {
  const s = data.settings;
  if (!s || typeof s !== 'object') return { ...defaultSettings };
  return {
    nodeSize: typeof s.nodeSize === 'number' ? s.nodeSize : defaultSettings.nodeSize,
    nodeColor: typeof s.nodeColor === 'string' ? s.nodeColor : defaultSettings.nodeColor,
    edgeStrokeWidth: typeof s.edgeStrokeWidth === 'number' ? s.edgeStrokeWidth : defaultSettings.edgeStrokeWidth,
    edgeStrokeColor: typeof s.edgeStrokeColor === 'string' ? s.edgeStrokeColor : defaultSettings.edgeStrokeColor,
  };
}

function parsePayload(data, fromSharedLink = false) {
  const nodes = data.nodes || [];
  const edges = data.edges || [];
  const viewport =
    data.viewport && typeof data.viewport.zoom === 'number'
      ? {
          x: Number(data.viewport.x) || 0,
          y: Number(data.viewport.y) || 0,
          zoom: data.viewport.zoom,
        }
      : defaultViewport;
  const settings = parseSettings(data);
  syncIdFromNodes(nodes);
  return { nodes, edges, viewport, settings, fromSharedLink };
}

export function loadInitialData() {
  try {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get(URL_PARAM);
    if (encoded) {
      return parsePayload(JSON.parse(decodeURIComponent(encoded)), true);
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw)
      return { nodes: [], edges: [], viewport: defaultViewport, settings: { ...defaultSettings }, fromSharedLink: false };
    return parsePayload(JSON.parse(raw));
  } catch {
    return { nodes: [], edges: [], viewport: defaultViewport, settings: { ...defaultSettings }, fromSharedLink: false };
  }
}

export function savePayload(nodes, edges, viewport, settings) {
  const payload = {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: { label: n.data?.label ?? DEFAULT_LABEL },
    })),
    edges,
    viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom },
    settings: settings ? { ...settings } : { ...defaultSettings },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function clearStoredTree() {
  localStorage.removeItem(STORAGE_KEY);
}

export function loadBackgroundImage() {
  return localStorage.getItem(BG_STORAGE_KEY);
}

export function saveBackgroundImage(dataUrl) {
  if (dataUrl) localStorage.setItem(BG_STORAGE_KEY, dataUrl);
  else localStorage.removeItem(BG_STORAGE_KEY);
}

export function buildSharePayload(nodes, edges, viewport, settings) {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: { label: n.data?.label ?? DEFAULT_LABEL },
    })),
    edges,
    viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom },
    settings: settings ? { ...settings } : { ...defaultSettings },
  };
}
