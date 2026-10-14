/**
 * The auth panel's illustration: a team's month drawn as rows of running
 * stitches, one row per person, one stitch per day. The last row is still
 * being stitched. Sample data, generated deterministically.
 */
const COLORS = {
  P: 'var(--present)',
  L: 'var(--late)',
  A: 'var(--absent)',
  V: 'var(--leave)',
  H: 'var(--holiday)',
  W: 'rgba(220,224,245,0.28)',
};

const ROWS = [
  'PPLPPWWPPPPPWWVVVPPWWPHPPWWPPLP',
  'PPPPPWWPLPPPWWPPPPPWWPHPLWWPPPP',
  'LPPPAWWPPPPLWWPPPPPWWPHPPWWVVPP',
  'PPPPPWWPPPPPWWPPLPPWWPHPPWWPPPP',
  'PVVPPWWPPPLPWWPPPPPWWPHPPWWPLPP',
  'PPPLPWWPPPPPWWPPPAPWWPHPPWWPPPP',
  'PPPPPWWLPPPPWWPPPPPWWPHPP',
];

export function StitchIllustration({ className }: { className?: string }) {
  const stitch = 14;
  const gap = 7;
  const rowGap = 26;
  const width = 31 * (stitch + gap);
  return (
    <svg
      viewBox={`0 0 ${width} ${ROWS.length * rowGap + 8}`}
      className={className}
      role="img"
      aria-label="Illustration: a team's month drawn as rows of coloured stitches, one per day"
    >
      {ROWS.map((row, r) => (
        <g key={r} transform={`translate(0 ${r * rowGap + 8})`}>
          {[...row].map((c, i) => {
            const isLastRow = r === ROWS.length - 1;
            const off = c === 'W';
            return (
              <rect
                key={i}
                x={i * (stitch + gap)}
                y={off ? 1 : 0}
                width={stitch}
                height={off ? 1.5 : 3.5}
                rx={1.75}
                fill={COLORS[c as keyof typeof COLORS]}
                style={
                  isLastRow
                    ? { animation: `stitch-pop 420ms cubic-bezier(0.16,1,0.3,1) ${600 + i * 45}ms both` }
                    : undefined
                }
              />
            );
          })}
          {r === ROWS.length - 1 &&
            Array.from({ length: 31 - row.length }, (_, k) => (
              <rect
                key={`d${k}`}
                x={(row.length + k) * (stitch + gap)}
                y={1}
                width={stitch}
                height={1.5}
                rx={0.75}
                fill="none"
                stroke="rgba(220,224,245,0.45)"
                strokeDasharray="3 3"
              />
            ))}
        </g>
      ))}
      <style>{`@keyframes stitch-pop{from{opacity:0;transform:scaleX(0)}to{opacity:1;transform:scaleX(1)}} rect{transform-box:fill-box;transform-origin:left center}`}</style>
    </svg>
  );
}
