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
} from './domain';
import { nextMemberId, resetIdGenerator } from './domain/idGenerator';
import {
  loadInitialData,
  loadBackgroundImage,
  savePayload,
  saveBackgroundImage,
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
  exportToJson,
} from './services/exportService';
import './App.css';

const initialData = loadInitialData();

const isMobileView = () =>
  typeof window !== 'undefined' && window.innerWidth <= 768;

function FamilyTreeCanvas() {
  const reactFlowWrapper = useRef(null);
  const dragJustEndedRef = useRef(false);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const openFromSharedLinkOnMobile =
    initialData.fromSharedLink && isMobileView();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialData.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialData.edges);
  const [viewport, setViewport] = useState(
    openFromSharedLinkOnMobile ? defaultViewport : initialData.viewport,
  );
  const [bgImage, setBgImage] = useState(loadBackgroundImage);

  useEffect(() => {
    savePayload(nodes, edges, viewport);
  }, [nodes, edges, viewport]);

  useEffect(() => {
    clearUrlTreeParam();
  }, []);

  const fitViewOnMobileDoneRef = useRef(false);
  useEffect(() => {
    if (
      !openFromSharedLinkOnMobile ||
      fitViewOnMobileDoneRef.current ||
      nodes.length === 0
    )
      return;
    fitViewOnMobileDoneRef.current = true;
    const familyNodeIds = nodes
      .filter((n) => n.type !== NODE_TYPES.GENERATION_LINES)
      .map((n) => ({ id: n.id }));
    if (familyNodeIds.length === 0) return;
    const id = setTimeout(() => {
      fitView({
        padding: 0.2,
        duration: 0,
        nodes: familyNodeIds,
      });
    }, 150);
    return () => clearTimeout(id);
  }, [openFromSharedLinkOnMobile, fitView, nodes]);

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
      if (dragJustEndedRef.current) {
        dragJustEndedRef.current = false;
        return;
      }
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

  const onNodeDragEnd = useCallback(() => {
    dragJustEndedRef.current = true;
  }, []);

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

  const exportJson = useCallback(() => {
    exportToJson(nodes, edges, viewport);
  }, [nodes, edges, viewport]);

  const fileInputRef = useRef(null);
  const onImportBg = useCallback(() => {
    fileInputRef.current?.click();
  }, []);
  const onBgFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file?.type.startsWith('image/')) return;
    const r = new FileReader();
    r.onload = () => {
      const dataUrl = r.result;
      saveBackgroundImage(dataUrl);
      setBgImage(dataUrl);
    };
    r.readAsDataURL(file);
    e.target.value = '';
  }, []);

  return (
    <div
      className="tree-frame"
      ref={reactFlowWrapper}
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
      <div
        className="reactflow-wrapper"
        style={
          bgImage
            ? { background: `url(${bgImage}) center center no-repeat`, backgroundSize: 'contain' }
            : undefined
        }
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onBgFileChange}
          className="bg-import-input"
          aria-label="Importar imagem de fundo"
        />
        <ReactFlow
          nodes={nodesForFlow}
          edges={edgesForFlow}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragEnd={onNodeDragEnd}
          edgeTypes={edgeTypes}
          onConnect={onConnect}
          onPaneClick={onPaneClick}
          onViewportChange={({ x, y, zoom }) => setViewport({ x, y, zoom })}
          defaultViewport={
            openFromSharedLinkOnMobile ? defaultViewport : initialData.viewport
          }
          nodeTypes={nodeTypes}
          fitView={false}
          deleteKeyCode={null}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant="dots" gap={24} size={1} color="#c4a882" />
        </ReactFlow>
      </div>

      <aside className="instructions">
        <div className="instructions-tips">
          Mesma linha = mesma geração (irmãos, primos) &middot; Clique para
          adicionar membro &middot; Clique duas vezes no nome para editar
          &middot; Conecte as alças (dois pais → um filho = casal) &middot;
          Delete para remover conexão
        </div>
        <div className="instructions-actions">
          <button type="button" className="export-pdf-btn" onClick={onImportBg}>
            Importar fundo
          </button>
          <span className="bg-notice">(não compartilhado no link)</span>
          <button type="button" className="export-pdf-btn" onClick={exportLink}>
            Exportar link
          </button>
          <button type="button" className="export-pdf-btn" onClick={exportJson}>
            Exportar JSON
          </button>
          <select
            value={pdfPaperSize}
            onChange={(e) => setPdfPaperSize(e.target.value)}
            className="export-pdf-btn"
            aria-label="Tamanho do papel para PDF"
          >
            <option value="a4">A4</option>
            <option value="a1">A1</option>
            <option value="a0">A0</option>
          </select>
          <button type="button" className="export-pdf-btn" onClick={exportPdf}>
            Exportar PDF
          </button>
          <button type="button" className="clear-tree-btn" onClick={clearAll}>
            Limpar árvore
          </button>
        </div>
      </aside>
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
