/**
 * Invisible node that draws faint horizontal lines at each generation row
 * so same-generation alignment (siblings, cousins) is visually clear.
 */
export default function GenerationLinesNode({ data }) {
  const { maxGen = 0, rowHeight = 80 } = data;
  const height = (maxGen + 1) * rowHeight;
  const width = 4000;

  if (maxGen < 0) return null;

  return (
    <div
      className="generation-lines-node"
      style={{
        width,
        height,
        pointerEvents: 'none',
      }}
    >
      <svg width={width} height={height}>
        {Array.from({ length: maxGen + 2 }, (_, i) => (
          <line
            key={i}
            x1={0}
            y1={i * rowHeight}
            x2={width}
            y2={i * rowHeight}
            stroke="rgba(107, 76, 59, 0.15)"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        ))}
      </svg>
    </div>
  );
}
