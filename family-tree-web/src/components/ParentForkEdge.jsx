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
    const [path1] = getSmoothStepPath({
      sourceX,
      sourceY,
      targetX: junction.x,
      targetY: junction.y,
      sourcePosition,
      targetPosition: Position.Top,
    });
    const [path2] = getSmoothStepPath({
      sourceX: junction.x,
      sourceY: junction.y,
      targetX,
      targetY,
      sourcePosition: Position.Bottom,
      targetPosition,
    });
    path = path1 + ' ' + path2.replace(/^M\s*[\d.-]+\s*[\d.-]+\s*/, '');
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
