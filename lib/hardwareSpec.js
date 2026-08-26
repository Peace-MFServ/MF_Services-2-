// ─────────────────────────────────────────────────────────────────
// Hardware specification — domain logic
// ─────────────────────────────────────────────────────────────────
// Turns a set of user inputs into a doorset specification, judged
// against the Christo riser door's approved sizes (lib/riserMatch.js,
// from the Kiwa Field of Application report). The customer enters the
// opening first; the leaf counts on offer are the ones the report
// approves for that opening. Anything outside every envelope is not
// refused — it is marked as a bespoke enquiry, because the business
// sources to requirement rather than selling a fixed catalogue.
// ─────────────────────────────────────────────────────────────────

import riserDoors from "../data/riser-doors.json"
import { CHRISTO, matchChristo } from "./riserMatch"

export { CHRISTO }

// ─────────────────────────────────────────────────────────────────
// Enquiry capture
// ─────────────────────────────────────────────────────────────────
// Business name, email and phone are the point of the tool from the
// sales side — a downloaded specification is a lead. Flip this to true
// to make them compulsory before a specification can be downloaded.
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
    summary: "Fire rated and unrated steel doorsets, internal and external.",
    available: true,
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

const PRODUCTS = { "riser-doors": riserDoors }

export function getProduct(productTypeId) {
  return PRODUCTS[productTypeId] ?? null
}

/** Outside anything the approval covers. */
export function isBespoke(resolution) {
  return resolution?.status === "over-limit"
}

/** Kept for API compatibility; the Christo model has no "stated" tier. */
export function needsEvidence(resolution) {
  return resolution?.status === "stated"
}

/** Blank configuration for a product, with sensible starting values. */
export function buildInitialConfig(product) {
  if (!product) return {}
  const config = {
    quantity: "1",
    leaves: 1, width: "", height: "",
    fireRating: product.defaultFireRating ?? product.fireRatings[0].id,
    // Wall and lock are chosen on their own visual steps — no default,
    // the customer has to pick. Frame defaults to the flush look.
    wallType: "",
    frameStyle: CHRISTO.frames.find(f => f.default)?.id ?? "flush",
    lockType: "",
  }
  for (const opt of product.options) {
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

/**
 * Judge the configured doorset against the approved envelopes.
 *
 * Returns one of:
 *   { status: "incomplete" }                  — no dimensions yet
 *   { status: "evidenced",  leaves, ... }     — inside the Kiwa approval
 *   { status: "over-limit", leaves, ... }     — bespoke enquiry
 *
 * Every resolution carries allowedLeaves — the counts the report
 * approves for this opening — which is what the leaf selector offers.
 * The basis text stays INTERNAL: the customer sees a clean sheet and
 * the sales team explains sourcing and evidence in person.
 */
export function resolveProduct(product, config) {
  if (!product) return { status: "incomplete" }

  const w = num(config.width)
  const h = num(config.height)
  if (w == null || h == null || w <= 0 || h <= 0) return { status: "incomplete" }

  const maxLeaves = product.statedLimits.maxLeaves ?? CHRISTO.maxLeaves
  const leaves = Math.max(1, Math.min(maxLeaves, num(config.leaves) ?? 1))

  const match = matchChristo({
    structuralWidth: w,
    structuralHeight: h,
    leaves,
    wall: config.wallType || null,
  })

  return {
    status: match.status === "approved" ? "evidenced" : "over-limit",
    leaves,
    clear: match.clear,
    leaf: match.leaf,
    allowedLeaves: match.allowedLeaves,
    wallConflict: match.wallConflict,
    match,
  }
}

/**
 * Validate the whole configuration. Errors block the specification.
 * Wall and lock have their own steps, so their errors gate those steps
 * (and the final download) rather than the Specify page.
 */
export function validateSpec(product, config, projectData) {
  const errors = []
  const warnings = []
  if (!product) return { errors, warnings, isValid: false }

  const w = num(config.width)
  const h = num(config.height)

  // The stated limits come from the largest approved envelopes in the
  // Kiwa report — anything outside them cannot be built, so it is a
  // blocking error, not a bespoke enquiry.
  const wLim = product.statedLimits?.width
  const hLim = product.statedLimits?.height

  if (w == null) errors.push({ field: "width", message: "Enter a maximum width." })
  else if (w <= 0) errors.push({ field: "width", message: "Enter a width greater than zero." })
  else if (wLim && (w < wLim.min || w > wLim.absoluteMax)) {
    errors.push({ field: "width", message: `Width must be between ${wLim.min} and ${wLim.absoluteMax} mm.` })
  }

  if (h == null) errors.push({ field: "height", message: "Enter a maximum height." })
  else if (h <= 0) errors.push({ field: "height", message: "Enter a height greater than zero." })
  else if (hLim && (h < hLim.min || h > hLim.absoluteMax)) {
    errors.push({ field: "height", message: `Height must be between ${hLim.min} and ${hLim.absoluteMax} mm.` })
  }

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

  const resolution = resolveProduct(product, config)

  if (!config.wallType) {
    errors.push({ field: "wallType", message: "Choose a wall construction." })
  } else if (resolution.wallConflict) {
    errors.push({ field: "wallType", message: "Masonry is approved for single and double leaf sets only — choose another wall construction or fewer leaves." })
  }
  if (!config.lockType) {
    errors.push({ field: "lockType", message: "Choose a lock." })
  }

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

/** Clear opening implied by the structural opening. */
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

/** Flatten the configuration into labelled rows for review and PDF. */
export function specRows(product, config, resolution) {
  if (!product) return []
  const clear = resolution?.clear ?? getClearOpening(product, config)
  const leaves = config.leaves || 1
  const leaf = resolution?.leaf ?? (clear && { width: Math.round(clear.width / leaves), height: clear.height })

  const wall = CHRISTO.walls.find(w => w.id === config.wallType)
  const frame = CHRISTO.frames.find(f => f.id === config.frameStyle) ?? CHRISTO.frames.find(f => f.default)
  const lock = CHRISTO.locks.find(l => l.id === config.lockType)

  const rows = [
    // How many of this same doorset — a schedule is quantities of one.
    { label: "Quantity", value: String(config.quantity).trim() || "1" },
    { label: "Number of leaves", value: String(leaves) },
    { label: "Structural opening", value: config.width && config.height ? `${config.width} × ${config.height} mm` : "—" },
    { label: "Clear opening", value: clear ? `${clear.width} × ${clear.height} mm` : "—" },
    { label: "Leaf size", value: leaf ? `${leaf.width} × ${leaf.height} mm` : "—" },
    { label: "Fire rating", value: config.fireRating },
  ]

  // Handing first, then the physical build (wall, frame, lock), then
  // the remaining requirement options.
  const byOption = id => {
    const opt = product.options.find(o => o.id === id)
    const chosen = opt?.choices.find(c => c.id === config[id])
    if (!chosen) return null
    const text = chosen.requiresText ? config[`${id}Text`]?.trim() : ""
    return { label: opt.label, value: text ? `${chosen.label} — ${text}` : chosen.label }
  }

  const handing = byOption("handing")
  if (handing) rows.push(handing)
  if (wall) rows.push({ label: "Wall construction", value: wall.label })
  rows.push({ label: "Frame", value: frame?.label ?? "Flush (standard)" })
  if (lock) {
    rows.push({
      label: "Lock and key",
      value: leaves > 1 ? `${lock.label} · 2-point lock to passive leaves` : lock.label,
    })
  }
  for (const id of ["acoustic", "doorRestrictor", "finish"]) {
    const row = byOption(id)
    if (row) rows.push(row)
  }
  return rows
}
