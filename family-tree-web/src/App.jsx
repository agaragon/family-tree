import { useCallback, useRef, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import html2pdf from 'html2pdf.js';
import FamilyMemberNode from './components/FamilyMemberNode';
import GenerationLinesNode from './components/GenerationLinesNode';
import './App.css';

const STORAGE_KEY = 'family-tree-data';

let nodeId = 0;
const getId = () => `member-${nodeId++}`;

function getInitialData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { nodes: [], edges: [] };
    const data = JSON.parse(raw);
    const nodes = data.nodes || [];
    const edges = data.edges || [];
    const maxId = Math.max(0, ...nodes.map((n) => parseInt(String(n.id).replace('member-', ''), 10) || 0));
    nodeId = maxId + 1;
    return { nodes, edges };
  } catch {
    return { nodes: [], edges: [] };
  }
}

const initialData = getInitialData();

const ROW_HEIGHT = 80; // Same generation = same horizontal row (brothers, cousins aligned)

function getGenerations(nodes, edges) {
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

function FamilyTreeCanvas() {
  const reactFlowWrapper = useRef(null);
  const { screenToFlowPosition } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialData.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialData.edges);

  // Persist to localStorage whenever nodes or edges change
  useEffect(() => {
    const payload = {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: { label: n.data?.label ?? 'Unnamed' },
      })),
      edges,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [nodes, edges]);

  // Delete a node and all its connected edges
  const deleteNode = useCallback(
    (id) => {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    },
    [setNodes, setEdges],
  );

  // Rename a node
  const renameNode = useCallback(
    (id, newName) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, label: newName } } : n,
        ),
      );
    },
    [setNodes],
  );

  // Register the custom node types
  const nodeTypes = useMemo(
    () => ({
      familyMember: FamilyMemberNode,
      generationLines: GenerationLinesNode,
    }),
    [],
  );

  // Add a new family member node where the user clicks on the canvas
  const onPaneClick = useCallback(
    (event) => {
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id: getId(),
        type: 'familyMember',
        position,
        data: {
          label: 'New Member',
          onDelete: deleteNode,
          onRename: renameNode,
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [screenToFlowPosition, setNodes, deleteNode, renameNode],
  );

  // Connect two nodes with an edge
  const onConnect = useCallback(
    (params) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { stroke: '#6b4c3b', strokeWidth: 2 },
          },
          eds,
        ),
      );
    },
    [setEdges],
  );

  // Delete selected edges on Backspace/Delete key
  const onKeyDown = useCallback(
    (event) => {
      if (event.key === 'Backspace' || event.key === 'Delete') {
        setEdges((eds) => eds.filter((e) => !e.selected));
      }
    },
    [setEdges],
  );

  // Compute generations and align nodes by row (same generation = same y)
  const nodesForFlow = useMemo(() => {
    const familyNodes = nodes.filter((n) => n.type !== 'generationLines');
    const generations = getGenerations(familyNodes, edges);
    const getParentLabels = (nodeId) =>
      edges
        .filter((e) => e.target === nodeId)
        .map((e) =>
          familyNodes.find((n) => n.id === e.source)?.data?.label,
        )
        .filter(Boolean);
    const maxGen = Math.max(
      0,
      ...familyNodes.map((n) => generations[n.id] ?? 0),
    );
    const withCallbacks = familyNodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        onDelete: deleteNode,
        onRename: renameNode,
        parentLabels: getParentLabels(n.id),
        generation: generations[n.id],
      },
    }));
    const linesNode = {
      id: 'generation-lines',
      type: 'generationLines',
      position: { x: -2000, y: 0 },
      data: { maxGen, rowHeight: ROW_HEIGHT },
      draggable: false,
      selectable: false,
    };
    return [linesNode, ...withCallbacks];
  }, [nodes, edges, deleteNode, renameNode]);

  const clearAll = useCallback(() => {
    if (!window.confirm('Clear the entire family tree? This cannot be undone.')) return;
    nodeId = 0;
    setNodes([]);
    setEdges([]);
    localStorage.removeItem(STORAGE_KEY);
  }, [setNodes, setEdges]);

  const exportPdf = useCallback(() => {
    if (!reactFlowWrapper.current) return;
    html2pdf(reactFlowWrapper.current, {
      margin: 10,
      filename: 'family-tree.pdf',
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
    });
  }, []);

  return (
    <div
      className="reactflow-wrapper"
      ref={reactFlowWrapper}
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
      <ReactFlow
        nodes={nodesForFlow}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView={false}
        deleteKeyCode={null} /* we handle deletion ourselves */
        proOptions={{ hideAttribution: true }}
      >
        <Controls />
        <Background variant="dots" gap={24} size={1} color="#c4a882" />
      </ReactFlow>

      {/* Instruction banner */}
      <div className="instructions">
        Same row = same generation (siblings, cousins) &middot; Click to add
        member &middot; Double-click name to edit &middot; Connect handles
        (two parents → one child = couple) &middot; Delete to remove edge &middot;{' '}
        <button type="button" className="export-pdf-btn" onClick={exportPdf}>
          Export PDF
        </button>
        &middot;{' '}
        <button type="button" className="clear-tree-btn" onClick={clearAll}>
          Clear tree
        </button>
      </div>
    </div>
  );
}

/**
 * App root — wraps the canvas in ReactFlowProvider so hooks are available.
 */
export default function App() {
  return (
    <ReactFlowProvider>
      <FamilyTreeCanvas />
    </ReactFlowProvider>
  );
}
