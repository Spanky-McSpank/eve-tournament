interface Props {
  /** Number of matches in the left (current) round column */
  matchCount: number
}

export default function BracketConnector({ matchCount }: Props) {
  const pairs = Math.floor(matchCount / 2)

  return (
    <svg
      style={{ width: 60, height: "100%", flexShrink: 0, display: "block" }}
      viewBox={`0 0 60 ${matchCount}`}
      preserveAspectRatio="none"
    >
      {Array.from({ length: pairs }, (_, j) => {
        const topY = 2 * j + 0.5
        const botY = 2 * j + 1.5
        const midY = 2 * j + 1
        const midX = 30
        const color = "rgba(240,192,64,0.3)"
        return (
          <g key={j}>
            <line x1={0} y1={topY} x2={midX} y2={topY} stroke={color} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <line x1={midX} y1={topY} x2={midX} y2={botY} stroke={color} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <line x1={0} y1={botY} x2={midX} y2={botY} stroke={color} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <line x1={midX} y1={midY} x2={60} y2={midY} stroke={color} strokeWidth={1} vectorEffect="non-scaling-stroke" />
          </g>
        )
      })}
    </svg>
  )
}
