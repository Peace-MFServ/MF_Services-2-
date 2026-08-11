'use client'

import {
  VIEW, GEO, CONTROLLER, ANCHORS,
  FONT_SANS, FONT_MONO,
  resolveCable, activeCableLegend,
  flattenComponents, buildInclusionMap,
} from '../lib/cablePlanSpec'

// ─── Drawing palette ──────────────────────────────────────────────
// Technical-drawing greys. Brand navy/orange are reserved for the
// callouts so component state stays the most legible thing on the page.
const INK    = "#1B2430"
const STEEL  = "#55606E"
const HAIR   = "#C3CAD3"
const SLAB   = "#E4E8ED"
const WALL   = "#EFF2F5"
const REVEAL = "#FFFFFF"
const LEAF   = "#FAFBFC"
const MUTED  = "#8B95A3"
const DIM    = "#D2D8DF"
const NAVY   = "#00387B"
const ORANGE = "#ED6E02"

const R_MAIN = 13
const R_SUB  = 11

function isMandatory(comp, system) {
  if (comp.mandatory) return true
  if (!comp.conditions) return false
  return comp.conditions.some(c => system[c.if?.property] === c.if?.equals && c.then?.mandatory === true)
}

/** Point on a device symbol that a leader line should terminate at. */
function deviceAnchor(device, bubble) {
  switch (device.kind) {
    case "disc":
    case "sensor":
      return { x: device.x, y: device.y }
    case "strip":
      return { x: device.x, y: device.y + device.h / 2 }
    case "bar":
      return { x: device.x + device.w / 2, y: device.y + device.h / 2 }
    case "jamb":
    case "box":
    default: {
      const cx = device.x + device.w / 2
      const cy = device.y + device.h / 2
      // Aim at the edge facing the callout so the leader never
      // crosses the symbol it is pointing at.
      if (Math.abs(bubble.x - cx) > Math.abs(bubble.y - cy)) {
        return { x: bubble.x > cx ? device.x + device.w : device.x, y: cy }
      }
      return { x: cx, y: bubble.y > cy ? device.y + device.h : device.y }
    }
  }
}

function DeviceSymbol({ device, stroke, fill }) {
  const common = { stroke, strokeWidth: 1.2, fill }
  switch (device.kind) {
    case "disc":
      return (
        <g>
          <circle cx={device.x} cy={device.y} r={9} {...common} />
          <circle cx={device.x} cy={device.y} r={3.5} fill={stroke} stroke="none" />
        </g>
      )
    case "sensor":
      return (
        <g>
          <rect x={device.x - 12} y={device.y - 7} width={24} height={13} {...common} />
          <line x1={device.x - 8} y1={device.y + 6} x2={device.x - 13} y2={device.y + 17} stroke={stroke} strokeWidth={0.9} />
          <line x1={device.x}     y1={device.y + 6} x2={device.x}      y2={device.y + 19} stroke={stroke} strokeWidth={0.9} />
          <line x1={device.x + 8} y1={device.y + 6} x2={device.x + 13} y2={device.y + 17} stroke={stroke} strokeWidth={0.9} />
        </g>
      )
    case "strip":
      return <rect x={device.x} y={device.y} width={device.w} height={device.h} rx={2} {...common} />
    case "bar":
      return (
        <g>
          <rect x={device.x} y={device.y} width={device.w} height={device.h} rx={1.5} {...common} />
          <line x1={device.x + 6} y1={device.y + device.h / 2} x2={device.x + device.w - 6} y2={device.y + device.h / 2}
            stroke={stroke} strokeWidth={0.7} strokeDasharray="3 3" />
        </g>
      )
    case "jamb":
      return <rect x={device.x} y={device.y} width={device.w} height={device.h} {...common} />
    case "box":
    default:
      return (
        <g>
          <rect x={device.x} y={device.y} width={device.w} height={device.h} rx={1.5} {...common} />
          <line x1={device.x + 5} y1={device.y + device.h - 9} x2={device.x + device.w - 5} y2={device.y + device.h - 9}
            stroke={stroke} strokeWidth={0.8} />
        </g>
      )
  }
}

export default function DoorElevation({ system, componentStates, activeId, onSelect }) {
  if (!system) return null

  const flat = flattenComponents(system)
  const inclusion = buildInclusionMap(system, componentStates)
  const legend = activeCableLegend(flat.map(f => f.comp),
    Object.fromEntries(flat.map(f => [f.comp.id, inclusion[f.comp.id] ? componentStates[f.comp.id] : null])))

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>

      {/* ── Cable key ── */}
      <div style={{
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 22px",
        padding: "12px 20px", borderBottom: `1px solid ${HAIR}`, background: "#FFFFFF", flexShrink: 0,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
          color: MUTED, fontFamily: FONT_SANS, marginRight: 4,
        }}>
          Cable key
        </span>
        {legend.length === 0 && (
          <span style={{ fontSize: 12, color: MUTED, fontFamily: FONT_SANS }}>No components included</span>
        )}
        {legend.map(item => (
          <span key={item.label} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <svg width="26" height="4" aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
              <line x1="0" y1="2" x2="26" y2="2" stroke={item.color} strokeWidth="2.5" />
            </svg>
            <span style={{ fontSize: 11.5, color: INK, fontFamily: FONT_MONO, whiteSpace: "nowrap" }}>
              {item.label}
            </span>
          </span>
        ))}
      </div>

      {/* ── Elevation ── */}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", background: "#FFFFFF", padding: 20 }}>
        <svg
          viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ display: "block", width: "100%", height: "100%" }}
          role="img"
          aria-label={`Cable plan elevation — ${system.name}, ${system.leafType}`}
        >
          {/* ── Structure ─────────────────────────────────────── */}
          <rect x="0" y="0" width={VIEW.w} height={GEO.ceilingY} fill={SLAB} />
          <line x1="0" y1={GEO.ceilingY} x2={VIEW.w} y2={GEO.ceilingY} stroke={HAIR} strokeWidth="1" />

          <rect x="0" y={GEO.ceilingY} width={VIEW.w} height={GEO.floorY - GEO.ceilingY} fill={WALL} />

          {/* Structural opening (reveal) */}
          <rect x={GEO.openL} y={GEO.headY} width={GEO.openR - GEO.openL} height={GEO.floorY - GEO.headY} fill={REVEAL} />

          <rect x="0" y={GEO.floorY} width={VIEW.w} height={VIEW.h - GEO.floorY} fill={SLAB} />
          <line x1="0" y1={GEO.floorY} x2={VIEW.w} y2={GEO.floorY} stroke={STEEL} strokeWidth="1.2" />

          {/* ── Frame (section) ───────────────────────────────── */}
          <rect x={GEO.openL} y={GEO.headY} width={GEO.openR - GEO.openL} height={GEO.jambW} fill={STEEL} />
          <rect x={GEO.openL} y={GEO.headY} width={GEO.jambW} height={GEO.floorY - GEO.headY} fill={STEEL} />
          <rect x={GEO.openR - GEO.jambW} y={GEO.headY} width={GEO.jambW} height={GEO.floorY - GEO.headY} fill={STEEL} />

          {/* Concealed cable route through the frame */}
          <rect
            x={GEO.openL + 5} y={GEO.headY + 5}
            width={GEO.openR - GEO.openL - 10} height={GEO.floorY - GEO.headY - 10}
            fill="none" stroke="#9FB4CE" strokeWidth="0.9" strokeDasharray="5 4"
          />

          {/* ── Operator ──────────────────────────────────────── */}
          <rect x={GEO.leafL} y={GEO.opTop} width={GEO.leafR - GEO.leafL} height={GEO.opBot - GEO.opTop}
            fill="#E8ECF1" stroke={STEEL} strokeWidth="1.2" />
          <text x={GEO.leafL + 12} y={GEO.opTop + 14} fontSize="10.5" fontWeight="700"
            fontFamily={FONT_MONO} fill={INK} letterSpacing="0.04em">
            {system.systemVariant || system.name}
          </text>

          {/* ── Leaf ──────────────────────────────────────────── */}
          <rect x={GEO.leafL} y={GEO.leafTop} width={GEO.leafR - GEO.leafL} height={GEO.leafBot - GEO.leafTop}
            fill={LEAF} stroke={MUTED} strokeWidth="1.2" />

          {/* Hinges, hinge stile */}
          {[212, 360, 508].map(hy => (
            <rect key={hy} x={GEO.leafL - 5} y={hy} width={10} height={30} rx={1.5}
              fill="#CFD6DE" stroke={STEEL} strokeWidth="0.9" />
          ))}

          {/* Intumescent seal on the closing edge */}
          {system.isFireDoor && (
            <rect x={GEO.leafR - 4} y={GEO.leafTop + 4} width={3} height={GEO.leafBot - GEO.leafTop - 8}
              fill={ORANGE} opacity="0.65" />
          )}

          {/* Lever handle and cylinder */}
          <circle cx={GEO.leafR - 26} cy={368} r={7} fill="#CFD6DE" stroke={STEEL} strokeWidth="1" />
          <rect x={GEO.leafR - 72} y={365} width={44} height={6} rx={3} fill="#CFD6DE" stroke={STEEL} strokeWidth="1" />
          <rect x={GEO.leafR - 31} y={392} width={10} height={16} rx={2} fill="#CFD6DE" stroke={STEEL} strokeWidth="0.9" />

          {/* Leaf designation — only meaningful once there is a
              passive leaf to distinguish the active one from. */}
          {system.leafType === "double-leaf" && (
            <>
              <circle cx={450} cy={300} r={19} fill="none" stroke={MUTED} strokeWidth="1.1" />
              <text x={450} y={305} textAnchor="middle" fontSize="13" fontWeight="700"
                fontFamily={FONT_SANS} fill={MUTED}>GF</text>
            </>
          )}

          {/* Threshold */}
          <line x1={GEO.leafL} y1={GEO.leafBot} x2={GEO.leafR} y2={GEO.leafBot} stroke={STEEL} strokeWidth="1.5" />

          {/* ── Controller terminal ───────────────────────────── */}
          <circle cx={CONTROLLER.x} cy={CONTROLLER.y} r={3} fill={STEEL} />

          {/* ── Cable routes ──────────────────────────────────── */}
          {flat.map(({ comp }) => {
            const anchor = ANCHORS[comp.id]
            if (!anchor) return null
            const included = inclusion[comp.id]
            const { color } = resolveCable(componentStates[comp.id])
            const active = activeId === comp.id
            return (
              <polyline
                key={`route-${comp.id}`}
                points={anchor.route.map(p => p.join(",")).join(" ")}
                fill="none"
                stroke={included ? color : DIM}
                strokeWidth={active ? 2.6 : included ? 1.6 : 1}
                strokeDasharray={included ? "none" : "4 4"}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={included ? 1 : 0.4}
              />
            )
          })}

          {/* ── Devices, leaders and callouts ─────────────────── */}
          {flat.map(({ comp, depth }) => {
            const anchor = ANCHORS[comp.id]
            if (!anchor) return null

            const included = inclusion[comp.id]
            const mandatory = isMandatory(comp, system)
            const active = activeId === comp.id
            const r = depth > 0 ? R_SUB : R_MAIN

            const ring = !included ? DIM : mandatory ? ORANGE : NAVY
            const symbolStroke = included ? STEEL : DIM
            const symbolFill = included ? "#FFFFFF" : "#F5F7F9"
            const tip = deviceAnchor(anchor.device, anchor.bubble)

            return (
              <g
                key={comp.id}
                onClick={onSelect ? () => onSelect(comp.id) : undefined}
                // Positions left out of the job stay on the drawing as
                // ghosts so the installer can see what the system can
                // take, without competing with what is actually specified.
                opacity={included ? 1 : 0.42}
                style={{ cursor: onSelect ? "pointer" : "default" }}
              >
                <title>{`${comp.position} — ${comp.label}${included ? "" : " (not included)"}`}</title>

                <DeviceSymbol device={anchor.device} stroke={symbolStroke} fill={symbolFill} />

                <line
                  x1={anchor.bubble.x} y1={anchor.bubble.y} x2={tip.x} y2={tip.y}
                  stroke={included ? MUTED : DIM} strokeWidth="0.8"
                />

                {active && (
                  <circle cx={anchor.bubble.x} cy={anchor.bubble.y} r={r + 4}
                    fill="none" stroke={NAVY} strokeWidth="1" opacity="0.35" />
                )}

                <circle
                  cx={anchor.bubble.x} cy={anchor.bubble.y} r={r}
                  fill={active ? NAVY : "#FFFFFF"}
                  stroke={active ? NAVY : ring}
                  strokeWidth={mandatory && included ? 2 : 1.4}
                  strokeDasharray={included ? "none" : "3 2.5"}
                />
                <text
                  x={anchor.bubble.x} y={anchor.bubble.y + (depth > 0 ? 3.5 : 4)}
                  textAnchor="middle"
                  fontSize={depth > 0 ? 9.5 : 10.5}
                  fontWeight="700"
                  fontFamily={FONT_MONO}
                  fill={active ? "#FFFFFF" : included ? INK : MUTED}
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {comp.position}
                </text>
              </g>
            )
          })}

          {/* ── Drawing identification ────────────────────────── */}
          <text x={20} y={VIEW.h - 18} fontSize="10" fontFamily={FONT_MONO} fill={MUTED}>
            {system.name} · {system.leafType}{system.isFireDoor ? " · fire door" : ""} · elevation, internal face
          </text>
        </svg>
      </div>
    </div>
  )
}
