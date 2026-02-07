import { useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { DEFAULT_LABEL, NEW_MEMBER_LABEL } from '../domain';

const mobile = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

/**
 * Custom React Flow node representing a family member.
 * Data contract: { label, onDelete(id), onRename(id, name), parentLabels?, generation? }
 */
export default function FamilyMemberNode({ id, data }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(data.label);
  const [isMobile, setIsMobile] = useState(mobile);
  const inputRef = useRef(null);

  useEffect(() => {
    const m = window.matchMedia('(max-width: 768px)');
    const fn = () => setIsMobile(m.matches);
    m.addEventListener('change', fn);
    return () => m.removeEventListener('change', fn);
  }, []);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commitName = useCallback(() => {
    setEditing(false);
    const trimmed = name.trim() || DEFAULT_LABEL;
    setName(trimmed);
    data.onRename(id, trimmed);
  }, [id, name, data]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') commitName();
      if (e.key === 'Escape') {
        setName(data.label);
        setEditing(false);
      }
    },
    [commitName, data.label],
  );

  const trimmed = name.trim();
  const isDefaultName =
    !trimmed || trimmed === NEW_MEMBER_LABEL || trimmed === DEFAULT_LABEL;
  const isCompact = !editing && !isDefaultName;
  const scale = typeof data.nodeSize === 'number' ? data.nodeSize : 1;
  const [padV, padH] = isCompact ? (isMobile ? [3, 5] : [8, 12]) : (isMobile ? [4, 8] : [12, 18]);
  const minW = isCompact ? (isMobile ? 50 : 90) : (isMobile ? 65 : 120);
  const nodeStyle = {
    background: data.nodeColor,
    borderColor: data.nodeColor?.startsWith('rgba') ? undefined : data.nodeColor,
    minWidth: `${minW * scale}px`,
    padding: `${padV * scale}px ${padH * scale}px`,
  };

  return (
    <div
      className={`family-node${isCompact ? ' family-node--compact' : ''}${data.isPendingConnectionSource ? ' family-node--pending-connection' : ''}`}
      style={nodeStyle}
    >
      {/* Top handle — connect as child */}
      <Handle id="target" type="target" position={Position.Top} />


      {/* Delete button */}
      <button
        className="node-delete"
        title="Excluir membro"
        onClick={(e) => {
          e.stopPropagation();
          data.onDelete(id);
        }}
      >
        ×
      </button>

      {/* Editable name — input has nodrag so selecting text doesn't start node drag */}
      {editing ? (
        <input
          ref={inputRef}
          className="node-name-input nodrag"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <div
          className="node-name"
          onDoubleClick={() => setEditing(true)}
          onClick={() => {
            if ('ontouchstart' in window) setEditing(true);
          }}
          title="Clique duas vezes para editar o nome"
        >
          {name}
        </div>
      )}

      {data.parentLabels?.length >= 2 && (
        <div className="node-parents" title="Filho deste casal">
          Filho de {data.parentLabels.join(' e ')}
        </div>
      )}

      {/* Bottom handle — connect as parent */}
      <Handle id="source" type="source" position={Position.Bottom} />
    </div>
  );
}
