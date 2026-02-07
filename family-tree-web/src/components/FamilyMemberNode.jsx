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
    const trimmed = name.trim() || 'Unnamed';
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

  return (
    <div className="family-node">
      {/* Top handle — connect as child */}
      <Handle type="target" position={Position.Top} />

      {/* Delete button */}
      <button
        className="node-delete"
        title="Delete member"
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
          title="Double-click to edit name"
        >
          {name}
        </div>
      )}

      {/* Bottom handle — connect as parent */}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
