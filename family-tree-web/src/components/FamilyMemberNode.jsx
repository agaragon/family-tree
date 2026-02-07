import { useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { DEFAULT_LABEL, NEW_MEMBER_LABEL } from '../ontology';

/**
 * Custom React Flow node representing a family member.
 * Data contract (from ontology): { label, onDelete(id), onRename(id, name), parentLabels?, generation? }
 */
export default function FamilyMemberNode({ id, data }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(data.label);
  const inputRef = useRef(null);

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

  return (
    <div className={`family-node${isCompact ? ' family-node--compact' : ''}`}>
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

      {/* Editable name — nodrag so touch/click doesn't start node drag */}
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
          className="node-name nodrag"
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
