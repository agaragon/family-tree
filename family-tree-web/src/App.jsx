import { useCallback, useRef, useMemo, useEffect, useState } from 'react';
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
import ParentForkEdge from './components/ParentForkEdge';
import './App.css';

const STORAGE_KEY = 'family-tree-data';
const URL_PARAM = 'tree';

let nodeId = 0;
const getId = () => `member-${nodeId++}`;

const defaultViewport = { x: 0, y: 0, zoom: 1 };

function parsePayload(data) {
  const nodes = data.nodes || [];
  const edges = data.edges || [];
  const viewport =
    data.viewport && typeof data.viewport.zoom === 'number'
      ? { x: Number(data.viewport.x) || 0, y: Number(data.viewport.y) || 0, zoom: data.viewport.zoom }
      : defaultViewport;
  const maxId = Math.max(0, ...nodes.map((n) => parseInt(String(n.id).replace('member-', ''), 10) || 0));
  nodeId = maxId + 1;
  return { nodes, edges, viewport };
}

function getInitialData() {
  try {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get(URL_PARAM);
    if (encoded) {
      const data = JSON.parse(decodeURIComponent(encoded));
      return parsePayload(data);
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { nodes: [], edges: [], viewport: defaultViewport };
    return parsePayload(JSON.parse(raw));
  } catch {
    return { nodes: [], edges: [], viewport: defaultViewport };
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
  const [viewport, setViewport] = useState(initialData.viewport);

  // Persist to localStorage whenever nodes, edges or viewport change
  useEffect(() => {
    const payload = {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: { label: n.data?.label ?? 'Sem nome' },
      })),
      edges,
      viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [nodes, edges, viewport]);

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

  // Register the custom node and edge types
  const nodeTypes = useMemo(
    () => ({
      familyMember: FamilyMemberNode,
      generationLines: GenerationLinesNode,
    }),
    [],
  );
  const edgeTypes = useMemo(
    () => ({ fork: ParentForkEdge }),
    [],
  );

  // Enrich edges with junction for fork pattern; siblings share the same junction Y
  const edgesForFlow = useMemo(() => {
    const familyNodes = nodes.filter((n) => n.type !== 'generationLines');
    const NODE_CENTER_X = 60;
    const JUNCTION_OFFSET_Y = 40;
    // Group children by parent pair (siblings = same two parents)
    const parentKeyToChildren = {};
    for (const node of familyNodes) {
      const parents = edges.filter((e) => e.target === node.id).map((e) => e.source).sort();
      if (parents.length !== 2) continue;
      const key = `${parents[0]},${parents[1]}`;
      if (!parentKeyToChildren[key]) parentKeyToChildren[key] = [];
      parentKeyToChildren[key].push(node.id);
    }
    // One junction (same Y) per sibling group
    const siblingJunction = {};
    for (const [key, childIds] of Object.entries(parentKeyToChildren)) {
      const [p1, p2] = key.split(',');
      const n1 = familyNodes.find((n) => n.id === p1);
      const n2 = familyNodes.find((n) => n.id === p2);
      const childNodes = childIds.map((id) => familyNodes.find((n) => n.id === id)).filter(Boolean);
      if (!n1 || !n2 || childNodes.length === 0) continue;
      const junctionY = Math.min(...childNodes.map((n) => n.position.y)) - JUNCTION_OFFSET_Y;
      const junctionX = (n1.position.x + n2.position.x) / 2 + NODE_CENTER_X;
      siblingJunction[key] = { x: junctionX, y: junctionY };
    }
    return edges.map((edge) => {
      const parents = edges.filter((e) => e.target === edge.target).map((e) => e.source).sort();
      if (parents.length !== 2) return edge;
      const key = `${parents[0]},${parents[1]}`;
      const junction = siblingJunction[key];
      if (!junction) return edge;
      return {
        ...edge,
        type: 'fork',
        data: { ...edge.data, junction },
      };
    });
  }, [nodes, edges]);

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
          label: 'Novo membro',
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
    if (!window.confirm('Limpar toda a árvore genealógica? Esta ação não pode ser desfeita.')) return;
    nodeId = 0;
    setNodes([]);
    setEdges([]);
    setViewport(defaultViewport);
    localStorage.removeItem(STORAGE_KEY);
  }, [setNodes, setEdges]);

  const [pdfPaperSize, setPdfPaperSize] = useState('a1');
  const exportPdf = useCallback(() => {
    if (!reactFlowWrapper.current) return;
    html2pdf(reactFlowWrapper.current, {
      margin: 10,
      filename: 'family-tree.pdf',
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: pdfPaperSize, orientation: 'landscape' },
    });
  }, [pdfPaperSize]);

  const exportLink = useCallback(() => {
    const payload = {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: { label: n.data?.label ?? 'Sem nome' },
      })),
      edges,
      viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom },
    };
    const url = `${window.location.origin}${window.location.pathname}?${URL_PARAM}=${encodeURIComponent(JSON.stringify(payload))}`;
    navigator.clipboard.writeText(url).then(() => alert('Link de compartilhamento copiado para a área de transferência'));
  }, [nodes, edges, viewport]);

  return (
    <div className="tree-frame" ref={reactFlowWrapper} onKeyDown={onKeyDown} tabIndex={0}>
      <div className="reactflow-wrapper">
        <ReactFlow
        nodes={nodesForFlow}
        edges={edgesForFlow}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        edgeTypes={edgeTypes}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        onViewportChange={({ x, y, zoom }) => setViewport({ x, y, zoom })}
        defaultViewport={initialData.viewport}
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
        Mesma linha = mesma geração (irmãos, primos) &middot; Clique para adicionar
        membro &middot; Clique duas vezes no nome para editar &middot; Conecte as alças
        (dois pais → um filho = casal) &middot; Delete para remover conexão &middot;{' '}
        <button type="button" className="export-pdf-btn" onClick={exportLink}>
          Exportar link
        </button>
        &middot;{' '}
        <select
          value={pdfPaperSize}
          onChange={(e) => setPdfPaperSize(e.target.value)}
          className="export-pdf-btn"
          style={{ marginRight: 2 }}
          aria-label="Tamanho do papel para PDF"
        >
          <option value="a4">A4</option>
          <option value="a1">A1</option>
          <option value="a0">A0</option>
        </select>
        <button type="button" className="export-pdf-btn" onClick={exportPdf}>
          Exportar PDF
        </button>
        &middot;{' '}
        <button type="button" className="clear-tree-btn" onClick={clearAll}>
          Limpar árvore
        </button>
        </div>
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
