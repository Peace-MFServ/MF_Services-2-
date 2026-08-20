'use client'

import {
  UI, FONT, DRAW,
  resolveCable, activeCableLegend,
  flattenComponents, buildInclusionMap, isMandatoryForSystem,
} from '../lib/cablePlanSpec'

const R_MAIN = 11
const R_SUB  = 9.5

// Hinge positions as fractions of the leaf height, so any leaf span
// gets three sensibly spaced knuckles.
const HINGE_FRACTIONS = [0.13, 0.49, 0.86]

/** Point on a device symbol that a leader line should terminate at. */
function deviceAnchor(device, bubble) {
  switch (device.kind) {
    case "disc":
    case "sensor":
      return { x: device.x, y: device.y }
    case "flatscan":
      return { x: device.x + device.w / 2, y: device.y + device.h + 6 }
    case "strip": {
      // Vertical strips point from their long edge; horizontal ones
      // use the same edge-picking as boxes.
      if (device.h >= device.w) return { x: device.x, y: device.y + device.h / 2 }
      const cx = device.x + device.w / 2
      const cy = device.y + device.h / 2
      if (Math.abs(bubble.x - cx) > Math.abs(bubble.y - cy)) {
        return { x: bubble.x > cx ? device.x + device.w : device.x, y: cy }
      }
      return { x: cx, y: bubble.y > cy ? device.y + device.h : device.y }
    }
    case "bar":
      return { x: device.x + device.w / 2, y: device.y + device.h / 2 }
    default: {
      const cx = device.x + device.w / 2
      const cy = device.y + device.h / 2
      if (Math.abs(bubble.x - cx) > Math.abs(bubble.y - cy)) {
        return { x: bubble.x > cx ? device.x + device.w : device.x, y: cy }
      }
      return { x: cx, y: bubble.y > cy ? device.y + device.h : device.y }
    }
  }
}

function DeviceSymbol({ device, stroke, fill }) {
  const s = { stroke, strokeWidth: 1.3, fill }
  switch (device.kind) {
    case "disc":
      return (
        <g>
          <circle cx={device.x} cy={device.y} r={8.5} {...s} />
          <circle cx={device.x} cy={device.y} r={3} fill={stroke} stroke="none" />
        </g>
      )
    case "sensor":
      return (
        <g>
          <rect x={device.x - 12} y={device.y - 7} width={24} height={13} {...s} />
          <line x1={device.x - 8} y1={device.y + 6} x2={device.x - 13} y2={device.y + 16} stroke={stroke} strokeWidth={1} />
          <line x1={device.x}     y1={device.y + 6} x2={device.x}      y2={device.y + 18} stroke={stroke} strokeWidth={1} />
          <line x1={device.x + 8} y1={device.y + 6} x2={device.x + 13} y2={device.y + 16} stroke={stroke} strokeWidth={1} />
        </g>
      )
    case "strip":
      // Sensor strips read as the black profile they are on site.
      return <rect x={device.x} y={device.y} width={device.w} height={device.h} stroke={stroke} strokeWidth={1.3} fill={stroke} />
    case "flatscan": {
      // Laser scanner under the head — housing with a curved face,
      // as on the manufacturer's sheets.
      const { x, y, w, h } = device
      return (
        <g>
          <path
            d={`M ${x} ${y} H ${x + w} V ${y + h * 0.4} Q ${x + w / 2} ${y + h * 1.7} ${x} ${y + h * 0.4} Z`}
            {...s}
          />
          <line x1={x + 5} y1={y + 3.5} x2={x + w - 5} y2={y + 3.5}
            stroke={stroke} strokeWidth={0.7} opacity={0.6} />
        </g>
      )
    }
    case "bar":
      return (
        <g>
          <rect x={device.x} y={device.y} width={device.w} height={device.h} {...s} />
          <line x1={device.x + 5} y1={device.y + device.h / 2} x2={device.x + device.w - 5} y2={device.y + device.h / 2}
            stroke={stroke} strokeWidth={0.8} strokeDasharray="3 2.5" />
        </g>
      )
    default:
      return (
        <g>
          <rect x={device.x} y={device.y} width={device.w} height={device.h} {...s} />
          <line x1={device.x + 5} y1={device.y + device.h - 10} x2={device.x + device.w - 5} y2={device.y + device.h - 10}
            stroke={stroke} strokeWidth={1} />
        </g>
      )
  }
}

export default function DoorElevation({ system, componentStates, activeId, onSelect }) {
  if (!system?.drawing) return null

  const { view, geo, controller, anchors } = system.drawing
  const flat = flattenComponents(system)
  const inclusion = buildInclusionMap(system, componentStates)
  const legend = activeCableLegend(
    flat.map(f => f.comp),
    Object.fromEntries(flat.map(f => [f.comp.id, inclusion[f.comp.id] ? componentStates[f.comp.id] : null])),
  )

  const opL = geo.leaves[0].l
  const opR = geo.leaves[geo.leaves.length - 1].r
  const activeLeaf = geo.leaves.find(lf => lf.active) ?? geo.leaves[0]
  // The leading edge is the one away from the hinges — where the
  // handle, cylinder and (on fire doors) the intumescent strip sit.
  const leadingX = activeLeaf.hinge === "left" ? activeLeaf.r : activeLeaf.l
  const leadDir = activeLeaf.hinge === "left" ? -1 : 1   // into the leaf

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, background: UI.surface }}>

      {/* ── Title band ── */}
      <div style={{ background: UI.accent, padding: "16px 24px", flexShrink: 0 }}>
        <h2 style={{
          margin: 0, color: "#FFFFFF", fontFamily: FONT,
          fontSize: 21, fontWeight: 500, letterSpacing: "-0.01em", lineHeight: 1.25,
        }}>
          Cable diagram — {system.name} {system.leafType}
        </h2>
      </div>

      {/* ── Elevation ── */}
      <div style={{ flex: 1, minHeight: 0, padding: "16px 24px 8px" }}>
        <svg
          viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ display: "block", width: "100%", height: "100%" }}
          role="img"
          aria-label={`Cable diagram, ${system.name} ${system.leafType}`}
        >
          {/* Frame, drawn as a section. The assembly floats on white —
              no wall or ceiling fill, matching the reference sheets. */}
          <g stroke={DRAW.frameEdge} strokeWidth="1.2" fill={DRAW.frame}>
            <rect x={geo.openL} y={geo.headY} width={geo.openR - geo.openL} height={geo.jambW} />
            <rect x={geo.openL} y={geo.headY} width={geo.jambW} height={geo.floorY - geo.headY} />
            <rect x={geo.openR - geo.jambW} y={geo.headY} width={geo.jambW} height={geo.floorY - geo.headY} />
            <rect x={geo.openL} y={geo.floorY - 7} width={geo.openR - geo.openL} height={7} />
          </g>

          {/* Concealed route through the frame */}
          <rect
            x={geo.openL + 5} y={geo.headY + 5}
            width={geo.openR - geo.openL - 10} height={geo.floorY - geo.headY - 10}
            fill="none" stroke="#2E9E4F" strokeWidth="1" strokeDasharray="6 4"
          />

          {/* Operator, spanning the leaves */}
          <rect x={opL} y={geo.opTop} width={opR - opL} height={geo.opBot - geo.opTop}
            fill="#FFFFFF" stroke={DRAW.frameEdge} strokeWidth="1.3" />
          <text x={opL + 10} y={geo.opTop + 14} fontSize="11" fontWeight="600"
            fontFamily={FONT} fill={DRAW.label}>
            {system.systemVariant || system.name}
          </text>

          {/* Leaves */}
          {geo.leaves.map((leaf, i) => (
            <g key={i}>
              <rect x={leaf.l} y={geo.leafTop} width={leaf.r - leaf.l} height={geo.leafBot - geo.leafTop}
                fill={DRAW.leaf} stroke={DRAW.leafEdge} strokeWidth="1.3" />
              {/* Stile / rail relief */}
              <rect x={leaf.l + 14} y={geo.leafTop + 14} width={leaf.r - leaf.l - 28} height={geo.leafBot - geo.leafTop - 28}
                fill="none" stroke={DRAW.leafEdge} strokeWidth="0.6" opacity="0.45" />
              {/* Hinges on this leaf's hinge side */}
              {HINGE_FRACTIONS.map(f => {
                const hy = geo.leafTop + (geo.leafBot - geo.leafTop) * f
                const hx = leaf.hinge === "left" ? leaf.l - 5 : leaf.r - 5
                return (
                  <rect key={f} x={hx} y={hy} width={10} height={30}
                    fill={DRAW.hardware} stroke={DRAW.frameEdge} strokeWidth="1" />
                )
              })}
            </g>
          ))}

          {/* Intumescent strip on the active leaf's leading edge */}
          {system.isFireDoor && (
            <rect
              x={leadDir === -1 ? leadingX - 4 : leadingX + 1}
              y={geo.leafTop + 4} width={3} height={geo.leafBot - geo.leafTop - 8}
              fill="#B4470E"
            />
          )}

          {/* Lever handle and cylinder on the active leaf */}
          <circle cx={leadingX + leadDir * 26} cy={368} r={6.5} fill={DRAW.hardware} stroke={DRAW.frameEdge} strokeWidth="1.1" />
          <rect x={leadDir === -1 ? leadingX - 72 : leadingX + 28} y={365} width={44} height={6}
            fill={DRAW.hardware} stroke={DRAW.frameEdge} strokeWidth="1.1" />
          <rect x={leadingX + leadDir * 26 - 5} y={392} width={10} height={16}
            fill={DRAW.hardware} stroke={DRAW.frameEdge} strokeWidth="1" />

          {/* Active-leaf marker on double doors */}
          {geo.leaves.length > 1 && (
            <>
              <circle cx={(activeLeaf.l + activeLeaf.r) / 2} cy={300} r={20} fill="none" stroke={DRAW.leafEdge} strokeWidth="1.3" />
              <text x={(activeLeaf.l + activeLeaf.r) / 2} y={306} textAnchor="middle" fontSize="15" fontWeight="500"
                fontFamily={FONT} fill={DRAW.label}>GF</text>
            </>
          )}

          <circle cx={controller.x} cy={controller.y} r={2.6} fill={DRAW.outline} />

          {/* Cable runs */}
          {flat.map(({ comp }) => {
            const a = anchors[comp.id]
            if (!a) return null
            const included = inclusion[comp.id]
            const { color } = resolveCable(componentStates[comp.id])
            return (
              <polyline
                key={`r-${comp.id}`}
                points={a.route.map(p => p.join(",")).join(" ")}
                fill="none"
                stroke={included ? color : DRAW.ghost}
                strokeWidth={activeId === comp.id ? 2.8 : 1.5}
                strokeDasharray={included ? "none" : "5 4"}
                strokeLinejoin="round" strokeLinecap="round"
                opacity={included ? 1 : 0.5}
              />
            )
          })}

          {/* Devices and callouts */}
          {flat.map(({ comp, depth }) => {
            const a = anchors[comp.id]
            if (!a) return null
            const included = inclusion[comp.id]
            const mandatory = isMandatoryForSystem(comp, system)
            const active = activeId === comp.id
            const r = depth > 0 ? R_SUB : R_MAIN
            const stroke = included ? DRAW.outline : DRAW.ghost
            // A position that repeats on each leaf carries a devices
            // array; the leader points at the first one.
            const devices = a.devices ?? [a.device]
            const tip = deviceAnchor(devices[0], a.bubble)

            return (
              <g
                key={comp.id}
                onClick={onSelect ? () => onSelect(comp.id) : undefined}
                opacity={included ? 1 : 0.45}
                style={{ cursor: onSelect ? "pointer" : "default" }}
              >
                <title>{`${comp.position} — ${comp.label}${included ? "" : " (not included)"}`}</title>

                {devices.map((d, i) => (
                  <DeviceSymbol key={i} device={d} stroke={stroke} fill={included ? "#FFFFFF" : DRAW.wall} />
                ))}
                <line x1={a.bubble.x} y1={a.bubble.y} x2={tip.x} y2={tip.y} stroke={stroke} strokeWidth="0.9" />

                <circle
                  cx={a.bubble.x} cy={a.bubble.y} r={r}
                  fill={active ? UI.accent : "#FFFFFF"}
                  stroke={active ? UI.accent : mandatory && included ? "#B4470E" : stroke}
                  strokeWidth={mandatory && included ? 1.8 : 1.2}
                />
                <text
                  x={a.bubble.x} y={a.bubble.y + (depth > 0 ? 3.4 : 3.8)}
                  textAnchor="middle"
                  fontSize={depth > 0 ? 9 : 10.5}
                  fontWeight="600"
                  fontFamily={FONT}
                  fill={active ? "#FFFFFF" : DRAW.label}
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {comp.position}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* ── Legend, at the foot of the sheet ── */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
        gap: "7px 32px", padding: "14px 24px 18px", borderTop: `1px solid ${UI.rule}`, flexShrink: 0,
      }}>
        {legend.length === 0 && (
          <span style={{ fontSize: 13, color: UI.muted, fontFamily: FONT }}>No positions included.</span>
        )}
        {legend.map(item => (
          <span key={item.label} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <svg width="34" height="4" aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
              <line x1="0" y1="2" x2="34" y2="2" stroke={item.color} strokeWidth="2.6" />
            </svg>
            <span style={{ fontSize: 13, color: UI.body, fontFamily: FONT, lineHeight: 1.4 }}>
              {item.label}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
