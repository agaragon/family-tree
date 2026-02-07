/**
 * Persistence service — single responsibility: load/save tree payload.
 * Depends on domain constants (STORAGE_KEY, URL_PARAM, defaultViewport).
 */
import {
  STORAGE_KEY,
  BG_STORAGE_KEY,
  URL_PARAM,
  defaultViewport,
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
  syncIdFromNodes(nodes);
  return { nodes, edges, viewport, fromSharedLink };
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
      return { nodes: [], edges: [], viewport: defaultViewport, fromSharedLink: false };
    return parsePayload(JSON.parse(raw));
  } catch {
    return { nodes: [], edges: [], viewport: defaultViewport, fromSharedLink: false };
  }
}

export function savePayload(nodes, edges, viewport) {
  const payload = {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: { label: n.data?.label ?? DEFAULT_LABEL },
    })),
    edges,
    viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom },
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

export function buildSharePayload(nodes, edges, viewport) {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: { label: n.data?.label ?? DEFAULT_LABEL },
    })),
    edges,
    viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom },
  };
}
