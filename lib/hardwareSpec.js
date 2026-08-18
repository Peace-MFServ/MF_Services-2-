// ─────────────────────────────────────────────────────────────────
// Hardware specification — domain logic
// ─────────────────────────────────────────────────────────────────
// Turns a set of user inputs into a doorset specification and judges
// it against the supplier products the business sources from — see
// lib/riserMatch.js. Anything outside every supplier's envelope is
// not refused — it is marked as a bespoke enquiry, because the
// business sources to requirement rather than selling a fixed
// catalogue. Every threshold lives in the data files, so extending
// what is offered is a data change, not a code change.
// ─────────────────────────────────────────────────────────────────

import riserDoors from "../data/riser-doors.json"
import { matchRequirement } from "./riserMatch"

// ─────────────────────────────────────────────────────────────────
// Enquiry capture
// ─────────────────────────────────────────────────────────────────
// Business name, email and phone are the point of the tool from the
// sales side — a downloaded specification is a lead. Flip this to true
// to make them compulsory before a specification can be downloaded.
//
// Left off for now so the form is quick to fill while testing. Turning
// it on also puts the required markers on those fields; nothing else
// needs to change.
export const REQUIRE_ENQUIRY_DETAILS = false

export const PRODUCT_TYPES = [
  {
    id: "riser-doors",
    label: "Riser Doors",
    summary: "Fire-rated access to service risers and shafts.",
    available: true,
  },
  {
    id: "steel-doors",
    label: "Steel Doors",
    summary: "Certified steel doorsets for commercial and industrial use.",
    available: false,
  },
  {
    id: "swing-automation",
    label: "Swing Automation",
    summary: "Powered operators for swing doors.",
    available: false,
  },
  {
    id: "sliding-options",
    label: "Sliding Options",
    summary: "Automatic sliding entrances, straight and curved.",
    available: false,
  },
]

export const SPEC_TYPES = [
  { id: "branded",   label: "Branded",   summary: "Carries MF Services identification.", default: true },
  { id: "unbranded", label: "Unbranded", summary: "No supplier identification — for inclusion in your own document." },
]

// Acoustic option → the dB Rw figure the requirement asks for.
// "none" places no acoustic constraint on the match.
const ACOUSTIC_DB = { none: null, db35: 35, standard: 43, enhanced: 47 }

const PRODUCTS = { "riser-doors": riserDoors }

export function getProduct(productTypeId) {
  return PRODUCTS[productTypeId] ?? null
}

/** Outside anything a supplier has said it will make. */
export function isBespoke(resolution) {
  return resolution?.status === "over-limit"
}

/** Buildable, but no test report on file covers a leaf this size. */
export function needsEvidence(resolution) {
  return resolution?.status === "stated"
}

/** Blank configuration for a product, with sensible starting values. */
export function buildInitialConfig(product) {
  if (!product) return {}
  const config = {
    leaves: 1, width: "", height: "",
    fireRating: product.defaultFireRating ?? product.fireRatings[0].id,
  }
  for (const opt of product.options) {
    // Default to a choice that stands on its own. Starting on one that
    // needs a value typed in (a RAL number, say) leaves the form
    // invalid before the user has touched anything.
    const standalone = opt.choices.find(c => !c.requiresText) ?? opt.choices[0]
    config[opt.id] = standalone.id
    if (opt.choices.some(c => c.requiresText)) config[`${opt.id}Text`] = ""
  }
  return config
}

const num = v => {
  if (v === "" || v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const mm2 = v => Math.round(v)
const m2 = v => (v / 1e6).toFixed(2)

/** The requirement the configuration implies, in matcher terms. */
export function buildRequirement(product, config) {
  const w = num(config.width)
  const h = num(config.height)
  if (w == null || h == null || w <= 0 || h <= 0) return null

  const maxLeaves = product.statedLimits.maxLeaves ?? 4
  const leaves = Math.max(1, Math.min(maxLeaves, num(config.leaves) ?? 1))
  const rating = product.fireRatings.find(r => r.id === config.fireRating)

  return {
    structuralWidth: w,
    structuralHeight: h,
    leaves,
    fireMinutes: rating?.period ?? null,
    acousticDb: ACOUSTIC_DB[config.acoustic] ?? null,
    frame: config.frameType || null,
  }
}

/**
 * Judge the configured doorset against every supplier product on file.
 *
 * The leaf count is the user's choice. The tool works out the leaf
 * that choice implies, matches it across suppliers, and says whether a
 * test report actually covers it — and, when it does not, what leaf
 * count would.
 *
 * Returns one of:
 *   { status: "incomplete" }               — no dimensions yet
 *   { status: "evidenced",  leaves, ... }  — a report on file covers it
 *   { status: "stated",     leaves, ... }  — supplier says yes, no report sighted
 *   { status: "over-limit", reason }       — past anything a supplier offers
 *
 * The matched supplier product travels internally on `match` — it is
 * never rendered customer-side.
 */
export function resolveProduct(product, config) {
  if (!product) return { status: "incomplete" }

  const req = buildRequirement(product, config)
  if (!req) return { status: "incomplete" }

  const match = matchRequirement(req)
  const best = match.best

  // Display geometry: the matched product's own frame deductions when
  // there is a match; the category's indicative deduction otherwise.
  const clear = best?.clear ?? getClearOpening(product, config)
  const leaf = best?.leaf ?? (clear && {
    width: mm2(clear.width / req.leaves),
    height: mm2(clear.height),
  })
  const clearNote = best && best.clear.confirmed === false
    ? "Frame deduction is indicative for this doorset — the clear opening is confirmed on the order drawing."
    : null

  const base = { leaves: req.leaves, clear, leaf, clearNote, match, suggestedLeaves: match.suggestedLeaves }

  if (match.status === "over-limit") {
    const limits = product.statedLimits
    const small = req.structuralWidth < limits.width.min || req.structuralHeight < limits.height.min
    return {
      ...base,
      status: "over-limit",
      reason: small
        ? `${req.structuralWidth} × ${req.structuralHeight} mm is smaller than any of our suppliers offers as standard (${limits.width.min} × ${limits.height.min} mm minimum). We can still quote — the specification will be marked as a bespoke enquiry.`
        : `No doorset we source covers ${req.structuralWidth} × ${req.structuralHeight} mm at ${req.leaves} ${req.leaves === 1 ? "leaf" : "leaves"} with the stated requirements. We can still quote — the specification will be marked as a bespoke enquiry.`,
    }
  }

  if (match.status === "evidenced") {
    const ev = best.evidence
    const perLeaf = ev.perLeafBasis
      ? " Multi-leaf coverage is derived per leaf from the single-leaf specimen; the manufacturing drawing confirms it before order."
      : ""
    return {
      ...base,
      status: "evidenced",
      basis: `${req.leaves} ${req.leaves === 1 ? "leaf" : "leaves"} at ${leaf.width} × ${leaf.height} mm, inside the ${mm2(ev.envelope.maxLeafWidth)} × ${mm2(ev.envelope.maxLeafHeight)} mm / ${m2(ev.envelope.maxLeafArea)} m² leaf permitted by EN 1634-1 Annex B from a ${ev.specimen.leafWidth} × ${ev.specimen.leafHeight} mm tested leaf — test ${ev.reportIds.length > 1 ? "reports" : "report"} ${ev.reportIds.join(" and ")}, covering both directions of fire exposure.${perLeaf}`,
    }
  }

  // Buildable per supplier literature, but no report we hold covers it
  // at the required period in both directions. Where more leaves would
  // fix it, say so and let the user decide — height is the case where
  // they cannot, because no number of leaves shortens a leaf.
  const confirm = "A supplier states it manufactures this size — we will obtain the test evidence covering it before order."
  let reason
  if (match.suggestedLeaves != null && match.suggestedLeaves > req.leaves) {
    reason = `At ${req.leaves} ${req.leaves === 1 ? "leaf" : "leaves"} each leaf is ${leaf.width} × ${leaf.height} mm, larger than the leaf our test evidence covers for this rating. ${match.suggestedLeaves} ${match.suggestedLeaves === 1 ? "leaf" : "leaves"} would bring it inside. ${confirm}`
  } else {
    reason = `No test report we hold covers a ${leaf.width} × ${leaf.height} mm leaf at this fire rating in both directions of exposure. ${confirm}`
  }

  return { ...base, status: "stated", reason }
}

/**
 * Validate the whole configuration. Errors block the specification;
 * warnings are advisory.
 */
export function validateSpec(product, config, projectData) {
  const errors = []
  const warnings = []
  if (!product) return { errors, warnings, isValid: false }

  const w = num(config.width)
  const h = num(config.height)

  if (w == null) errors.push({ field: "width", message: "Enter a maximum width." })
  else if (w <= 0) errors.push({ field: "width", message: "Enter a width greater than zero." })

  if (h == null) errors.push({ field: "height", message: "Enter a maximum height." })
  else if (h <= 0) errors.push({ field: "height", message: "Enter a height greater than zero." })

  for (const opt of product.options) {
    const chosen = opt.choices.find(c => c.id === config[opt.id])
    if (opt.required && !chosen) {
      errors.push({ field: opt.id, message: `Choose a ${opt.label.toLowerCase()}.` })
      continue
    }
    if (chosen?.requiresText && !config[`${opt.id}Text`]?.trim()) {
      errors.push({ field: opt.id, message: `Enter a ${chosen.textLabel?.toLowerCase() || "value"}.` })
    }
  }

  // The resolution's evidence status and reasons stay INTERNAL — the
  // customer sees a clean specification and the sales team explains
  // sourcing and evidence with a human touch. Nothing here surfaces
  // them as warnings.
  const resolution = resolveProduct(product, config)

  // Enquiry details. Whether they are compulsory is a single switch —
  // see REQUIRE_ENQUIRY_DETAILS above. Format is always checked once
  // something has been typed, required or not, so a mistyped address is
  // caught either way.
  const pd = projectData ?? {}

  if (REQUIRE_ENQUIRY_DETAILS && !pd.businessName?.trim()) {
    errors.push({ field: "businessName", message: "Enter your business name." })
  }
  if (REQUIRE_ENQUIRY_DETAILS && !pd.email?.trim()) {
    errors.push({ field: "email", message: "Enter an email address." })
  } else if (pd.email?.trim() && !isEmail(pd.email)) {
    errors.push({ field: "email", message: "That email address does not look right." })
  }
  if (REQUIRE_ENQUIRY_DETAILS && !pd.phone?.trim()) {
    errors.push({ field: "phone", message: "Enter a phone number." })
  } else if (pd.phone?.trim() && !isPhone(pd.phone)) {
    errors.push({ field: "phone", message: "That phone number does not look right." })
  }

  return { errors, warnings, isValid: errors.length === 0, resolution }
}

/** Deliberately permissive — enough to catch a typo, not to police format. */
export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
}

/** Accepts international and spaced formats; just wants enough digits. */
export function isPhone(value) {
  return value.replace(/\D/g, "").length >= 7
}

/**
 * Indicative clear opening implied by the structural opening, from the
 * category-level deduction. A matched resolution carries the matched
 * product's own figures instead — this is the fallback for display
 * before a match exists.
 */
export function getClearOpening(product, config) {
  const co = product?.clearOpening
  if (!co) return null
  const w = num(config.width)
  const h = num(config.height)
  if (w == null || h == null) return null
  const width = w - co.widthDeduction
  const height = h - co.heightDeduction
  if (width <= 0 || height <= 0) return null
  return { width, height }
}

/**
 * Flatten the configuration into labelled rows for review and PDF.
 * When a resolution is passed, its matched clear opening and leaf size
 * are used — those come from the matched doorset's own frame figures.
 */
export function specRows(product, config, resolution) {
  if (!product) return []
  const clear = resolution?.clear ?? getClearOpening(product, config)
  const leaves = config.leaves || 1
  const leaf = resolution?.leaf ?? (clear && { width: Math.round(clear.width / leaves), height: clear.height })
  const rows = [
    { label: "Number of leaves", value: String(leaves) },
    { label: "Structural opening", value: config.width && config.height ? `${config.width} × ${config.height} mm` : "—" },
    { label: "Clear opening", value: clear ? `${clear.width} × ${clear.height} mm` : "—" },
    { label: "Leaf size", value: leaf ? `${leaf.width} × ${leaf.height} mm` : "—" },
    { label: "Fire rating", value: config.fireRating },
  ]
  for (const opt of product.options) {
    const chosen = opt.choices.find(c => c.id === config[opt.id])
    if (!chosen) continue
    const text = chosen.requiresText ? config[`${opt.id}Text`]?.trim() : ""
    rows.push({ label: opt.label, value: text ? `${chosen.label} — ${text}` : chosen.label })
  }
  return rows
}
