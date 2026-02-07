import { useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';

/**
 * Custom React Flow node representing a family member.
 * - Displays an editable name field (click to edit, blur/Enter to save).
 * - Has connection handles on top and bottom for linking to other members.
 * - Includes a delete button (×) in the top-right corner.
 */
export default function FamilyMemberNode({ id, data }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(data.label);
  const inputRef = useRef(null);

  // Auto-focus the input when entering edit mode
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commitName = useCallback(() => {
    setEditing(false);
    const trimmed = name.trim() || 'Sem nome';
    setName(trimmed);
    data.onRename(id, trimmed);
  }, [id, name, data]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter') commitName();
      if (e.key === 'Escape') {
        setName(data.label); // revert
        setEditing(false);
      }
    },
    [commitName, data.label],
  );

  const trimmed = name.trim();
  const isDefaultName = !trimmed || trimmed === 'Novo membro' || trimmed === 'Sem nome';
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

      {/* Editable name */}
      {editing ? (
        <input
          ref={inputRef}
          className="node-name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={handleKeyDown}
        />
      ) : (
        <div
          className="node-name"
          onDoubleClick={() => setEditing(true)}
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
