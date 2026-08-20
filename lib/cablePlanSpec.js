// ─────────────────────────────────────────────────────────────────
// Cable plan drawing specification
// ─────────────────────────────────────────────────────────────────
// The shared language of the cable plans: cable colour key, drawing
// palette, and the rules that turn a system definition into a plan.
//
// The systems themselves — component schedules AND drawing geometry
// (view box, door geometry, per-position anchors and routes) — live
// one-per-file in data/cable-systems/, so adding a system is a data
// change. Both the on-screen elevation and the PDF render from the
// same system definition, so the two can never drift apart.
//
// Coordinate space is unitless; each system's drawing.view crops it
// to the drawn content. It is a scaled elevation, not a dimensioned
// drawing — positions are representative of where a component
// physically sits on the opening, which is what an installer reads
// off the plan.
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
  "NYM 3 x 1.5 mm²":              { color: "#1B9DD9", label: "NYM 3 x 1.5 mm²" },
  "J-Y(ST)Y 4 x 0.6 mm²":         { color: "#9B3B5F", label: "J-Y(ST)Y 4 x 0.6 mm²" },
  "J-Y(ST)Y 4 x 0.8 mm²":         { color: "#2E9E4F", label: "J-Y(ST)Y 4 x 0.8 mm²" },
  "With 4 x 0.6 mm² E-opener":    { color: "#6B4FA1", label: "With 4 x 0.6 mm² E-opener" },
  "Cables supplied with operator": { color: "#0F5FA8", label: "Cables supplied with operator" },
  "(integrated)":                 { color: "#1B3A5C", label: "Included in the scope of supply" },
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

// ─── Drawing definitions ─────────────────────────────────────────
// Each system's drawing lives in its data file (data/cable-systems/):
//   view       — viewBox cropped tight to the drawn content
//   geo        — door geometry; geo.leaves is an array so single- and
//                double-leaf sets share one renderer. Each leaf knows
//                its hinge side and whether it is the active leaf.
//   controller — where every cable terminates on the header
//   anchors    — per component id:
//                  device  — symbol drawn on the elevation
//                             kind: box | disc | sensor | strip | bar | jamb
//                  bubble  — where the numbered callout circle sits
//                  route   — orthogonal cable polyline, device → controller
// Routes are hand-authored rather than auto-routed: parallel risers
// and shared lanes read far better on a technical drawing than a
// generic router, and there are few enough positions to be worth it.

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
