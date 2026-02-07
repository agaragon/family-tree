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
  defaultSettings,
  NODE_TYPES,
  ROW_HEIGHT,
  NEW_MEMBER_LABEL,
  DEFAULT_LABEL,
  NEW_MEMBER_NODE_HALF_WIDTH,
  NEW_MEMBER_NODE_HALF_HEIGHT,
} from './domain';
import { nextMemberId, resetIdGenerator } from './domain/idGenerator';
import {
  loadInitialData,
  loadBackgroundImage,
  savePayload,
  saveBackgroundImage,
  clearUrlTreeParam,
  clearStoredTree,
} from './services/persistenceService';
import {
  getGenerations,
  enrichEdgesWithJunctions,
  computeAlignPositions,
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

const TOUR_SEEN_KEY = 'family-tree-tour-seen';

const TOUR_STEPS = [
  { title: 'Bem-vindo', text: 'Recomendamos fazer este tour para conhecer as funcionalidades. Você pode usar o site a qualquer momento; clique em "Parar Tour" para fechar.' },
  { title: 'Adicionar membros', text: 'Clique em um espaço vazio do canvas para adicionar um novo membro.' },
  { title: 'Editar nomes', text: 'Clique duas vezes no nome de um membro para editar (um clique em dispositivos touch). Enter confirma, Escape cancela.' },
  { title: 'Remover membros', text: 'Clique no botão × no canto do nó para excluir um membro.' },
  { title: 'Conectar pais e filhos', text: 'Arraste da alça de um nó até outro ou clique em um nó e depois em outro para criar a conexão. Conecte dois pais ao mesmo filho para representar um casal.' },
  { title: 'Remover conexões', text: 'Selecione uma aresta e pressione Delete ou Backspace.' },
  { title: 'Reposicionar e navegar', text: 'Arraste os nós para organizar. Use o mouse ou toque para pan e zoom no canvas.' },
  { title: 'Auto-salvamento', text: 'A árvore é salva automaticamente no armazenamento local.' },
  { title: 'Compartilhar', text: 'Abra um link com a árvore codificada na URL para visualizar ou colaborar.' },
  { title: 'Exportar', text: 'Exporte para PDF, copie o link de compartilhamento ou baixe a árvore em JSON.' },
  { title: 'Fundo personalizado', text: 'Importe uma imagem de fundo (ex.: foto); ela fica só no seu dispositivo e não entra no link.' },
  { title: 'Barra de ações', text: 'Alinhar: organiza nós por geração. Configurações avançadas: tamanho/cor dos nós e linhas. Importar fundo, Exportar link/JSON/PDF, tamanho do papel e Limpar árvore.' },
];

function FamilyTreeCanvas() {
  const reactFlowWrapper = useRef(null);
  const dragJustEndedRef = useRef(false);
  const connectionJustEndedRef = useRef(false);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const openFromSharedLinkOnMobile =
    initialData.fromSharedLink && isMobileView();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialData.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialData.edges);
  const [viewport, setViewport] = useState(
    openFromSharedLinkOnMobile ? defaultViewport : initialData.viewport,
  );
  const [settings, setSettings] = useState(
    initialData.settings ? { ...initialData.settings } : { ...defaultSettings },
  );
  const [bgImage, setBgImage] = useState(loadBackgroundImage);
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tourStep, setTourStep] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem(TOUR_SEEN_KEY) ? 0 : 1,
  );
  const [pendingConnectionSource, setPendingConnectionSource] = useState(null);

  const closeTour = useCallback(() => {
    if (typeof window !== 'undefined') localStorage.setItem(TOUR_SEEN_KEY, '1');
    setTourStep(0);
  }, []);

  useEffect(() => {
    savePayload(nodes, edges, viewport, settings);
  }, [nodes, edges, viewport, settings]);

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
    () =>
      enrichEdgesWithJunctions(nodes, edges).map((e) => ({
        ...e,
        style: {
          stroke: settings.edgeStrokeColor,
          strokeWidth: settings.edgeStrokeWidth,
        },
      })),
    [nodes, edges, settings.edgeStrokeColor, settings.edgeStrokeWidth],
  );

  const onPaneClick = useCallback(
    (event) => {
      setPendingConnectionSource(null);
      if (dragJustEndedRef.current) {
        dragJustEndedRef.current = false;
        return;
      }
      if (connectionJustEndedRef.current) {
        connectionJustEndedRef.current = false;
        return;
      }
      const flowPos = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const position = {
        x: flowPos.x - NEW_MEMBER_NODE_HALF_WIDTH,
        y: flowPos.y - NEW_MEMBER_NODE_HALF_HEIGHT,
      };
      setNodes((nds) => {
        if (nds.some((n) => n.selected)) return nds;
        return [
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
        ];
      });
    },
    [screenToFlowPosition, setNodes, deleteNode, renameNode],
  );

  const onNodeDragEnd = useCallback(() => {
    dragJustEndedRef.current = true;
  }, []);

  const addEdgeConnection = useCallback(
    (params) => {
      if (params.source === params.target) return;
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed },
            style: {
              stroke: settings.edgeStrokeColor,
              strokeWidth: settings.edgeStrokeWidth,
            },
          },
          eds,
        ),
      );
    },
    [setEdges, settings.edgeStrokeColor, settings.edgeStrokeWidth],
  );

  const onConnect = useCallback(
    (params) => addEdgeConnection(params),
    [addEdgeConnection],
  );

  const onNodeClick = useCallback(
    (_, node) => {
      if (node.type === NODE_TYPES.GENERATION_LINES) return;
      const id = node.id;
      if (pendingConnectionSource == null) {
        setPendingConnectionSource(id);
        return;
      }
      if (pendingConnectionSource === id) {
        setPendingConnectionSource(null);
        return;
      }
      const posA = familyNodePositionsRef.current.get(pendingConnectionSource);
      const posB = node.position;
      if (!posA) {
        setPendingConnectionSource(null);
        return;
      }
      const aboveFirst =
        posA.y < posB.y ||
        (posA.y === posB.y && posA.x <= posB.x);
      const sourceId = aboveFirst ? pendingConnectionSource : id;
      const targetId = aboveFirst ? id : pendingConnectionSource;
      connectionJustEndedRef.current = true;
      addEdgeConnection({ source: sourceId, target: targetId });
      setPendingConnectionSource(null);
    },
    [pendingConnectionSource, addEdgeConnection],
  );

  const onConnectEnd = useCallback(() => {
    connectionJustEndedRef.current = true;
  }, []);

  const onKeyDown = useCallback(
    (event) => {
      if (event.key === 'Backspace' || event.key === 'Delete') {
        setEdges((eds) => eds.filter((e) => !e.selected));
      }
    },
    [setEdges],
  );

  const familyNodes = nodes.filter((n) => n.type !== NODE_TYPES.GENERATION_LINES);
  const familyNodePositionsRef = useRef(new Map());
  useEffect(() => {
    const map = familyNodePositionsRef.current;
    map.clear();
    familyNodes.forEach((n) => map.set(n.id, n.position));
  }, [familyNodes]);
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
        nodeSize: settings.nodeSize,
        nodeColor: settings.nodeColor,
        isPendingConnectionSource: pendingConnectionSource === n.id,
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
  }, [familyNodes, edges, generations, maxGen, settings.nodeSize, settings.nodeColor, deleteNode, renameNode, getParentLabels, pendingConnectionSource]);

  const alignNodes = useCallback(() => {
    const positions = computeAlignPositions(familyNodes, edges, generations);
    setNodes((nds) =>
      nds.map((n) =>
        n.type === NODE_TYPES.GENERATION_LINES
          ? n
          : { ...n, position: positions[n.id] ?? n.position },
      ),
    );
  }, [familyNodes, edges, generations, setNodes]);

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
    copyShareLinkToClipboard(nodes, edges, viewport, settings).then(() =>
      alert(
        'Link de compartilhamento copiado para a área de transferência',
      ),
    );
  }, [nodes, edges, viewport, settings]);

  const exportJson = useCallback(() => {
    exportToJson(nodes, edges, viewport, settings);
  }, [nodes, edges, viewport, settings]);

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
      className={`tree-frame${mobileMenuOpen ? ' instructions-open' : ''}`}
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
          onConnectEnd={onConnectEnd}
          onNodeClick={onNodeClick}
          connectionRadius={500}
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

      {mobileMenuOpen && (
        <div
          className="instructions-backdrop"
          aria-hidden
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <button
        type="button"
        className="mobile-menu-toggle"
        aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={mobileMenuOpen}
        onClick={() => setMobileMenuOpen((o) => !o)}
      >
        <span className="hamburger-line" />
        <span className="hamburger-line" />
        <span className="hamburger-line" />
      </button>
      <aside className="instructions">
        <div className="instructions-tips">
          Mesma linha = mesma geração (irmãos, primos) &middot; Clique para
          adicionar membro &middot; Clique duas vezes no nome para editar
          &middot; Conecte: arraste da alça ou clique em dois nós &middot;
          Delete para remover conexão
        </div>
        <div
          className="instructions-actions"
          onClick={(e) => {
            if (e.target.closest('button') && !e.target.closest('button[data-no-close]')) {
              setMobileMenuOpen(false);
            }
          }}
        >
          <button
            type="button"
            className="export-pdf-btn"
            onClick={() => setTourStep(1)}
          >
            Fazer Tour
          </button>
          <button
            type="button"
            className="export-pdf-btn"
            onClick={alignNodes}
          >
            Alinhar
          </button>
          <button
            type="button"
            className="export-pdf-btn"
            data-no-close
            onClick={() => setAdvancedSettingsOpen((o) => !o)}
          >
            Configurações avançadas
          </button>
          {advancedSettingsOpen && (
            <div className="advanced-settings-panel">
              <label>
                Tamanho do nó
                <input
                  type="number"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={settings.nodeSize}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      nodeSize: Math.max(0.5, Math.min(2, Number(e.target.value) || 1)),
                    }))
                  }
                />
              </label>
              <label>
                Cor do nó
                <input
                  type="color"
                  value={
                    settings.nodeColor.startsWith('rgba')
                      ? '#ffffff'
                      : settings.nodeColor
                  }
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, nodeColor: e.target.value }))
                  }
                />
              </label>
              <label>
                Espessura da linha
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={settings.edgeStrokeWidth}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      edgeStrokeWidth: Math.max(1, Math.min(8, Number(e.target.value) || 2)),
                    }))
                  }
                />
              </label>
              <label>
                Cor da linha
                <input
                  type="color"
                  value={settings.edgeStrokeColor}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, edgeStrokeColor: e.target.value }))
                  }
                />
              </label>
              <button
                type="button"
                className="export-pdf-btn"
                onClick={() => setSettings({ ...defaultSettings })}
              >
                Restaurar padrões
              </button>
            </div>
          )}
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
            onChange={(e) => {
              setPdfPaperSize(e.target.value);
              setMobileMenuOpen(false);
            }}
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

      {tourStep > 0 && (
        <div className="tour-overlay">
          <div className="tour-dialog">
            <div className="tour-content">
              <h3>{TOUR_STEPS[tourStep - 1].title}</h3>
              <p>{TOUR_STEPS[tourStep - 1].text}</p>
            </div>
            <div className="tour-footer">
              <div className="tour-footer-nav">
                <span className="tour-progress">{tourStep} / {TOUR_STEPS.length}</span>
                <div className="tour-buttons">
                  <button type="button" className="tour-nav-btn" onClick={() => setTourStep((s) => Math.max(1, s - 1))} disabled={tourStep === 1}>
                    Anterior
                  </button>
                  {tourStep < TOUR_STEPS.length ? (
                    <button type="button" className="tour-nav-btn tour-nav-btn-primary" onClick={() => setTourStep((s) => s + 1)}>
                      Próximo
                    </button>
                  ) : (
                    <button type="button" className="tour-nav-btn tour-nav-btn-primary" onClick={closeTour}>
                      Fechar
                    </button>
                  )}
                </div>
              </div>
              <button type="button" className="tour-stop-btn" onClick={closeTour}>
                Parar Tour
              </button>
            </div>
          </div>
        </div>
      )}
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
