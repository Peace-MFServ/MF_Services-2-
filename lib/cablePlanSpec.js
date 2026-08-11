// ─────────────────────────────────────────────────────────────────
// Cable plan drawing specification
// ─────────────────────────────────────────────────────────────────
// Single source of truth for how a cable plan is drawn: the cable
// colour key, the door elevation geometry, and the physical anchor
// point / cable route for every component position.
//
// Both the on-screen elevation and the PDF render from this module,
// so the two can never drift apart.
//
// Coordinate space is unitless; VIEW below crops it to the drawn
// content. It is a scaled elevation, not a dimensioned drawing — positions are
// representative of where a component physically sits on the opening,
// which is what an installer reads off the plan.
// ─────────────────────────────────────────────────────────────────

// ─── Typography ──────────────────────────────────────────────────
// One family throughout, matching the reference sheets — they set
// cable designations in the body font, not a monospace. A single
// humanist sans keeps the drawing and the interface consistent.
export const FONT = 'Inter, "Helvetica Neue", Helvetica, Arial, sans-serif'

// ─── Interface palette ───────────────────────────────────────────
// Flat, high contrast, navy as the single accent. Orange appears only
// where it carries meaning (a requirement or a failed check), never
// as decoration. No gradients, no tints stacked on tints.
export const UI = {
  accent:      "#00387B",  // the one accent
  accentDark:  "#002855",
  warn:        "#B4470E",  // functional only — requirements, failures
  ink:         "#101922",  // primary text
  body:        "#2B3641",  // secondary text
  muted:       "#57646F",  // labels, meta — still passes on white
  rule:        "#C4CCD4",  // visible hairlines
  ruleStrong:  "#9AA5B1",  // field borders
  surface:     "#FFFFFF",
  sunken:      "#F2F5F7",
  canvas:      "#E8ECEF",
}

// ─── Cable colour key ────────────────────────────────────────────
// Colours follow the reference legend so an installer reading both
// documents sees the same run in the same colour.
export const CABLE_TYPES = {
  "NYM 3 x 1.5 mm²":        { color: "#1B9DD9", label: "NYM 3 x 1.5 mm²" },
  "J-Y(ST)Y 4 x 0.6 mm²":   { color: "#9B3B5F", label: "J-Y(ST)Y 4 x 0.6 mm²" },
  "J-Y(ST)Y 4 x 0.8 mm²":   { color: "#2E9E4F", label: "J-Y(ST)Y 4 x 0.8 mm²" },
  "Cables through ECO":     { color: "#0F5FA8", label: "Cables through ECO" },
  "(integrated)":           { color: "#1B3A5C", label: "Included in the scope of supply" },
}

export const OTHER_CABLE = { color: "#B4470E", label: "Other cable" }
export const UNSET_CABLE = { color: "#9AA5B1", label: "No cable selected" }

/**
 * Resolve a component's current state to a colour + legend label.
 */
export function resolveCable(state) {
  if (!state) return UNSET_CABLE
  if (state.isOther) return OTHER_CABLE
  const known = CABLE_TYPES[state.selectedCable]
  if (known) return known
  if (state.selectedCable) return { color: OTHER_CABLE.color, label: state.selectedCable }
  return UNSET_CABLE
}

/**
 * Cable types actually in use by the current configuration, in key
 * order, for the drawing legend. Excluded components don't count.
 */
export function activeCableLegend(components, componentStates) {
  const seen = new Map()
  for (const comp of components) {
    const state = componentStates[comp.id]
    if (!state?.included) continue
    const { color, label } = resolveCable(state)
    if (!seen.has(label)) seen.set(label, color)
  }
  return [...seen].map(([label, color]) => ({ label, color }))
}

// ─── Drawing palette ─────────────────────────────────────────────
// Shared by the on-screen elevation and the PDF so the two render
// identically. Reads as a CAD elevation: grey-blue solids, dark
// outlines, no fills lighter than the paper.
export const DRAW = {
  outline:  "#1B2733",  // primary linework
  frame:    "#8895A3",  // frame and wall section, solid
  frameEdge:"#3C4956",
  leaf:     "#CBD5DF",  // door leaf fill
  leafEdge: "#3C4956",
  hardware: "#8E9BA8",
  wall:     "#F4F6F8",
  ghost:    "#9AA5B1",  // positions not in the job
  label:    "#101922",
  meta:     "#57646F",
}

// ─── Door elevation geometry ─────────────────────────────────────
// The viewBox is cropped tight to the drawn content. The reference
// sheets float the door assembly on white with no wall or ceiling
// fill, so there is nothing to show outside these bounds and the
// assembly can be drawn as large as the sheet allows.
export const VIEW = { x: 118, y: 22, w: 686, h: 568 }

export const GEO = {
  headY:      110,  // top of structural opening
  frameHeadB: 126,  // underside of frame head
  opTop:      126,  // operator housing — deep enough to carry the
  opBot:      160,  // unit label clear of the cable collector line
  leafTop:    160,
  leafBot:    566,
  floorY:     572,
  openL:      320,  // structural opening, left
  openR:      580,  // structural opening, right
  jambW:      16,
  leafL:      336,
  leafR:      564,
}

// Every cable terminates at the operator/controller on the header.
export const CONTROLLER = { x: 450, y: 152, w: 118, h: 22 }

// ─── Per-component anchors ───────────────────────────────────────
// device  — the physical device symbol drawn on the elevation
//             kind: box | disc | sensor | strip | bar | jamb
// bubble  — where the numbered callout circle sits
// route   — orthogonal cable polyline, device → controller
//
// Routes are hand-authored rather than auto-routed: parallel risers
// and shared lanes read far better on a technical drawing than a
// generic router, and there are few enough positions to be worth it.
export const ANCHORS = {
  // ── Supply ──────────────────────────────────────────────────
  "comp-1": {
    device: { kind: "box", x: 138, y: 490, w: 36, h: 48 },
    bubble: { x: 156, y: 460 },
    route: [[156, 538], [156, 552], [306, 552], [306, 152], [444, 152]],
  },

  // ── Frame-mounted, strike side ──────────────────────────────
  "comp-2": {
    device: { kind: "jamb", x: 564, y: 296, w: 16, h: 44 },
    bubble: { x: 636, y: 300 },
    route: [[572, 296], [572, 152], [456, 152]],
  },
  "comp-3": {
    device: { kind: "jamb", x: 564, y: 368, w: 16, h: 30 },
    bubble: { x: 636, y: 372 },
    route: [[576, 368], [576, 152], [456, 152]],
  },

  // ── Frame-mounted, hinge side ───────────────────────────────
  "comp-4": {
    device: { kind: "jamb", x: 320, y: 196, w: 16, h: 34 },
    bubble: { x: 262, y: 200 },
    route: [[328, 196], [328, 152], [444, 152]],
  },

  // ── Leaf-mounted ────────────────────────────────────────────
  "comp-5": {
    device: { kind: "bar", x: 350, y: 166, w: 116, h: 9 },
    bubble: { x: 408, y: 214 },
    route: [[408, 166], [408, 152], [444, 152]],
  },
  "comp-5-1": {
    device: { kind: "strip", x: 554, y: 210, w: 7, h: 190 },
    bubble: { x: 636, y: 236 },
    route: [[557, 210], [557, 152], [456, 152]],
  },

  // ── Wall-mounted controls ───────────────────────────────────
  "comp-6": {
    device: { kind: "box", x: 232, y: 296, w: 30, h: 44 },
    bubble: { x: 247, y: 266 },
    route: [[247, 296], [247, 96], [318, 96], [318, 152], [444, 152]],
  },
  "comp-6-1": {
    device: { kind: "box", x: 650, y: 296, w: 30, h: 44 },
    bubble: { x: 665, y: 266 },
    route: [[665, 296], [665, 96], [572, 96], [572, 152], [456, 152]],
  },
  "comp-7": {
    device: { kind: "sensor", x: 372, y: 76 },
    bubble: { x: 372, y: 44 },
    route: [[372, 86], [372, 126]],
  },
  "comp-7-1": {
    device: { kind: "sensor", x: 528, y: 76 },
    bubble: { x: 528, y: 44 },
    route: [[528, 86], [528, 126]],
  },
  "comp-8": {
    device: { kind: "box", x: 740, y: 292, w: 34, h: 48 },
    bubble: { x: 757, y: 262 },
    route: [[757, 292], [757, 88], [576, 88], [576, 152], [456, 152]],
  },
  "comp-9": {
    device: { kind: "box", x: 140, y: 296, w: 30, h: 44 },
    bubble: { x: 155, y: 266 },
    route: [[155, 296], [155, 88], [312, 88], [312, 152], [444, 152]],
  },

  // ── Detection ───────────────────────────────────────────────
  "comp-11": {
    device: { kind: "disc", x: 232, y: 44 },
    bubble: { x: 186, y: 44 },
    route: [[232, 52], [232, 78], [324, 78], [324, 152], [444, 152]],
  },
  "comp-12": {
    device: { kind: "disc", x: 450, y: 78 },
    bubble: { x: 450, y: 44 },
    route: [[450, 86], [450, 126]],
  },
}

/**
 * Flatten a system's components (including sub-components) into a
 * single ordered list, tagging each with its nesting depth.
 */
export function flattenComponents(system) {
  const out = []
  for (const comp of system.components) {
    out.push({ comp, depth: 0 })
    if (comp.subComponents) {
      for (const sub of comp.subComponents) out.push({ comp: sub, depth: 1 })
    }
  }
  return out
}

/**
 * Is this component mandatory for this system? Either intrinsically,
 * or because a system property triggers one of its conditions.
 */
export function isMandatoryForSystem(comp, system) {
  if (comp.mandatory) return true
  if (!comp.conditions) return false
  return comp.conditions.some(c => system[c.if?.property] === c.if?.equals && c.then?.mandatory === true)
}

/**
 * Conditional remark that replaces the standard one (e.g. the DIGt
 * approval requirement that only applies to fire doors).
 */
export function getRemarksOverride(comp, system) {
  if (!comp.conditions) return null
  for (const c of comp.conditions) {
    if (system[c.if?.property] === c.if?.equals && c.then?.remarksOverride) return c.then.remarksOverride
  }
  return null
}

/**
 * Starting state for a system — the "prepared" plan the user then
 * customises. Mandatory and non-optional components start included.
 */
export function buildInitialState(system) {
  const state = {}
  const add = comp => {
    state[comp.id] = {
      included: isMandatoryForSystem(comp, system) || !comp.optional,
      selectedCable: comp.cable.defaultCable,
      isOther: false,
      otherValue: "",
      userRemarks: "",
    }
    if (comp.subComponents) comp.subComponents.forEach(add)
  }
  system.components.forEach(add)
  return state
}

/**
 * The single validation pass for a configuration.
 *
 * This replaces the two divergent checks that used to run at different
 * points in the flow (one in the configurator, one in the PDF lib),
 * which could disagree about whether a plan was releasable.
 *
 * Errors block progress and PDF generation; warnings are advisory.
 */
export function validateConfiguration(system, componentStates) {
  const inclusion = buildInclusionMap(system, componentStates)
  const errors = []
  const warnings = []

  for (const { comp } of flattenComponents(system)) {
    const state = componentStates[comp.id]
    if (!state) continue

    if (!inclusion[comp.id]) {
      if (isMandatoryForSystem(comp, system) && !state.included) {
        errors.push({ id: comp.id, position: comp.position, label: comp.label,
          reason: "Mandatory component cannot be removed." })
      }
      continue
    }

    if (state.isOther) {
      if (!state.otherValue?.trim()) {
        errors.push({ id: comp.id, position: comp.position, label: comp.label,
          reason: "Other cable selected but no cable type specified." })
      }
    } else if (!state.selectedCable && comp.cable.allowedCables.length > 0) {
      warnings.push({ id: comp.id, position: comp.position, label: comp.label,
        reason: "No cable selected." })
    }
  }

  return { errors, warnings, isValid: errors.length === 0 }
}

/**
 * A sub-component is only really in the job if its parent is too.
 * Toggling off a parent hides its children in the UI but leaves their
 * `included` flag set, so every consumer must resolve inclusion
 * through here rather than reading the flag directly.
 */
export function buildInclusionMap(system, componentStates) {
  const map = {}
  for (const comp of system.components) {
    const on = componentStates[comp.id]?.included ?? false
    map[comp.id] = on
    if (comp.subComponents) {
      for (const sub of comp.subComponents) {
        map[sub.id] = on && (componentStates[sub.id]?.included ?? false)
      }
    }
  }
  return map
}
