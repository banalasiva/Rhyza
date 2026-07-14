"use client";

// The growing plant, ported from the prototype. `stage` is 0–4
// (seed → germinating → sprouting → growing → bloomed). It animates between
// stages via CSS transitions on the SVG.

// `hideGround` drops the soil rect, roots, and seed husk so the plant can float
// cleanly in the bloom celebration (where a dark ground box + dangling roots
// looked like a stray artifact). Everywhere else the ground stays.
export function PlantSvg({ stage, hideGround = false }: { stage: number; hideGround?: boolean }) {
  const soilY = 178;
  const stemTop =
    [soilY - 2, soilY - 28, soilY - 70, soilY - 108, soilY - 138][stage] ?? soilY - 2;
  const rootSpread = [0, 0.4, 0.7, 1, 1][stage] ?? 0;
  const leafScale = [0, 0, 0.6, 1, 1][stage] ?? 0;
  const bloomScale = stage === 4 ? 1 : 0;
  const outerPetals = [0, 45, 90, 135, 180, 225, 270, 315];
  const innerPetals = [22, 67, 112, 157, 202, 247, 292, 337];
  const stamens = [0, 60, 120, 180, 240, 300];

  return (
    <svg
      viewBox="0 0 300 300"
      width="100%"
      height="100%"
      style={{ overflow: "visible", transition: "all 0.8s cubic-bezier(0.22,1,0.36,1)" }}
    >
      <defs>
        <radialGradient id="soilGr" cx="50%" cy="0%" r="90%">
          <stop offset="0%" stopColor="#3D2213" />
          <stop offset="100%" stopColor="#0A0503" />
        </radialGradient>
        <radialGradient id="seedGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={stage === 4 ? "#FFD54F" : "#A5D6A7"} stopOpacity="0.7" />
          <stop offset="100%" stopColor={stage === 4 ? "#FFD54F" : "#A5D6A7"} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="bloomGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFD54F" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#FF8F00" stopOpacity="0" />
        </radialGradient>
        <filter id="softGlow">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Soil */}
      {!hideGround && (
        <>
          <rect x={0} y={soilY} width={300} height={125} fill="url(#soilGr)" className="plant-soil" />
          <line x1={55} y1={soilY + 14} x2={100} y2={soilY + 11} stroke="#3D2A16" strokeWidth={1} opacity={0.5} />
          <line x1={185} y1={soilY + 18} x2={235} y2={soilY + 14} stroke="#3D2A16" strokeWidth={1} opacity={0.4} />
        </>
      )}

      {/* Seed glow halo */}
      <ellipse
        cx={150}
        cy={soilY}
        rx={stage === 4 ? 80 : 50}
        ry={stage === 4 ? 55 : 35}
        fill="url(#seedGlow)"
        style={{ transition: "all 1.2s ease" }}
      />

      {/* Roots */}
      {!hideGround && stage >= 1 && (
        <g opacity={rootSpread} style={{ transition: "opacity 1s" }}>
          <path d="M150,182 Q150,215 148,242" stroke="#5D4037" strokeWidth={2.5} fill="none" strokeLinecap="round" />
          {stage >= 2 && (
            <g>
              <path d="M149,208 Q130,220 112,236" stroke="#5D4037" strokeWidth={1.8} fill="none" strokeLinecap="round" />
              <path d="M149,212 Q168,224 188,238" stroke="#5D4037" strokeWidth={1.8} fill="none" strokeLinecap="round" />
            </g>
          )}
          {stage >= 3 && (
            <g>
              <path d="M112,236 Q95,248 80,258" stroke="#5D4037" strokeWidth={1.2} fill="none" strokeLinecap="round" />
              <path d="M188,238 Q205,250 220,260" stroke="#5D4037" strokeWidth={1.2} fill="none" strokeLinecap="round" />
              <path d="M149,222 Q128,234 100,240" stroke="#5D4037" strokeWidth={0.9} fill="none" strokeLinecap="round" />
              <path d="M149,226 Q170,238 198,244" stroke="#5D4037" strokeWidth={0.9} fill="none" strokeLinecap="round" />
            </g>
          )}
        </g>
      )}

      {/* Seed */}
      {stage === 0 && (
        <g>
          <ellipse cx={150} cy={soilY} rx={22} ry={14} fill="#8D6E63" filter="url(#softGlow)">
            <animateTransform
              attributeName="transform"
              type="scale"
              values="1;1.04;1"
              dur="2.5s"
              repeatCount="indefinite"
              additive="sum"
            />
          </ellipse>
          <line x1={150} y1={soilY - 14} x2={152} y2={soilY - 2} stroke="#BCAAA4" strokeWidth={1} opacity={0.7} />
        </g>
      )}
      {!hideGround && stage >= 1 && (
        <g>
          <ellipse cx={147} cy={soilY + 1} rx={18} ry={12} fill="#6D4C41" />
          <ellipse cx={153} cy={soilY + 1} rx={18} ry={12} fill="#5D4037" opacity={0.7} />
          <path d="M143,168 L150,176 L157,168" stroke="#3E2723" strokeWidth={1.4} fill="none" />
        </g>
      )}

      {/* Stem */}
      {stage >= 1 && (
        <line
          x1={150}
          y1={soilY}
          x2={150}
          y2={stemTop}
          stroke={stage >= 4 ? "#33691E" : "#558B2F"}
          strokeWidth={stage >= 3 ? 3.5 : 2.5}
          strokeLinecap="round"
          style={{ transition: "all 1.4s cubic-bezier(0.22,1,0.36,1)" }}
        />
      )}

      {/* Leaves — stage 2 */}
      {stage >= 2 && (
        <g
          style={{
            transformOrigin: "150px 148px",
            transform: `scale(${leafScale})`,
            transition: "transform 1.2s cubic-bezier(0.22,1,0.36,1)",
            opacity: leafScale,
          }}
        >
          <ellipse cx={136} cy={148} rx={17} ry={8} fill="#689F38" transform="rotate(-35 136 148)" />
          <ellipse cx={164} cy={140} rx={17} ry={8} fill="#7CB342" transform="rotate(35 164 140)" />
        </g>
      )}

      {/* Leaves — stage 3 */}
      {stage >= 3 && (
        <g style={{ transition: "opacity 1s 0.3s" }}>
          <ellipse cx={126} cy={120} rx={24} ry={10} fill="#558B2F" transform="rotate(-42 126 120)" filter="url(#softGlow)" />
          <ellipse cx={174} cy={110} rx={24} ry={10} fill="#689F38" transform="rotate(42 174 110)" filter="url(#softGlow)" />
          <ellipse cx={132} cy={98} rx={18} ry={8} fill="#7CB342" transform="rotate(-22 132 98)" />
          <ellipse cx={168} cy={92} rx={18} ry={8} fill="#8BC34A" transform="rotate(22 168 92)" />
        </g>
      )}

      {/* Bloom */}
      {stage >= 4 && (
        <g
          style={{
            transformOrigin: `150px ${stemTop}px`,
            transform: `scale(${bloomScale})`,
            transition: "transform 1.4s cubic-bezier(0.34,1.56,0.64,1) 0.3s",
          }}
        >
          <circle cx={150} cy={stemTop} r={52} fill="url(#bloomGlow)">
            <animate attributeName="r" values="50;66;50" dur="2.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.7;0.4;0.7" dur="2.2s" repeatCount="indefinite" />
          </circle>
          {outerPetals.map((deg, i) => (
            <ellipse
              key={deg}
              cx={150}
              cy={stemTop}
              rx={8}
              ry={22}
              fill={i % 2 === 0 ? "#FFB300" : "#FF8F00"}
              opacity={0.92}
              transform={`rotate(${deg} 150 ${stemTop})`}
              style={{ transformOrigin: `150px ${stemTop}px` }}
            />
          ))}
          {innerPetals.map((deg) => (
            <ellipse
              key={`i${deg}`}
              cx={150}
              cy={stemTop}
              rx={5}
              ry={14}
              fill="#FFD54F"
              opacity={0.8}
              transform={`rotate(${deg} 150 ${stemTop})`}
            />
          ))}
          <circle cx={150} cy={stemTop} r={11} fill="#FFF9C4" />
          <circle cx={150} cy={stemTop} r={6} fill="#FFFFFF" opacity={0.9} />
          {stamens.map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <circle
                key={`s${deg}`}
                cx={150 + 9 * Math.cos(rad)}
                cy={stemTop + 9 * Math.sin(rad)}
                r={1.5}
                fill="#FFB300"
              />
            );
          })}
        </g>
      )}
    </svg>
  );
}
