import { useCallback, useRef, useMemo } from 'react';
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
import FamilyMemberNode from './components/FamilyMemberNode';
import './App.css';

let nodeId = 0;
const getId = () => `member-${nodeId++}`;

function FamilyTreeCanvas() {
  const reactFlowWrapper = useRef(null);
  const { screenToFlowPosition } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

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

  // Register the custom node type
  const nodeTypes = useMemo(
    () => ({ familyMember: FamilyMemberNode }),
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

  // Keep callbacks fresh on every node so onDelete/onRename always reference latest closures
  const nodesWithCallbacks = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        data: { ...n.data, onDelete: deleteNode, onRename: renameNode },
      })),
    [nodes, deleteNode, renameNode],
  );

  return (
    <div
      className="reactflow-wrapper"
      ref={reactFlowWrapper}
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
      <ReactFlow
        nodes={nodesWithCallbacks}
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
        Click anywhere to add a family member &middot; Double-click a name to
        edit &middot; Drag between handles to connect &middot; Click an edge
        then press Delete to remove it
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
