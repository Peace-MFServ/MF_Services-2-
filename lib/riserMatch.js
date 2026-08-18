// ─────────────────────────────────────────────────────────────────
// Riser door requirement matching
// ─────────────────────────────────────────────────────────────────
// The customer states a requirement — opening size, leaf count, fire
// period, acoustic rating. This module decides which of the supplier
// products the business sources from can meet it, and on what basis:
//
//   evidenced — a fire test report we hold covers the implied leaf,
//               in BOTH test directions, at the required period
//   stated    — inside what a supplier publishes it manufactures,
//               but not backed by a report we hold
//   (no match) — outside everything on file: a bespoke enquiry
//
// The supplier is never surfaced to the customer; the resolution
// carries it internally so the sales team knows what to quote.
//
// Direction matters. A riser door can face fire from either side, so
// "evidenced" here requires reports covering the leaf opening both
// towards and away from the furnace (EN 1634-1 Table 2). This is what
// splits single-leaf cover — 120 minutes one-way, 90 bi-directionally
// — from double-leaf cover at 120 both ways.
// ─────────────────────────────────────────────────────────────────

import reportsFile from "../data/fire-test-reports.json"
import suppliersFile from "../data/riser-door-suppliers.json"

export const REPORTS = Object.fromEntries(reportsFile.reports.map(r => [r.id, r]))
export const SUPPLIER_PRODUCTS = suppliersFile.products

const DIRECTIONS = ["away", "towards"]

/**
 * EN 1634-1 Annex B: the Category B size allowances (+15% width,
 * +15% height, +20% area) apply only where the tested integrity
 * overran the required period by at least 10%. Below that overrun we
 * take the conservative line: the tested size only.
 */
export function ratingSupported(integrityMinutes, requiredMinutes) {
  return integrityMinutes >= requiredMinutes * 1.1
}

/** The largest leaf a specimen stands for under its report's Annex B category. */
export function specimenEnvelope(specimen, foa) {
  return {
    maxLeafWidth: specimen.leafWidth * (1 + foa.widthIncrease),
    maxLeafHeight: specimen.leafHeight * (1 + foa.heightIncrease),
    maxLeafArea: specimen.leafWidth * specimen.leafHeight * (1 + foa.areaIncrease),
  }
}

/** All three Annex B caps hold at once — the area cap binds first on most shapes. */
export function leafFitsEnvelope(leafW, leafH, env) {
  return leafW <= env.maxLeafWidth
    && leafH <= env.maxLeafHeight
    && leafW * leafH <= env.maxLeafArea
}

/**
 * Does the evidence a product holds cover this leaf, at this count,
 * for this period — in one named direction?
 *
 * Exact-configuration specimens are preferred (both reports tested a
 * double-leaf doorset directly). Where the report has no specimen at
 * the exact leaf count (3- and 4-leaf sets), the single-leaf specimen
 * is applied per leaf — a weaker basis, and flagged as such so the
 * sheet can say so.
 */
function directionCovered(product, direction, leaf, leaves, requiredMinutes) {
  for (const reportId of product.evidence) {
    const report = REPORTS[reportId]
    if (!report || report.direction !== direction) continue

    const exact = report.specimens.find(s => s.leaves === leaves)
    const perLeaf = report.specimens.find(s => s.leaves === 1)

    for (const [specimen, derived] of [[exact, false], [perLeaf, true]]) {
      if (!specimen) continue
      if (!ratingSupported(specimen.integrityMinutes, requiredMinutes)) continue
      const env = specimenEnvelope(specimen, report.fieldOfApplication)
      if (leafFitsEnvelope(leaf.width, leaf.height, env)) {
        return { reportId, specimen, env, perLeafBasis: derived && !exact }
      }
    }
  }
  return null
}

/**
 * Full evidence check: both directions must be covered. Returns null
 * when they aren't, else the reports relied on and the tightest
 * envelope across directions (used for leaf-count suggestions).
 */
export function evidenceFor(product, leaf, leaves, requiredMinutes) {
  const hits = []
  for (const direction of DIRECTIONS) {
    const hit = directionCovered(product, direction, leaf, leaves, requiredMinutes)
    if (!hit) return null
    hits.push(hit)
  }
  return {
    reportIds: [...new Set(hits.map(h => h.reportId))],
    perLeafBasis: hits.some(h => h.perLeafBasis),
    envelope: {
      maxLeafWidth: Math.min(...hits.map(h => h.env.maxLeafWidth)),
      maxLeafHeight: Math.min(...hits.map(h => h.env.maxLeafHeight)),
      maxLeafArea: Math.min(...hits.map(h => h.env.maxLeafArea)),
    },
    specimen: hits[0].specimen,
  }
}

/** Clear opening implied by the structural opening, per this product's frame. */
function clearFor(product, req) {
  const co = product.clearOpening
  const width = req.structuralWidth - co.widthDeduction
  const height = req.structuralHeight - co.heightDeduction
  if (width <= 0 || height <= 0) return null
  return { width, height, confirmed: co.confirmed !== false }
}

/** Inside what this supplier states it manufactures? Limits come in two shapes. */
function withinStated(product, req, leaf) {
  const s = product.statedLimits
  if (s.structuralWidthMin != null && req.structuralWidth < s.structuralWidthMin) return false
  if (s.structuralHeightMin != null && req.structuralHeight < s.structuralHeightMin) return false
  if (s.structuralWidthMax != null && req.structuralWidth > s.structuralWidthMax) return false
  if (s.structuralHeightMax != null && req.structuralHeight > s.structuralHeightMax) return false
  if (s.leafWidthMax != null && leaf.width > s.leafWidthMax) return false
  if (s.leafHeightMax != null && leaf.height > s.leafHeightMax) return false
  if (s.leafAreaMax != null && (leaf.width * leaf.height) / 1e6 > s.leafAreaMax) return false
  return true
}

/** Can this product meet the non-size parts of the requirement at all? */
function offersRequirement(product, req) {
  if (req.leaves > product.maxLeaves) return false
  if (req.fireMinutes != null && !product.fireMinutes.includes(req.fireMinutes)) return false
  if (req.acousticDb != null) {
    const offered = product.acousticOptionsDb ?? (product.acousticDb != null ? [product.acousticDb] : [])
    if (!offered.some(db => db >= req.acousticDb)) return false
  }
  if (req.frame != null && product.frames && !product.frames.includes(req.frame)) return false
  return true
}

/**
 * Match one product against the requirement.
 * Returns null when the product cannot offer it at all; otherwise the
 * candidate with its basis.
 */
export function matchProduct(product, req) {
  if (!offersRequirement(product, req)) return null

  const clear = clearFor(product, req)
  if (!clear) return null

  const leaf = {
    width: Math.round(clear.width / req.leaves),
    height: Math.round(clear.height),
  }

  if (!withinStated(product, req, leaf)) return null

  const evidence = req.fireMinutes != null
    ? evidenceFor(product, leaf, req.leaves, req.fireMinutes)
    : null

  return {
    product,
    status: evidence ? "evidenced" : "stated",
    clear,
    leaf,
    evidence,
  }
}

/**
 * Fewest leaves at which any product's held evidence covers the
 * requirement — the suggestion shown when the chosen count does not.
 * Height is the constraint no leaf count can fix, so null there.
 */
export function smallestEvidencedLeafCount(req) {
  const maxAcross = Math.max(...SUPPLIER_PRODUCTS.map(p => p.maxLeaves))
  for (let leaves = 1; leaves <= maxAcross; leaves++) {
    const trial = { ...req, leaves }
    for (const product of SUPPLIER_PRODUCTS) {
      const match = matchProduct(product, trial)
      if (match?.status === "evidenced") return leaves
    }
  }
  return null
}

/**
 * Match the requirement across every supplier product.
 *
 * Best basis wins: an evidenced match beats a stated one regardless of
 * priority; priority breaks ties within a basis. All candidates are
 * returned so the sales side of the lead can see the alternatives.
 */
export function matchRequirement(req) {
  const candidates = SUPPLIER_PRODUCTS
    .map(p => matchProduct(p, req))
    .filter(Boolean)
    .sort((a, b) => a.product.priority - b.product.priority)

  const best = candidates.find(c => c.status === "evidenced") ?? candidates[0] ?? null

  return {
    status: best ? best.status : "over-limit",
    best,
    candidates,
    suggestedLeaves: smallestEvidencedLeafCount(req),
  }
}
