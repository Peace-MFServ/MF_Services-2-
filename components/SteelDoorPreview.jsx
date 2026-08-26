'use client'
import { UI, FONT } from '../lib/theme'

// Technical elevation of the configured steel doorset. Unlike the
// riser doors these are hinged and sit in a visible frame, so the
// frame profile is drawn — its depth follows the family chosen, since
// that is what the customer is really picking between.

const VB = { w: 660, h: 520 }
const PAD = { top: 46, right: 78, bottom: 66, left: 80 }

const EDGE  = "#3C4956"
const FRAME = "#8895A3"
const LEAF  = "#CBD5DF"
const DEEP  = "#6D7A88"
const DIM   = "#57646F"

// Drawing widths for the frame families. The real profiles differ in
// depth rather than face width, but a visible difference is what makes
// the choice legible on screen.
const FRAME_FACE = { c: 13, e: 19, b: 26 }

const HINGE_FRACTIONS = [0.12, 0.5, 0.88]

export default function SteelDoorPreview({ resolution, config }) {
  const type = resolution?.type
  const frameClass = resolution?.frame?.class ?? "c"
  const face = FRAME_FACE[frameClass] ?? 13

  const w = Number(config?.width)
  const h = Number(config?.height)
  const hasSize = Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0

  const dw = hasSize ? w : 1000
  const dh = hasSize ? h : 2100
  const leaves = type?.leaves ?? 1

  const boxW = VB.w - PAD.left - PAD.right
  const boxH = VB.h - PAD.top - PAD.bottom
  const scale = Math.min(boxW / dw, boxH / dh)
  const drawW = dw * scale
  const drawH = dh * scale
  const x0 = PAD.left + (boxW - drawW) / 2
  const y0 = PAD.top + (boxH - drawH) / 2

  // Leaves sit inside the frame face on three sides.
  const innerL = x0 + face
  const innerR = x0 + drawW - face
  const innerT = y0 + face
  const innerW = Math.max(innerR - innerL, 1)
  const innerH = Math.max(y0 + drawH - innerT, 1)
  const leafW = innerW / leaves

  const rightHand = config?.handing === "right"
  const clear = resolution?.clear

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, background: UI.surface }}>

      <div style={{ background: UI.accent, padding: "16px 24px", flexShrink: 0 }}>
        <h2 style={{ margin: 0, color: "#FFFFFF", fontFamily: FONT, fontSize: 21, fontWeight: 500, letterSpacing: "-0.01em" }}>
          Steel Doors — elevation
        </h2>
      </div>

      <div style={{ flex: 1, minHeight: 0, padding: "18px 24px 6px" }}>
        <svg
          viewBox={`0 0 ${VB.w} ${VB.h}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ display: "block", width: "100%", height: "100%" }}
          role="img"
          aria-label={hasSize
            ? `Elevation, ${leaves} leaf steel doorset, ${w} by ${h} millimetres`
            : "Steel doorset elevation, dimensions not yet entered"}
        >
          {/* Frame, drawn as a section around the opening */}
          <rect x={x0} y={y0} width={drawW} height={drawH} fill={FRAME} stroke={EDGE} strokeWidth="1.3" />
          <rect x={innerL} y={innerT} width={innerW} height={innerH} fill="#FFFFFF" stroke={EDGE} strokeWidth="0.8" />

          {/* Leaves. Hinged, so knuckles show on the hanging edge. */}
          {Array.from({ length: leaves }, (_, i) => {
            const lx = innerL + i * leafW
            // A pair meets in the middle and hangs on the outer jambs.
            const hingeLeft = leaves === 1 ? !rightHand : i === 0
            const hx = hingeLeft ? lx - 2 : lx + leafW - 8
            const isActive = leaves === 1 || (rightHand ? i === leaves - 1 : i === 0)
            const leadX = hingeLeft ? lx + leafW - 16 : lx + 8
            const room = leafW > 26 && innerH > 40
            return (
              <g key={i}>
                <rect
                  x={lx + 1} y={innerT + 1}
                  width={leafW - 2} height={innerH - 2}
                  fill={LEAF} stroke={EDGE} strokeWidth="1.1"
                />
                {room && HINGE_FRACTIONS.map(f => (
                  <rect
                    key={f}
                    x={hx} y={innerT + innerH * f - 11}
                    width={10} height={22}
                    fill={DEEP} stroke={EDGE} strokeWidth="0.7"
                  />
                ))}
                {isActive && room && (
                  <g>
                    {/* Lever handle and cylinder on the leading edge */}
                    <rect x={leadX - 1} y={innerT + innerH * 0.5 - 2} width={17} height={4} rx={2}
                      fill={DEEP} stroke={EDGE} strokeWidth="0.7" />
                    <circle cx={leadX + 7} cy={innerT + innerH * 0.5 + 13} r={3.4}
                      fill="#F4F6F8" stroke={EDGE} strokeWidth="0.8" />
                  </g>
                )}
              </g>
            )
          })}

          {/* Width, below */}
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
          {hasSize && clear && (
            <text
              x={x0 + drawW / 2} y={y0 + drawH + 59} textAnchor="middle"
              fontFamily={FONT} fontSize="12" fill={UI.muted}
            >
              clear opening {clear.width} × {clear.height} mm
            </text>
          )}

          {/* Height, left */}
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

          {/* What it is, above */}
          <text
            x={x0 + drawW / 2} y={y0 - 16} textAnchor="middle"
            fontFamily={FONT} fontSize="13" fill={UI.muted}
          >
            {leaves === 1 ? "single leaf" : "double leaf"}
            {type ? `  ·  ${type.minutes === 0 ? "not fire rated" : type.classification}` : ""}
            {type?.highPerformance ? "  ·  High Performance" : ""}
            {resolution?.frame ? `  ·  ${resolution.frame.label}` : ""}
          </text>
        </svg>
      </div>

      <div style={{ borderTop: `1px solid ${UI.rule}`, padding: "14px 24px 18px", flexShrink: 0 }}>
        {resolution?.status === "approved" ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: UI.muted, fontFamily: FONT }}>
              Specification
            </span>
            <span style={{ fontSize: 15, fontWeight: 600, color: UI.ink, fontFamily: FONT }}>
              {leaves === 1 ? "Single leaf" : "Double leaf"}, supplied and installed
            </span>
          </div>
        ) : (
          <span style={{ fontSize: 13.5, color: UI.muted, fontFamily: FONT }}>
            {resolution?.status === "outside-limits"
              ? "That size is outside the approved range for this doorset."
              : "Complete the doorset and opening to confirm the specification."}
          </span>
        )}
      </div>
    </div>
  )
}
