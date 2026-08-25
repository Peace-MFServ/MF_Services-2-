'use client'

import { UI, FONT } from '../lib/theme'
import { leafLayout } from '../lib/doorLayout'

// Technical elevation of the configured doorset. Scales to the entered
// dimensions so the proportions on screen are the proportions ordered.
const VB = { w: 660, h: 520 }
const PAD = { top: 44, right: 76, bottom: 64, left: 78 }

const EDGE  = "#3C4956"
const LEAF  = "#CBD5DF"
const BAND  = "#D8DFE7"   // architrave — powder-coated, a shade off the leaf
const DIM   = "#57646F"

// Architrave width on screen when a frame style is chosen. The real
// integral architrave is 20–70 mm; a fixed drawing width keeps the
// band legible at any door size.
const BAND_W = 14

export default function RiserDoorPreview({ product, config, resolution }) {
  const w = Number(config.width)
  const h = Number(config.height)
  const hasSize = Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0
  const leaves = config.leaves || 1

  // Flush is the standard: no frame, no surround — just the leaves.
  // A chosen frame style draws its real architrave and nothing else.
  const flush = !config.frameStyle || config.frameStyle === "flush"
  const bandW = flush ? 0 : BAND_W

  const boxW = VB.w - PAD.left - PAD.right
  const boxH = VB.h - PAD.top - PAD.bottom

  // Fall back to a nominal 900 × 2100 so the preview reads as a door
  // before anything is entered, rather than collapsing.
  const dw = hasSize ? w : 900
  const dh = hasSize ? h : 2100
  const scale = Math.min((boxW - 2 * bandW) / dw, (boxH - 2 * bandW) / dh)
  const drawW = dw * scale
  const drawH = dh * scale
  const x0 = PAD.left + (boxW - drawW) / 2
  const y0 = PAD.top + (boxH - drawH) / 2

  const leafW = drawW / leaves

  // Door sets: pairs meeting at a mullion, a single where the count is odd.
  const layout = leafLayout(leaves, config.handing)

  // The leaf size, written on each leaf the way a door schedule shows it.
  const leafSize = resolution?.leaf
  const leafSizeText = leafSize ? `${leafSize.width} × ${leafSize.height}` : null

  // Every leaf is the same width, so the label fit is worked out once:
  // horizontal always, shrunk to fit, stacked onto two lines rather
  // than turned on its side.
  const leafLabel = (() => {
    if (!leafSizeText) return null
    const avail = leafW - 6
    const widthAt = size => leafSizeText.length * size * 0.54
    let size = 11
    while (size > 7 && widthAt(size) > avail) size -= 0.5
    return widthAt(size) <= avail
      ? { size, lines: [leafSizeText] }
      : { size, lines: [String(leafSize.width), `× ${leafSize.height}`] }
  })()

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
          {/* Architrave — the chosen frame's real face, one coherent
              band around the leaves:
                picture         flat band
                raised-picture  flat band with the 8 mm raised return */}
          {!flush && (
            <g>
              <rect
                x={x0 - bandW} y={y0 - bandW}
                width={drawW + 2 * bandW} height={drawH + 2 * bandW}
                fill={BAND} stroke={EDGE} strokeWidth="1.2"
              />
              {config.frameStyle === "raised-picture" && (
                <rect
                  x={x0 - bandW * 0.6} y={y0 - bandW * 0.6}
                  width={drawW + 2 * bandW * 0.6} height={drawH + 2 * bandW * 0.6}
                  fill="none" stroke={EDGE} strokeWidth="0.9"
                />
              )}
            </g>
          )}

          {/* Leaves. A multi-leaf riser is a row of door sets, each
              set a pair meeting at a centre mullion and pivoted at its
              outer edges. Christo doors are pivot-hung — no hinges. */}
          {layout.leaves.map(info => {
            const i = info.index
            const lx = x0 + i * leafW
            const inset = 1
            const pivotsRight = info.pivotSide === "right"
            const pivotX = pivotsRight ? lx + leafW - 8 : lx + 3
            const lockX = pivotsRight ? lx + 7 : lx + leafW - 12
            const euroVisible = !!config.lockType && config.lockType !== "slik-concealed"
            const room = leafW > 26 && drawH > 40
            return (
              <g key={i}>
                <rect
                  x={lx + inset} y={y0 + inset}
                  width={leafW - inset * 2} height={drawH - inset * 2}
                  fill={LEAF} stroke={EDGE} strokeWidth="1.1"
                />
                {/* Pivot pins, top and bottom of the pivot edge */}
                {room && [y0 + 4, y0 + drawH - 10].map(py => (
                  <rect
                    key={py}
                    x={pivotX} y={py} width={6} height={6}
                    fill="#6D7A88" stroke={EDGE} strokeWidth="0.7"
                  />
                ))}
                {/* Lock on the active leaf's leading edge: the SLIK slot,
                    plus a cylinder mark when the face carries one. */}
                {info.isActive && room && (
                  <g>
                    <rect
                      x={lockX} y={y0 + drawH / 2 - 7}
                      width={5} height={14} rx={2.5}
                      fill="none" stroke={EDGE} strokeWidth="1"
                    />
                    {euroVisible && (
                      <circle
                        cx={lockX + 2.5} cy={y0 + drawH / 2 + 16}
                        r={3} fill="#F4F6F8" stroke={EDGE} strokeWidth="0.8"
                      />
                    )}
                  </g>
                )}
                {/* Passive leaf: the 2-point bolts, top and bottom of
                    the leading edge. */}
                {info.isPassive && room && [y0 + 16, y0 + drawH - 22].map(by => (
                  <rect
                    key={by}
                    x={lockX} y={by} width={4} height={6}
                    fill="#6D7A88" stroke={EDGE} strokeWidth="0.6"
                  />
                ))}
                {/* Leaf size, written on the leaf itself */}
                {leafLabel && room && leafLabel.lines.map((line, n) => (
                  <text
                    key={n}
                    x={lx + leafW / 2} y={y0 + drawH * 0.38 + n * leafLabel.size * 1.15}
                    textAnchor="middle"
                    fontFamily={FONT} fontSize={leafLabel.size} fill={DIM}
                  >
                    {line}
                  </text>
                ))}
              </g>
            )
          })}

          {/* Mullion between adjacent door sets */}
          {layout.boundaries.map(b => (
            <rect
              key={`m-${b}`}
              x={x0 + b * leafW - 2} y={y0}
              width={4} height={drawH}
              fill="#8895A3" stroke={EDGE} strokeWidth="0.8"
            />
          ))}

          {/* Width dimension, below */}
          <g stroke={DIM} strokeWidth="0.9" fill="none">
            <line x1={x0} y1={y0 + drawH + bandW + 16} x2={x0} y2={y0 + drawH + bandW + 30} />
            <line x1={x0 + drawW} y1={y0 + drawH + bandW + 16} x2={x0 + drawW} y2={y0 + drawH + bandW + 30} />
            <line x1={x0} y1={y0 + drawH + bandW + 24} x2={x0 + drawW} y2={y0 + drawH + bandW + 24} />
          </g>
          <text
            x={x0 + drawW / 2} y={y0 + drawH + bandW + 44} textAnchor="middle"
            fontFamily={FONT} fontSize="15" fontWeight="600" fill={hasSize ? UI.ink : UI.muted}
          >
            {hasSize ? `${w} mm` : "width —"}
          </text>
          {/* Clear opening — the number the architect actually needs */}
          {hasSize && resolution?.clear && (
            <text
              x={x0 + drawW / 2} y={y0 + drawH + bandW + 59} textAnchor="middle"
              fontFamily={FONT} fontSize="12" fill={UI.muted}
            >
              clear opening {resolution.clear.width} × {resolution.clear.height} mm
            </text>
          )}

          {/* Height dimension, left */}
          <g stroke={DIM} strokeWidth="0.9" fill="none">
            <line x1={x0 - bandW - 30} y1={y0} x2={x0 - bandW - 16} y2={y0} />
            <line x1={x0 - bandW - 30} y1={y0 + drawH} x2={x0 - bandW - 16} y2={y0 + drawH} />
            <line x1={x0 - bandW - 23} y1={y0} x2={x0 - bandW - 23} y2={y0 + drawH} />
          </g>
          <text
            x={x0 - bandW - 34} y={y0 + drawH / 2} textAnchor="middle"
            fontFamily={FONT} fontSize="15" fontWeight="600" fill={hasSize ? UI.ink : UI.muted}
            transform={`rotate(-90 ${x0 - bandW - 34} ${y0 + drawH / 2})`}
          >
            {hasSize ? `${h} mm` : "height —"}
          </text>

          {/* Leaf count, above */}
          <text
            x={x0 + drawW / 2} y={y0 - bandW - 16} textAnchor="middle"
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
