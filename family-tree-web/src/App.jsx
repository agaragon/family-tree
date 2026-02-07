import { useCallback, useRef, useMemo, useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import FamilyMemberNode from './components/FamilyMemberNode';
import GenerationLinesNode from './components/GenerationLinesNode';
import ParentForkEdge from './components/ParentForkEdge';
import {
  defaultViewport,
  NODE_TYPES,
  ROW_HEIGHT,
  NEW_MEMBER_LABEL,
  DEFAULT_LABEL,
} from './ontology';
import { nextMemberId, resetIdGenerator } from './ontology/idGenerator';
import {
  loadInitialData,
  savePayload,
  clearUrlTreeParam,
  clearStoredTree,
  buildSharePayload,
} from './services/persistenceService';
import {
  getGenerations,
  enrichEdgesWithJunctions,
} from './services/layoutService';
import {
  exportToPdf,
  copyShareLinkToClipboard,
} from './services/exportService';
import './App.css';

const initialData = loadInitialData();

function FamilyTreeCanvas() {
  const reactFlowWrapper = useRef(null);
  const { screenToFlowPosition } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialData.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialData.edges);
  const [viewport, setViewport] = useState(initialData.viewport);

  useEffect(() => {
    savePayload(nodes, edges, viewport);
  }, [nodes, edges, viewport]);

  useEffect(() => {
    clearUrlTreeParam();
  }, []);

  const deleteNode = useCallback(
    (id) => {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    },
    [setNodes, setEdges],
  );

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

  const nodeTypes = useMemo(
    () => ({
      [NODE_TYPES.FAMILY_MEMBER]: FamilyMemberNode,
      [NODE_TYPES.GENERATION_LINES]: GenerationLinesNode,
    }),
    [],
  );
  const edgeTypes = useMemo(() => ({ fork: ParentForkEdge }), []);

  const edgesForFlow = useMemo(
    () => enrichEdgesWithJunctions(nodes, edges),
    [nodes, edges],
  );

  const onPaneClick = useCallback(
    (event) => {
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      setNodes((nds) => [
        ...nds,
        {
          id: nextMemberId(),
          type: NODE_TYPES.FAMILY_MEMBER,
          position,
          data: {
            label: NEW_MEMBER_LABEL,
            onDelete: deleteNode,
            onRename: renameNode,
          },
        },
      ]);
    },
    [screenToFlowPosition, setNodes, deleteNode, renameNode],
  );

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

  const onKeyDown = useCallback(
    (event) => {
      if (event.key === 'Backspace' || event.key === 'Delete') {
        setEdges((eds) => eds.filter((e) => !e.selected));
      }
    },
    [setEdges],
  );

  const familyNodes = nodes.filter((n) => n.type !== NODE_TYPES.GENERATION_LINES);
  const generations = useMemo(
    () => getGenerations(familyNodes, edges),
    [familyNodes, edges],
  );
  const maxGen = Math.max(
    0,
    ...familyNodes.map((n) => generations[n.id] ?? 0),
  );
  const getParentLabels = useCallback(
    (nodeId) =>
      edges
        .filter((e) => e.target === nodeId)
        .map((e) => familyNodes.find((n) => n.id === e.source)?.data?.label)
        .filter(Boolean),
    [edges, familyNodes],
  );

  const nodesForFlow = useMemo(() => {
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
      type: NODE_TYPES.GENERATION_LINES,
      position: { x: -2000, y: 0 },
      data: { maxGen, rowHeight: ROW_HEIGHT },
      draggable: false,
      selectable: false,
    };
    return [linesNode, ...withCallbacks];
  }, [familyNodes, edges, generations, deleteNode, renameNode, getParentLabels]);

  const clearAll = useCallback(() => {
    if (
      !window.confirm(
        'Limpar toda a árvore genealógica? Esta ação não pode ser desfeita.',
      )
    )
      return;
    resetIdGenerator(0);
    setNodes([]);
    setEdges([]);
    setViewport(defaultViewport);
    clearStoredTree();
  }, [setNodes, setEdges]);

  const [pdfPaperSize, setPdfPaperSize] = useState('a1');
  const exportPdf = useCallback(async () => {
    await exportToPdf(reactFlowWrapper, pdfPaperSize);
  }, [pdfPaperSize]);

  const exportLink = useCallback(() => {
    copyShareLinkToClipboard(nodes, edges, viewport).then(() =>
      alert(
        'Link de compartilhamento copiado para a área de transferência',
      ),
    );
  }, [nodes, edges, viewport]);

  return (
    <div
      className="tree-frame"
      ref={reactFlowWrapper}
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
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
          deleteKeyCode={null}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant="dots" gap={24} size={1} color="#c4a882" />
        </ReactFlow>

        <div className="instructions">
          Mesma linha = mesma geração (irmãos, primos) &middot; Clique para
          adicionar membro &middot; Clique duas vezes no nome para editar
          &middot; Conecte as alças (dois pais → um filho = casal) &middot;
          Delete para remover conexão &middot;{' '}
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

export default function App() {
  return (
    <ReactFlowProvider>
      <FamilyTreeCanvas />
    </ReactFlowProvider>
  );
}
