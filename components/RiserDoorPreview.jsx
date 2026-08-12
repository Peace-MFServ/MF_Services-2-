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

          {/* Leaves */}
          {Array.from({ length: leaves }, (_, i) => {
            const lx = x0 + frameT + i * leafW
            const inset = 1
            return (
              <g key={i}>
                <rect
                  x={lx + inset} y={y0 + frameT + inset}
                  width={leafW - inset * 2} height={innerH - inset * 2}
                  fill={LEAF} stroke={EDGE} strokeWidth="1.1"
                />
                {/* Lock / handle indication on the leading edge of each leaf */}
                {leafW > 26 && innerH > 40 && (
                  <rect
                    x={lx + leafW - 11} y={y0 + frameT + innerH / 2 - 7}
                    width={5} height={14} rx={1}
                    fill="#8E9BA8" stroke={EDGE} strokeWidth="0.8"
                  />
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

      {/* Resolved product */}
      <div style={{ borderTop: `1px solid ${UI.rule}`, padding: "14px 24px 18px", flexShrink: 0 }}>
        {resolution?.status === "matched" ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: UI.muted, fontFamily: FONT }}>
              Specification
            </span>
            <span style={{ fontSize: 15, fontWeight: 600, color: UI.ink, fontFamily: FONT }}>
              {resolution.product.name}
            </span>
            <span style={{ fontSize: 13.5, color: UI.body, fontFamily: FONT }}>
              supplied and installed
            </span>
          </div>
        ) : resolution?.status === "incomplete" ? (
          <span style={{ fontSize: 13.5, color: UI.muted, fontFamily: FONT }}>
            Enter a width and height to confirm the specification.
          </span>
        ) : (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span aria-hidden="true" style={{ width: 3, height: 18, background: UI.warn, flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: UI.ink, fontFamily: FONT }}>Bespoke enquiry</div>
              <div style={{ fontSize: 13, lineHeight: 1.5, color: UI.body, fontFamily: FONT, marginTop: 2 }}>
                {resolution?.reason}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
