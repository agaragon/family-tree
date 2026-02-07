# Using the Family Tree JSON Export in Another Project

This document describes the JSON format produced when you **Export JSON** from the Family Tree app, and how another project can use it to recreate the same tree (nodes, edges, and optional viewport).

---

## JSON file structure

The exported file is a single JSON object with three top-level keys:

| Key       | Type   | Description |
|-----------|--------|-------------|
| `nodes`   | array  | List of family member nodes (id, type, position, label). |
| `edges`   | array  | List of parent→child connections (source, target). |
| `viewport`| object | Optional canvas view: `{ x, y, zoom }`. |

### Nodes

Each element in `nodes` has the form:

```json
{
  "id": "member-1",
  "type": "familyMember",
  "position": { "x": 100, "y": 200 },
  "data": { "label": "Maria" }
}
```

- **id**: Unique string (this app uses `member-1`, `member-2`, …). You must preserve these when recreating the graph so edges can reference them.
- **type**: Always `"familyMember"` in the export (other node types like generation lines are derived at runtime).
- **position**: Canvas coordinates `{ x, y }` (numbers). Use these for layout if your renderer is position-based.
- **data.label**: Display name of the person (string).

### Edges

Each element in `edges` represents a **parent → child** link:

```json
{
  "source": "member-1",
  "target": "member-3"
}
```

- **source**: Node id of the parent.
- **target**: Node id of the child.

One child can have multiple edges (e.g. two parents → one child). Any extra fields (e.g. `type`, `id`) can be ignored for a minimal import.

### Viewport

```json
{
  "x": 0,
  "y": 0,
  "zoom": 1
}
```

- **x**, **y**: Pan offset (numbers).
- **zoom**: Scale factor (number). Use this to restore the same “camera” view if your app has a pannable/zoomable canvas.

---

## How to recreate the tree in your project

1. **Load the JSON**  
   Read the file (or the string from an API) and parse it, e.g. `const payload = JSON.parse(jsonString)`.

2. **Build your graph from `payload.nodes` and `payload.edges`**  
   - Create one vertex/node per `payload.nodes` item, using `node.id` as the unique key and `node.data.label` as the display name.  
   - Create one directed edge per `payload.edges` item from `edge.source` to `edge.target`.  
   - If you use positions, apply `node.position.x` and `node.position.y` to your layout.

3. **Optional: restore viewport**  
   If your UI has pan/zoom, set it from `payload.viewport.x`, `payload.viewport.y`, and `payload.viewport.zoom`.

4. **Preserve IDs**  
   Do not change `id` values. Edges refer to nodes by these ids; changing them will break parent–child links.

---

## Example (generic JavaScript)

```js
const payload = JSON.parse(fs.readFileSync('family-tree.json', 'utf8'));

// Recreate nodes (e.g. for a graph library)
const nodes = payload.nodes.map((n) => ({
  id: n.id,
  label: n.data?.label ?? 'Unknown',
  x: n.position?.x ?? 0,
  y: n.position?.y ?? 0,
}));

// Recreate edges
const edges = payload.edges.map((e) => ({
  from: e.source,
  to: e.target,
}));

// Optional: initial view
const { x, y, zoom } = payload.viewport || { x: 0, y: 0, zoom: 1 };
```

Your project can then pass `nodes` and `edges` to its own graph/tree component or persistence layer.

---

## Re-importing into this Family Tree app

To load an exported JSON file back into this app:

1. Encode the payload as in the share link:  
   `?tree=<encodeURIComponent(JSON.stringify(payload))>`  
   or store the same JSON in `localStorage` under the key `family-tree-data`.
2. Ensure the payload shape matches: `{ nodes, edges, viewport }` with nodes as above and edges with `source`/`target`.
3. The app will call `syncIdFromNodes(nodes)` on load so new members get ids after the highest existing `member-*` number.

No changes to the JSON format are required for re-import; the export format is the same as the share/persistence payload.
