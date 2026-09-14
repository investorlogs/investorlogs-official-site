"use client"

const NODES = [
  [180, 140], [440, 80], [700, 180], [980, 60], [1260, 150],
  [260, 400], [520, 320], [780, 420], [1060, 340], [1340, 440],
  [400, 600], [680, 520], [960, 620], [1240, 560],
] as const

const EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8], [8, 4],
  [6, 2], [2, 8], [5, 10], [10, 11], [11, 12], [12, 13], [13, 8],
  [1, 6], [9, 4], [9, 8], [10, 6], [11, 6],
]

export function LandingNetwork() {
  return (
    <svg
      className="absolute inset-0 h-full w-full pointer-events-none"
      viewBox="0 0 1440 900"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="netGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.5" />
          <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.4" />
        </linearGradient>
        <linearGradient id="travelGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.8" />
        </linearGradient>
        <filter id="netGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {EDGES.map((e, i) => {
        const a = NODES[e[0]]
        const b = NODES[e[1]]
        const length = Math.hypot(b[0] - a[0], b[1] - a[1])
        return (
          <g key={i}>
            <line
              x1={a[0]}
              y1={a[1]}
              x2={b[0]}
              y2={b[1]}
              stroke="url(#netGrad)"
              strokeWidth="0.8"
              opacity="0.25"
              filter="url(#netGlow)"
            />
            <line
              x1={a[0]}
              y1={a[1]}
              x2={b[0]}
              y2={b[1]}
              stroke="url(#travelGrad)"
              strokeWidth="1.2"
              strokeDasharray={length}
              strokeDashoffset={length}
              opacity="0"
              filter="url(#netGlow)">
              <animate
                attributeName="stroke-dashoffset"
                from={length}
                to={0}
                dur="4s"
                repeatCount="indefinite"
                begin={`${i * 0.3}s`}
              />
              <animate
                attributeName="opacity"
                values="0;0.6;0"
                dur="4s"
                repeatCount="indefinite"
                begin={`${i * 0.3}s`}
              />
            </line>
          </g>
        )
      })}

      {NODES.map((n, i) => (
        <circle
          key={i}
          cx={n[0]}
          cy={n[1]}
          r="2.5"
          fill="url(#netGrad)"
          filter="url(#netGlow)"
          className={i % 4 === 0 ? "animate-pulse" : undefined}
        />
      ))}
    </svg>
  )
}