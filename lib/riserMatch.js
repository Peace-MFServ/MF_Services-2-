// ─────────────────────────────────────────────────────────────────
// Christo riser door — approved-size matching
// ─────────────────────────────────────────────────────────────────
// The customer enters a structural opening; this module decides which
// leaf counts the Kiwa Field of Application report (PAR/21319/01)
// approves for it. The leaf count is no longer a free choice — the
// measurements determine it, and the interface only offers counts the
// report actually covers. Outside every envelope, the configuration
// becomes a bespoke enquiry — a conversation, not a rejection.
//
// Envelopes are per-leaf corner pairs [[w1,h1],[w2,h2]]: full height
// h1 up to width w1, sloping to h2 at the maximum width w2. The
// report approves both directions of fire exposure, so there is no
// direction logic here.
// ─────────────────────────────────────────────────────────────────

import christo from "../data/christo-riser-door.json"

export const CHRISTO = christo

/** Does a leaf of this size sit inside one approved corner envelope? */
export function leafFitsEnvelope(leafW, leafH, envelope) {
  const [[w1, h1], [w2, h2]] = envelope
  if (leafW > w2) return false
  const maxH = leafW <= w1 ? h1 : h2 + ((h1 - h2) * (w2 - leafW)) / (w2 - w1)
  return leafH <= maxH
}

/** Is this leaf count approved for the implied leaf size? */
export function leafCountApproved(leaves, leafW, leafH) {
  if (leafW < christo.minLeafWidth) return false
  const envelopes = christo.envelopes[String(leaves)]
  if (!envelopes) return false
  return envelopes.some(env => leafFitsEnvelope(leafW, leafH, env))
}

/** Clear opening implied by the structural opening. */
export function clearOpeningFor(structuralWidth, structuralHeight) {
  const width = structuralWidth - christo.clearOpening.widthDeduction
  const height = structuralHeight - christo.clearOpening.heightDeduction
  if (width <= 0 || height <= 0) return null
  return { width, height }
}

/**
 * Every leaf count the report approves for this opening, ascending.
 * Leaves divide the clear width equally; all leaves share the height.
 */
export function allowedLeafCounts(structuralWidth, structuralHeight) {
  const clear = clearOpeningFor(structuralWidth, structuralHeight)
  if (!clear) return []
  const counts = []
  for (let n = 1; n <= christo.maxLeaves; n++) {
    if (leafCountApproved(n, clear.width / n, clear.height)) counts.push(n)
  }
  return counts
}

/** Wall constructions valid for a leaf count (masonry is 1–2 leaf only). */
export function wallsForLeaves(leaves) {
  return christo.walls.filter(w => leaves <= w.maxLeaves)
}

/**
 * Match the full requirement.
 *
 * Returns:
 *   status        — "approved" (inside the Kiwa envelopes) or "over-limit"
 *   clear, leaf   — implied geometry
 *   allowedLeaves — every approved count for this opening
 *   wallConflict  — chosen wall not approved at this leaf count
 *   basis         — INTERNAL citation for the sales side; never rendered
 */
export function matchChristo({ structuralWidth, structuralHeight, leaves, wall }) {
  const clear = clearOpeningFor(structuralWidth, structuralHeight)
  if (!clear) return { status: "over-limit", clear: null, leaf: null, allowedLeaves: [], wallConflict: false }

  const allowed = allowedLeafCounts(structuralWidth, structuralHeight)
  const leaf = {
    width: Math.round(clear.width / leaves),
    height: Math.round(clear.height),
  }
  const approved = allowed.includes(leaves)
  const wallDef = christo.walls.find(w => w.id === wall)
  const wallConflict = !!wallDef && leaves > wallDef.maxLeaves

  return {
    status: approved ? "approved" : "over-limit",
    clear,
    leaf,
    allowedLeaves: allowed,
    wallConflict,
    basis: approved
      ? `${leaves} ${leaves === 1 ? "leaf" : "leaves"} at ${leaf.width} × ${leaf.height} mm, inside the approved leaf envelope in ${christo.approval.reference} (${christo.approval.body}), up to ${christo.approval.maxMinutes} minutes to ${christo.approval.standard}, both directions of exposure.`
      : `No approved configuration in ${christo.approval.reference} covers this opening — bespoke enquiry.`,
  }
}
