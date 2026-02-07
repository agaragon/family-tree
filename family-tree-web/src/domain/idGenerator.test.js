import { describe, it, expect, beforeEach } from 'vitest';
import {
  nextMemberId,
  resetIdGenerator,
  syncIdFromNodes,
} from './idGenerator.js';

describe('idGenerator', () => {
  beforeEach(() => resetIdGenerator());

  describe('nextMemberId', () => {
    it('yields sequential member-{n} IDs starting from 0', () => {
      expect(nextMemberId()).toBe('member-0');
      expect(nextMemberId()).toBe('member-1');
      expect(nextMemberId()).toBe('member-2');
    });
  });

  describe('resetIdGenerator', () => {
    it('resets counter to 0 by default', () => {
      nextMemberId();
      nextMemberId();
      resetIdGenerator();
      expect(nextMemberId()).toBe('member-0');
    });

    it('resets counter to given nextId', () => {
      resetIdGenerator(5);
      expect(nextMemberId()).toBe('member-5');
    });
  });

  describe('syncIdFromNodes', () => {
    it('sets counter to max id + 1 from nodes with member-N ids', () => {
      const nodes = [
        { id: 'member-1' },
        { id: 'member-3' },
        { id: 'member-2' },
      ];
      syncIdFromNodes(nodes);
      expect(nextMemberId()).toBe('member-4');
    });

    it('handles empty nodes by setting counter to 1', () => {
      syncIdFromNodes([]);
      expect(nextMemberId()).toBe('member-1');
    });

    it('ignores non-member ids and uses 1 when no valid member ids', () => {
      syncIdFromNodes([{ id: 'foo' }, { id: 'bar' }]);
      expect(nextMemberId()).toBe('member-1');
    });

    it('handles mixed valid and invalid ids', () => {
      syncIdFromNodes([{ id: 'other' }, { id: 'member-10' }]);
      expect(nextMemberId()).toBe('member-11');
    });
  });
});
