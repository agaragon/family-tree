import { describe, it, expect } from 'vitest';
import { getGenerations, enrichEdgesWithJunctions } from './layoutService.js';
import { ROW_HEIGHT } from '../domain/domain.js';

describe('layoutService', () => {
  describe('getGenerations', () => {
    it('assigns generation 0 to nodes with no parents', () => {
      const nodes = [{ id: 'member-1' }, { id: 'member-2' }];
      const edges = [];
      expect(getGenerations(nodes, edges)).toEqual({
        'member-1': 0,
        'member-2': 0,
      });
    });

    it('assigns generation 1 to children of roots', () => {
      const nodes = [
        { id: 'member-1' },
        { id: 'member-2' },
        { id: 'member-3' },
      ];
      const edges = [
        { source: 'member-1', target: 'member-3' },
        { source: 'member-2', target: 'member-3' },
      ];
      expect(getGenerations(nodes, edges)).toEqual({
        'member-1': 0,
        'member-2': 0,
        'member-3': 1,
      });
    });

    it('assigns generation = 1 + max(parent generations)', () => {
      const nodes = [
        { id: 'a' },
        { id: 'b' },
        { id: 'c' },
        { id: 'd' },
      ];
      const edges = [
        { source: 'a', target: 'c' },
        { source: 'b', target: 'c' },
        { source: 'c', target: 'd' },
      ];
      expect(getGenerations(nodes, edges)).toEqual({
        a: 0,
        b: 0,
        c: 1,
        d: 2,
      });
    });

    it('handles multiple roots and branches', () => {
      const nodes = [
        { id: 'root1' },
        { id: 'root2' },
        { id: 'child1' },
        { id: 'child2' },
      ];
      const edges = [
        { source: 'root1', target: 'child1' },
        { source: 'root2', target: 'child2' },
      ];
      expect(getGenerations(nodes, edges)).toEqual({
        root1: 0,
        root2: 0,
        child1: 1,
        child2: 1,
      });
    });

    it('defaults to 0 for nodes with unreachable parents', () => {
      const nodes = [{ id: 'a' }, { id: 'b' }];
      const edges = [{ source: 'b', target: 'a' }];
      expect(getGenerations(nodes, edges)).toEqual({ a: 1, b: 0 });
    });
  });

  describe('enrichEdgesWithJunctions', () => {
    it('adds fork type and junction for edges with two parents', () => {
      const nodes = [
        { id: 'p1', type: 'familyMember', position: { x: 0, y: 0 } },
        { id: 'p2', type: 'familyMember', position: { x: 120, y: 0 } },
        { id: 'c', type: 'familyMember', position: { x: 60, y: 80 } },
      ];
      const edges = [
        { source: 'p1', target: 'c' },
        { source: 'p2', target: 'c' },
      ];
      const result = enrichEdgesWithJunctions(nodes, edges);
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('fork');
      expect(result[0].data.junction).toEqual(
        expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
      );
      expect(result[1].type).toBe('fork');
    });

    it('leaves edges unchanged when child has only one parent', () => {
      const nodes = [
        { id: 'p1', type: 'familyMember', position: { x: 0, y: 0 } },
        { id: 'c', type: 'familyMember', position: { x: 0, y: 80 } },
      ];
      const edges = [{ source: 'p1', target: 'c' }];
      const result = enrichEdgesWithJunctions(nodes, edges);
      expect(result).toEqual(edges);
      expect(result[0].type).toBeUndefined();
    });

    it('excludes generationLines nodes from junction calculation', () => {
      const nodes = [
        { id: 'p1', type: 'familyMember', position: { x: 0, y: 0 } },
        { id: 'p2', type: 'familyMember', position: { x: 120, y: 0 } },
        { id: 'c', type: 'familyMember', position: { x: 60, y: 80 } },
        { id: 'lines', type: 'generationLines', position: { x: 0, y: 0 } },
      ];
      const edges = [
        { source: 'p1', target: 'c' },
        { source: 'p2', target: 'c' },
      ];
      const result = enrichEdgesWithJunctions(nodes, edges);
      expect(result.every((e) => e.type === 'fork')).toBe(true);
    });
  });

  describe('ROW_HEIGHT', () => {
    it('is exported as a positive number', () => {
      expect(typeof ROW_HEIGHT).toBe('number');
      expect(ROW_HEIGHT).toBeGreaterThan(0);
    });
  });
});
