'use client'

import { UI, FONT } from '../lib/theme'

// Technical elevation of the configured doorset. Scales to the entered
// dimensions so the proportions on screen are the proportions ordered.
const VB = { w: 660, h: 520 }
const PAD = { top: 44, right: 76, bottom: 64, left: 78 }

const FRAME = "#8895A3"
const EDGE  = "#3C4956"
const LEAF  = "#CBD5DF"
const DIM   = "#57646F"

export default function RiserDoorPreview({ product, config, resolution }) {
  const w = Number(config.width)
  const h = Number(config.height)
  const hasSize = Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0
  const leaves = config.leaves || 1

  const boxW = VB.w - PAD.left - PAD.right
  const boxH = VB.h - PAD.top - PAD.bottom

  // Fall back to a nominal 900 × 2100 so the preview reads as a door
  // before anything is entered, rather than collapsing.
  const dw = hasSize ? w : 900
  const dh = hasSize ? h : 2100
  const scale = Math.min(boxW / dw, boxH / dh)
  const drawW = dw * scale
  const drawH = dh * scale
  const x0 = PAD.left + (boxW - drawW) / 2
  const y0 = PAD.top + (boxH - drawH) / 2

  const frameT = Math.max(4, Math.min(11, drawW * 0.022))
  const innerW = drawW - frameT * 2
  const innerH = drawH - frameT * 2
  const leafW = innerW / leaves

  const finishChoice = product?.options
    ?.find(o => o.id === "finish")?.choices
    ?.find(c => c.id === config.finish)
  const finishText = finishChoice
    ? (finishChoice.requiresText && config.finishText?.trim()
        ? config.finishText.trim()
        : finishChoice.label)
    : null

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, background: UI.surface }}>

      <div style={{ background: UI.accent, padding: "16px 24px", flexShrink: 0 }}>
        <h2 style={{ margin: 0, color: "#FFFFFF", fontFamily: FONT, fontSize: 21, fontWeight: 500, letterSpacing: "-0.01em" }}>
          {product?.label ?? "Doorset"} — elevation
        </h2>
      </div>

      <div style={{ flex: 1, minHeight: 0, padding: "18px 24px 6px" }}>
        <svg
          viewBox={`0 0 ${VB.w} ${VB.h}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ display: "block", width: "100%", height: "100%" }}
          role="img"
          aria-label={hasSize
            ? `Elevation, ${leaves} leaf doorset, ${w} by ${h} millimetres`
            : "Doorset elevation, dimensions not yet entered"}
        >
          {/* Frame */}
          <rect x={x0} y={y0} width={drawW} height={drawH} fill={FRAME} stroke={EDGE} strokeWidth="1.3" />

          {/* Leaves. Handing decides which edge hinges: the active leaf
              sits on the handing side (viewed from the access side), and
              each leaf hinges towards its nearer jamb so multi-leaf sets
              read as folding outward. */}
          {Array.from({ length: leaves }, (_, i) => {
            const lx = x0 + frameT + i * leafW
            const inset = 1
            const rightHand = config.handing === "right"
            // Which edge of THIS leaf carries the hinges.
            const hingesRight = leaves === 1 ? rightHand : i >= leaves / 2
            const hingeX = hingesRight ? lx + leafW - 4 : lx - 1
            // The active (locking) leaf is the outermost on the handing side.
            const isActive = leaves === 1 || (rightHand ? i === leaves - 1 : i === 0)
            const lockX = hingesRight ? lx + 6 : lx + leafW - 11
            const euroVisible = ["euro", "euro-concealed", "high-security"].includes(config.lockType)
            return (
              <g key={i}>
                <rect
                  x={lx + inset} y={y0 + frameT + inset}
                  width={leafW - inset * 2} height={innerH - inset * 2}
                  fill={LEAF} stroke={EDGE} strokeWidth="1.1"
                />
                {/* Hinge knuckles */}
                {leafW > 26 && innerH > 60 && [0.16, 0.5, 0.84].map(f => (
                  <rect
                    key={f}
                    x={hingeX} y={y0 + frameT + innerH * f - 7}
                    width={5} height={14} rx={1}
                    fill="#6D7A88" stroke={EDGE} strokeWidth="0.7"
                  />
                ))}
                {/* Lock on the active leaf's leading edge; a visible
                    euro cylinder gets its own mark below the lock case. */}
                {isActive && leafW > 26 && innerH > 40 && (
                  <g>
                    <rect
                      x={lockX} y={y0 + frameT + innerH / 2 - 7}
                      width={5} height={14} rx={1}
                      fill="#8E9BA8" stroke={EDGE} strokeWidth="0.8"
                    />
                    {euroVisible && (
                      <circle
                        cx={lockX + 2.5} cy={y0 + frameT + innerH / 2 + 16}
                        r={3} fill="#F4F6F8" stroke={EDGE} strokeWidth="0.8"
                      />
                    )}
                  </g>
                )}
              </g>
            )
          })}

          {/* Width dimension, below */}
          <g stroke={DIM} strokeWidth="0.9" fill="none">
            <line x1={x0} y1={y0 + drawH + 16} x2={x0} y2={y0 + drawH + 30} />
            <line x1={x0 + drawW} y1={y0 + drawH + 16} x2={x0 + drawW} y2={y0 + drawH + 30} />
            <line x1={x0} y1={y0 + drawH + 24} x2={x0 + drawW} y2={y0 + drawH + 24} />
          </g>
          <text
            x={x0 + drawW / 2} y={y0 + drawH + 44} textAnchor="middle"
            fontFamily={FONT} fontSize="15" fontWeight="600" fill={hasSize ? UI.ink : UI.muted}
          >
            {hasSize ? `${w} mm` : "width —"}
          </text>
          {/* Clear opening — the number the architect actually needs */}
          {hasSize && resolution?.clear && (
            <text
              x={x0 + drawW / 2} y={y0 + drawH + 59} textAnchor="middle"
              fontFamily={FONT} fontSize="12" fill={UI.muted}
            >
              clear opening {resolution.clear.width} × {resolution.clear.height} mm
            </text>
          )}

          {/* Height dimension, left */}
          <g stroke={DIM} strokeWidth="0.9" fill="none">
            <line x1={x0 - 30} y1={y0} x2={x0 - 16} y2={y0} />
            <line x1={x0 - 30} y1={y0 + drawH} x2={x0 - 16} y2={y0 + drawH} />
            <line x1={x0 - 23} y1={y0} x2={x0 - 23} y2={y0 + drawH} />
          </g>
          <text
            x={x0 - 34} y={y0 + drawH / 2} textAnchor="middle"
            fontFamily={FONT} fontSize="15" fontWeight="600" fill={hasSize ? UI.ink : UI.muted}
            transform={`rotate(-90 ${x0 - 34} ${y0 + drawH / 2})`}
          >
            {hasSize ? `${h} mm` : "height —"}
          </text>

          {/* Leaf count, above */}
          <text
            x={x0 + drawW / 2} y={y0 - 16} textAnchor="middle"
            fontFamily={FONT} fontSize="13" fill={UI.muted}
          >
            {leaves} {leaves === 1 ? "leaf" : "leaves"}
            {config.fireRating ? `  ·  ${config.fireRating}` : ""}
            {finishText ? `  ·  ${finishText}` : ""}
          </text>
        </svg>
      </div>

      {/* Summary strip. Evidence status stays internal — the sales
          team talks sourcing through with the customer in person. */}
      <div style={{ borderTop: `1px solid ${UI.rule}`, padding: "14px 24px 18px", flexShrink: 0 }}>
        {resolution?.status === "incomplete" ? (
          <span style={{ fontSize: 13.5, color: UI.muted, fontFamily: FONT }}>
            Enter a width and height to confirm the specification.
          </span>
        ) : (
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: UI.muted, fontFamily: FONT }}>
              Specification
            </span>
            <span style={{ fontSize: 15, fontWeight: 600, color: UI.ink, fontFamily: FONT }}>
              {leaves} {leaves === 1 ? "leaf" : "leaves"}, supplied and installed
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
