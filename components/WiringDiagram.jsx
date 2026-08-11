'use client'

const NAVY  = "#00387B"
const BLUE  = "#1470B1"
const ORANGE = "#ED6E02"
const GRAY  = "#6B7280"
const TEXT  = "#111827"
const MONO  = "DM Mono, Courier New, monospace"
const SANS  = "DM Sans, sans-serif"

// Bus / door geometry
const BUS_L = 252   // left bus x
const BUS_R = 468   // right bus x
const BUS_T = 36    // top bus y  (inside header)
const BUS_B = 450   // bottom bus y

// Two vertical columns of component circles
const COL_L = 90    // left column cx
const COL_R = 630   // right column cx
const R_MAIN = 15   // circle radius — main components
const R_SUB  = 12   // circle radius — sub-components

// All 14 components placed in a clean 2-column layout.
// side=left → horizontal tap goes right to BUS_L
// side=right → horizontal tap goes left to BUS_R
// side=bottom → vertical tap goes up to BUS_B
const SCHEMATIC = [
  // LEFT COLUMN
  { id:"comp-3",   cx:COL_L, cy:70,  side:"left",   pos:"3",   sub:false, label:"Bolt Switch Contact"      },
  { id:"comp-7",   cx:COL_L, cy:143, side:"left",   pos:"7",   sub:false, label:"Radar Sensor (In)"        },
  { id:"comp-7-1", cx:COL_L, cy:213, side:"left",   pos:"7.1", sub:true,  label:"Radar Sensor (Out)"       },
  { id:"comp-2",   cx:COL_L, cy:286, side:"left",   pos:"2",   sub:false, label:"24 V DC E-Opener"         },
  { id:"comp-11",  cx:COL_L, cy:356, side:"left",   pos:"11",  sub:false, label:"Smoke Det. (Ceiling)"     },
  { id:"comp-12",  cx:COL_L, cy:426, side:"left",   pos:"12",  sub:false, label:"Smoke Det. (Lintel)"      },
  // RIGHT COLUMN
  { id:"comp-6-1", cx:COL_R, cy:70,  side:"right",  pos:"6.1", sub:true,  label:"Flip Switch (Outside)"    },
  { id:"comp-6",   cx:COL_R, cy:143, side:"right",  pos:"6",   sub:false, label:"Flip Switch (Inside)"     },
  { id:"comp-4",   cx:COL_R, cy:213, side:"right",  pos:"4",   sub:false, label:"Conc. Cable Connection"   },
  { id:"comp-5",   cx:COL_R, cy:286, side:"right",  pos:"5",   sub:false, label:"Flatscan Sensor Set"      },
  { id:"comp-5-1", cx:COL_R, cy:356, side:"right",  pos:"5.1", sub:true,  label:"Sensor Strip Sub"         },
  { id:"comp-8",   cx:COL_R, cy:426, side:"right",  pos:"8",   sub:false, label:"Program Select Switch"    },
  // BOTTOM ROW
  { id:"comp-9",   cx:285,   cy:478, side:"bottom", pos:"9",   sub:false, label:"Close Door Release Btn"   },
  { id:"comp-1",   cx:435,   cy:478, side:"bottom", pos:"1",   sub:false, label:"Voltage Supply 230V"      },
]

function isMandatory(comp, system) {
  if (comp.mandatory) return true
  if (!comp.conditions) return false
  return comp.conditions.some(c => system[c.if?.property] === c.if?.equals && c.then?.mandatory)
}

function getCable(compId, componentStates) {
  const st = componentStates[compId]
  if (!st) return ""
  if (st.isOther) return st.otherValue || "Other"
  return st.selectedCable || ""
}

function isIncluded(compId, componentStates) {
  return componentStates[compId]?.included ?? false
}

// Shorten a cable spec for display on the line (e.g. "J-Y(ST)Y 4 x 0.6 mm²" → "J-Y(ST)Y 4×0.6")
function shortCable(s) {
  if (!s) return ""
  return s.replace(" x ", "×").replace(" mm²", "").replace("mm²", "")
}

export default function WiringDiagram({ system, componentStates }) {
  if (!system) return null

  // Flat list of all system components (including sub-components)
  const allComps = []
  system.components.forEach(c => {
    allComps.push(c)
    if (c.subComponents) c.subComponents.forEach(s => allComps.push(s))
  })

  return (
    <div style={{ marginBottom: 28 }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:10 }}>
        <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.09em", textTransform:"uppercase", color:BLUE }}>
          Cable Schematic — {system.name} · {system.leafType}
        </div>
        <div style={{ display:"flex", gap:20, fontSize:11, color:GRAY, fontFamily:SANS }}>
          <span style={{ display:"flex", alignItems:"center", gap:5 }}>
            <svg width="20" height="14" style={{ display:"block" }}>
              <circle cx="7" cy="7" r="6" fill="none" stroke={ORANGE} strokeWidth="2"/>
            </svg>
            Mandatory
          </span>
          <span style={{ display:"flex", alignItems:"center", gap:5 }}>
            <svg width="20" height="14" style={{ display:"block" }}>
              <circle cx="7" cy="7" r="6" fill="none" stroke={NAVY} strokeWidth="1.5" strokeDasharray="3 2"/>
            </svg>
            Optional
          </span>
          <span style={{ display:"flex", alignItems:"center", gap:5 }}>
            <svg width="20" height="14" style={{ display:"block" }}>
              <circle cx="7" cy="7" r="6" fill="none" stroke={GRAY} strokeWidth="1.5" opacity="0.4"/>
            </svg>
            Not included
          </span>
        </div>
      </div>

      <div style={{
        background:"#FFFFFF",
        border:"1px solid #D1D5DB",
        borderRadius:8,
        overflow:"hidden",
      }}>
        <svg viewBox="0 0 720 510" width="100%" style={{ display:"block" }}
          role="img" aria-label={`Cable schematic — ${system.name}`}>

          {/* ── DOOR FRAME ─────────────────────────────────────── */}

          {/* Wall / jambs (solid dark blocks) */}
          {/* Left jamb */}
          <rect x="237" y="28" width="18" height="422" fill={NAVY} opacity="0.85"/>
          {/* Right jamb */}
          <rect x="465" y="28" width="18" height="422" fill={NAVY} opacity="0.85"/>
          {/* Top header */}
          <rect x="237" y="28" width="246" height="16" fill={NAVY} opacity="0.85"/>
          {/* Floor threshold */}
          <rect x="237" y="442" width="246" height="8" fill={NAVY} opacity="0.55"/>

          {/* Door leaf */}
          <rect x="256" y="45" width="208" height="396" fill="#EFF6FF" stroke={BLUE} strokeWidth="1" opacity="0.7"/>

          {/* Hinges — left edge of leaf */}
          {[95, 235, 375].map(hy => (
            <g key={hy}>
              <rect x="255" y={hy} width="12" height="22" rx="2" fill="#C8D3E0" stroke={NAVY} strokeWidth="0.8"/>
              <line x1="256" y1={hy+11} x2="267" y2={hy+11} stroke={NAVY} strokeWidth="0.5"/>
            </g>
          ))}

          {/* Handle — right edge of leaf */}
          <rect x="447" y="231" width="8" height="36" rx="3" fill="#C8D3E0" stroke={NAVY} strokeWidth="1"/>
          <circle cx="451" cy="231" r="4" fill="#9CA3AF" stroke={NAVY} strokeWidth="0.8"/>
          <circle cx="451" cy="267" r="4" fill="#9CA3AF" stroke={NAVY} strokeWidth="0.8"/>

          {/* Door closer arm (top of door) */}
          <line x1="265" y1="52" x2="340" y2="52" stroke={NAVY} strokeWidth="3" strokeLinecap="round" opacity="0.4"/>
          <circle cx="265" cy="52" r="5" fill={NAVY} opacity="0.4"/>
          <circle cx="340" cy="52" r="3" fill={NAVY} opacity="0.4"/>

          {/* Intumescent strip on closing edge */}
          <rect x="463" y="45" width="3" height="396" fill={ORANGE} opacity="0.6"/>

          {/* ECO Controller box at top of frame */}
          <rect x="312" y="44" width="96" height="28" rx="3"
            fill="#E8F2FA" stroke={BLUE} strokeWidth="1.5"/>
          <text x="360" y="54" textAnchor="middle" fontSize="7" fontWeight="700"
            fontFamily={MONO} fill={NAVY}>ECO ETS 64-R</text>
          <text x="360" y="65" textAnchor="middle" fontSize="6.5"
            fontFamily={MONO} fill={GRAY}>CONTROLLER</text>

          {/* ── CABLE BUS LINES ─────────────────────────────────── */}

          {/* Left bus — runs inside left jamb, from controller down to floor */}
          <line x1={BUS_L} y1={BUS_T} x2={BUS_L} y2={BUS_B}
            stroke={BLUE} strokeWidth="1.5" opacity="0.5"/>

          {/* Right bus */}
          <line x1={BUS_R} y1={BUS_T} x2={BUS_R} y2={BUS_B}
            stroke={BLUE} strokeWidth="1.5" opacity="0.5"/>

          {/* Top bus — runs inside header */}
          <line x1={BUS_L} y1={BUS_T} x2={BUS_R} y2={BUS_T}
            stroke={BLUE} strokeWidth="1.5" opacity="0.5"/>

          {/* Bottom bus — wider, accommodates bottom-row components */}
          <line x1="200" y1={BUS_B} x2="520" y2={BUS_B}
            stroke={BLUE} strokeWidth="1.5" opacity="0.5"/>

          {/* ── COMPONENT CIRCLES & CABLE TAPS ──────────────────── */}

          {SCHEMATIC.map(node => {
            const sysComp = allComps.find(c => c.id === node.id)
            const included = isIncluded(node.id, componentStates)
            const mandatory = sysComp ? isMandatory(sysComp, system) : false
            const cable = shortCable(getCable(node.id, componentStates))
            const r = node.sub ? R_SUB : R_MAIN

            // Visual state
            const ringColor  = !included ? "#D1D5DB" : mandatory ? ORANGE : NAVY
            const ringWidth  = !included ? 1 : mandatory ? 2.5 : 1.8
            const ringDash   = !included ? "4 3" : mandatory ? "none" : "none"
            const numColor   = !included ? "#9CA3AF" : mandatory ? ORANGE : NAVY
            const lineColor  = !included ? "#D1D5DB" : BLUE
            const lineOpacity = !included ? 0.3 : 0.6
            const fontSize   = node.sub ? 9 : 10

            // Tap line: from circle edge to the bus
            let tapX1, tapY1, tapX2, tapY2, cableLabelX, cableLabelY, cableLabelAnchor

            if (node.side === "left") {
              tapX1 = node.cx + r; tapY1 = node.cy
              tapX2 = BUS_L;      tapY2 = node.cy
              cableLabelX = (tapX1 + tapX2) / 2
              cableLabelY = node.cy - 5
              cableLabelAnchor = "middle"
            } else if (node.side === "right") {
              tapX1 = node.cx - r; tapY1 = node.cy
              tapX2 = BUS_R;       tapY2 = node.cy
              cableLabelX = (tapX1 + tapX2) / 2
              cableLabelY = node.cy - 5
              cableLabelAnchor = "middle"
            } else {
              // bottom: vertical line up to bottom bus
              tapX1 = node.cx;  tapY1 = node.cy - r
              tapX2 = node.cx;  tapY2 = BUS_B
              cableLabelX = node.cx + 5
              cableLabelY = (tapY1 + tapY2) / 2
              cableLabelAnchor = "start"
            }

            return (
              <g key={node.id}>
                {/* Cable tap line */}
                <line x1={tapX1} y1={tapY1} x2={tapX2} y2={tapY2}
                  stroke={lineColor} strokeWidth="1"
                  strokeDasharray={included ? "none" : "4 3"}
                  opacity={lineOpacity}/>

                {/* Cable type label on the tap */}
                {cable && included && (
                  <text x={cableLabelX} y={cableLabelY}
                    textAnchor={cableLabelAnchor}
                    fontSize="7.5" fontFamily={MONO} fill={GRAY}>
                    {cable}
                  </text>
                )}

                {/* Component circle */}
                <circle cx={node.cx} cy={node.cy} r={r}
                  fill="#FFFFFF"
                  stroke={ringColor} strokeWidth={ringWidth}
                  strokeDasharray={ringDash}/>

                {/* Position number */}
                <text x={node.cx} y={node.cy + (node.sub ? 3.5 : 4)}
                  textAnchor="middle"
                  fontSize={fontSize} fontWeight="700"
                  fontFamily={MONO} fill={numColor}>
                  {node.pos}
                </text>

                {/* Component label */}
                {node.side === "left" && (
                  <text x={node.cx - r - 5} y={node.cy + 4}
                    textAnchor="end" fontSize="9.5" fontFamily={SANS} fill={included ? TEXT : "#9CA3AF"}>
                    {node.label}
                  </text>
                )}
                {node.side === "right" && (
                  <text x={node.cx + r + 5} y={node.cy + 4}
                    textAnchor="start" fontSize="9.5" fontFamily={SANS} fill={included ? TEXT : "#9CA3AF"}>
                    {node.label}
                  </text>
                )}
                {node.side === "bottom" && (
                  <text x={node.cx} y={node.cy + r + 11}
                    textAnchor="middle" fontSize="9.5" fontFamily={SANS} fill={included ? TEXT : "#9CA3AF"}>
                    {node.label}
                  </text>
                )}
              </g>
            )
          })}

          {/* System label bottom-left */}
          <text x="10" y="500" fontSize="9" fontFamily={MONO} fill="#9CA3AF">
            MF Services · {system.name} · {system.leafType}
            {system.isFireDoor ? " · FIRE DOOR" : ""}
          </text>

        </svg>
      </div>
    </div>
  )
}
