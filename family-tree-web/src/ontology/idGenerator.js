/**
 * Central ID generator for family member nodes.
 * Single responsibility: produce unique member IDs.
 */
let nodeId = 0;

export function resetIdGenerator(nextId = 0) {
  nodeId = nextId;
}

export function nextMemberId() {
  return `member-${nodeId++}`;
}

export function syncIdFromNodes(nodes) {
  const maxId = Math.max(
    0,
    ...nodes.map((n) => parseInt(String(n.id).replace('member-', ''), 10) || 0),
  );
  nodeId = maxId + 1;
}
