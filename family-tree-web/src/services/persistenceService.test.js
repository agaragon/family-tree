import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  savePayload,
  buildSharePayload,
  clearStoredTree,
  loadInitialData,
} from './persistenceService.js';

const defaultViewport = { x: 0, y: 0, zoom: 1 };

const storage = {};
const mockLocalStorage = {
  getItem: (k) => storage[k] ?? null,
  setItem: (k, v) => { storage[k] = v; },
  removeItem: (k) => { delete storage[k]; },
};

describe('persistenceService', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', mockLocalStorage);
    Object.keys(storage).forEach((k) => delete storage[k]);
  });

  describe('buildSharePayload', () => {
    it('maps nodes to minimal shape with id, type, position, data.label', () => {
      const nodes = [
        {
          id: 'member-1',
          type: 'familyMember',
          position: { x: 10, y: 20 },
          data: { label: 'Maria' },
        },
      ];
      const edges = [];
      const viewport = defaultViewport;
      const result = buildSharePayload(nodes, edges, viewport);
      expect(result).toEqual({
        nodes: [{ id: 'member-1', type: 'familyMember', position: { x: 10, y: 20 }, data: { label: 'Maria' } }],
        edges: [],
        viewport: defaultViewport,
      });
    });

    it('uses default label when data.label is missing', () => {
      const nodes = [
        { id: 'member-1', type: 'familyMember', position: { x: 0, y: 0 }, data: {} },
      ];
      const result = buildSharePayload(nodes, [], defaultViewport);
      expect(result.nodes[0].data.label).toBe('Sem nome');
    });

    it('includes edges and viewport as-is', () => {
      const nodes = [];
      const edges = [{ source: 'a', target: 'b' }];
      const viewport = { x: 100, y: 50, zoom: 1.5 };
      const result = buildSharePayload(nodes, edges, viewport);
      expect(result.edges).toEqual(edges);
      expect(result.viewport).toEqual(viewport);
    });
  });

  describe('savePayload', () => {
    it('persists payload to localStorage', () => {
      const nodes = [
        {
          id: 'member-1',
          type: 'familyMember',
          position: { x: 0, y: 0 },
          data: { label: 'Test' },
        },
      ];
      const edges = [];
      const viewport = defaultViewport;
      savePayload(nodes, edges, viewport);
      const stored = JSON.parse(storage['family-tree-data']);
      expect(stored.nodes[0]).toMatchObject({
        id: 'member-1',
        type: 'familyMember',
        position: { x: 0, y: 0 },
        data: { label: 'Test' },
      });
    });
  });

  describe('clearStoredTree', () => {
    it('removes tree from localStorage', () => {
      storage['family-tree-data'] = '{"nodes":[]}';
      clearStoredTree();
      expect(storage['family-tree-data']).toBeUndefined();
    });
  });

  describe('loadInitialData', () => {
    it('returns default when localStorage is empty and no URL param', () => {
      const result = loadInitialData();
      expect(result).toEqual({
        nodes: [],
        edges: [],
        viewport: defaultViewport,
        fromSharedLink: false,
      });
    });

    it('loads from localStorage when URL has no tree param', () => {
      const payload = {
        nodes: [{ id: 'member-1', type: 'familyMember', position: { x: 0, y: 0 }, data: { label: 'A' } }],
        edges: [],
        viewport: defaultViewport,
      };
      storage['family-tree-data'] = JSON.stringify(payload);
      const result = loadInitialData();
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].data.label).toBe('A');
      expect(result.fromSharedLink).toBe(false);
    });

    it('returns default on malformed localStorage JSON', () => {
      storage['family-tree-data'] = 'invalid json{{{';
      const result = loadInitialData();
      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
      expect(result.viewport).toEqual(defaultViewport);
    });
  });
});
