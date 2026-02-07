import { BaseEdge, getSmoothStepPath, Position } from '@xyflow/react';

/**
 * Edge that draws parent→child with a junction when the child has two parents:
 * both edges meet at a common point above the child (fork pattern).
 */
export default function ParentForkEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition = Position.Bottom,
  targetPosition = Position.Top,
  data,
  style,
  markerEnd,
  ...rest
}) {
  const junction = data?.junction;
  let path;

  if (junction) {
    const jx = junction.x;
    const jy = junction.y;
    // Shared horizontal at jy so both parents meet on one line:
    // source → (sourceX, jy) → (jx, jy) → (targetX, jy) → target
    path = `M ${sourceX} ${sourceY} L ${sourceX} ${jy} L ${jx} ${jy} L ${targetX} ${jy} L ${targetX} ${targetY}`;
  } else {
    [path] = getSmoothStepPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
    });
  }

  return (
    <BaseEdge
      id={id}
      path={path}
      style={style}
      markerEnd={markerEnd}
      {...rest}
    />
  );
}
