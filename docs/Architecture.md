# Family Tree — Architecture

## Overview

The Family Tree web app is a React (Vite) single-page application that renders an editable genealogical graph using React Flow. The architecture follows **SOLID** principles and uses a **well-defined ontology** so domain concepts and responsibilities stay clear and stable.

---

## Ontology

The ontology is the single source of truth for domain concepts. It lives under `src/ontology/`.

### Domain concepts

| Concept | Description |
|--------|-------------|
| **FlowNode** | React Flow node: `{ id, type, position, data }`. Types: `familyMember`, `generationLines`. |
| **FlowEdge** | React Flow edge: `{ source, target, type?, data? }`. Edges represent parent→child; type `fork` when junction is used. |
| **Viewport** | Canvas view: `{ x, y, zoom }`. |
| **Payload** | Persisted/shared state: `{ nodes, edges, viewport }` with minimal node data (id, type, position, data.label). |
| **Generation** | Non-negative integer per node: 0 = roots, 1 = their children, etc. Same generation ⇒ same horizontal row (siblings/cousins). |
| **Junction** | Point `{ x, y }` where two parent edges meet above a child (fork pattern). |

### Constants (ontology)

- **STORAGE_KEY**, **URL_PARAM** — persistence keys.
- **ROW_HEIGHT** — vertical spacing per generation row.
- **DEFAULT_LABEL**, **NEW_MEMBER_LABEL** — canonical placeholder labels.
- **defaultViewport** — initial viewport.
- **NODE_TYPES**, **EDGE_TYPES** — registered React Flow type names.

### ID generation

- **nextMemberId()** — yields unique `member-{n}` IDs.
- **resetIdGenerator(n)** — reset counter (e.g. on “clear tree”).
- **syncIdFromNodes(nodes)** — set counter from existing nodes (e.g. after load).

All ID logic is centralized in `ontology/idGenerator.js` (Single Responsibility).

---

## SOLID mapping

| Principle | Application |
|-----------|-------------|
| **S — Single Responsibility** | **Persistence**: load/save payload only (`persistenceService`). **Layout**: generations + edge junctions only (`layoutService`). **Export**: PDF and share link only (`exportService`). **ID**: id generation only (`idGenerator`). **UI**: `App.jsx` orchestrates; nodes/edges are presentational. |
| **O — Open/Closed** | New node/edge types can be added by registering in `nodeTypes`/`edgeTypes` and extending ontology `NODE_TYPES`/`EDGE_TYPES` without changing existing services. Layout and persistence work on minimal node shape. |
| **L — Liskov Substitution** | Any custom node/edge that satisfies React Flow’s `Node`/`Edge` contract can replace `FamilyMemberNode` / `ParentForkEdge` in the registry. |
| **I — Interface Segregation** | Node data contract for family members is narrow: `{ label, onDelete(id), onRename(id, name), parentLabels?, generation? }`. Services expose small, focused functions (e.g. `loadInitialData`, `savePayload`, `getGenerations`, `enrichEdgesWithJunctions`). |
| **D — Dependency Inversion** | High-level code (App) depends on abstractions: ontology constants/types and service functions. Services depend on ontology, not on UI. Export depends on `buildSharePayload` from persistence rather than duplicating payload shape. |

---

## Layers and data flow

```
┌─────────────────────────────────────────────────────────────────┐
│  UI Layer                                                        │
│  App.jsx (orchestrator), FamilyMemberNode, GenerationLinesNode,  │
│  ParentForkEdge                                                  │
└───────────────────────────────┬─────────────────────────────────┘
                                │ uses
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Ontology                                                        │
│  domain.js (constants, types), idGenerator.js                   │
└───────────────────────────────┬─────────────────────────────────┘
                                ▲
                                │ uses
┌───────────────────────────────┴─────────────────────────────────┐
│  Services (stateless where possible)                             │
│  persistenceService — load, save, share payload, URL cleanup     │
│  layoutService — getGenerations, enrichEdgesWithJunctions        │
│  exportService — exportToPdf, copyShareLinkToClipboard           │
└─────────────────────────────────────────────────────────────────┘
```

- **Read path**: URL or localStorage → `loadInitialData()` → initial nodes/edges/viewport → React state → `getGenerations` / `enrichEdgesWithJunctions` → nodesForFlow / edgesForFlow → React Flow.
- **Write path**: User actions (add node, connect, rename, delete, viewport change) → React state → `savePayload()` on effect; export uses `buildSharePayload` and `exportToPdf` / clipboard.

---

## File map

| Path | Role |
|------|------|
| `src/ontology/domain.js` | Constants, default viewport, payload shape, NODE_TYPES, EDGE_TYPES. |
| `src/ontology/idGenerator.js` | nextMemberId, resetIdGenerator, syncIdFromNodes. |
| `src/ontology/index.js` | Re-exports ontology. |
| `src/services/persistenceService.js` | loadInitialData, savePayload, clearUrlTreeParam, clearStoredTree, buildSharePayload. |
| `src/services/layoutService.js` | getGenerations, enrichEdgesWithJunctions, ROW_HEIGHT. |
| `src/services/exportService.js` | exportToPdf, copyShareLinkToClipboard. |
| `src/App.jsx` | ReactFlowProvider + FamilyTreeCanvas: state, handlers, node/edge wiring, toolbar. |
| `src/components/FamilyMemberNode.jsx` | Editable member node; data contract from ontology. |
| `src/components/GenerationLinesNode.jsx` | Generation row lines. |
| `src/components/ParentForkEdge.jsx` | Fork edge with junction. |

---

## Extending the system

- **New node type**: Add a constant to `NODE_TYPES`, implement a component satisfying React Flow’s node props, register in `nodeTypes` in App. No change to persistence or layout if the new type is excluded from “family nodes” (e.g. filtered by `n.type !== NODE_TYPES.GENERATION_LINES`).
- **New storage backend**: Implement the same interface as `loadInitialData` / `savePayload` (e.g. in a new service) and call it from App instead of or in addition to the current persistence service.
- **New export format**: Add a function in `exportService` that takes the same inputs (e.g. containerRef or payload) and keep PDF/share link as they are.
