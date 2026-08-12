// ─────────────────────────────────────────────────────────────────
// Hardware specification — domain logic
// ─────────────────────────────────────────────────────────────────
// Resolves a set of user inputs to a product from the range, and
// validates them against the published limits. All thresholds and
// product codes come from the product JSON, so extending the range is
// a data change, not a code change.
// ─────────────────────────────────────────────────────────────────

import riserDoors from '../data/riser-doors.json'

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

const PRODUCTS = { "riser-doors": riserDoors }

export function getProduct(productTypeId) {
  return PRODUCTS[productTypeId] ?? null
}

/** Blank configuration for a product, with sensible starting values. */
export function buildInitialConfig(product) {
  if (!product) return {}
  const config = { leaves: 1, width: "", height: "", fireRating: product.fireRatings[0].id }
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

/**
 * Resolve the configuration to a product in the range.
 *
 * Returns one of:
 *   { status: "incomplete" }              — not enough entered yet
 *   { status: "matched",     band, product }
 *   { status: "no-band",     reason }     — within limits, outside every band
 *   { status: "over-limit",  reason }     — beyond what the range can do
 */
export function resolveProduct(product, config) {
  if (!product) return { status: "incomplete" }

  const w = num(config.width)
  const h = num(config.height)
  if (w == null || h == null) return { status: "incomplete" }

  const { width: wl, height: hl } = product.limits

  if (w > wl.absoluteMax || h > hl.absoluteMax) {
    return {
      status: "over-limit",
      reason: `Exceeds the maximum for this range (${wl.absoluteMax} × ${hl.absoluteMax} mm). Contact us to discuss a bespoke doorset.`,
    }
  }
  if (w < wl.min || h < hl.min) {
    return {
      status: "over-limit",
      reason: `Below the minimum for this range (${wl.min} × ${hl.min} mm).`,
    }
  }

  const band = product.sizeBands.find(b =>
    b.leaves === config.leaves &&
    b.fireRatings.includes(config.fireRating) &&
    w >= b.width.min && w <= b.width.max &&
    h >= b.height.min && h <= b.height.max,
  )

  if (band) return { status: "matched", band, product: band.product }

  // Within the overall envelope but no band covers it — usually the leaf
  // count or the fire rating rather than the size itself.
  const sameLeaves = product.sizeBands.filter(b => b.leaves === config.leaves && b.fireRatings.includes(config.fireRating))
  if (sameLeaves.length) {
    const b = sameLeaves[0]
    if (w < b.width.min || w > b.width.max) {
      return {
        status: "no-band",
        reason: `${config.leaves} ${config.leaves === 1 ? "leaf" : "leaves"} covers ${b.width.min}–${b.width.max} mm wide. Adjust the width or the leaf count.`,
      }
    }
    if (h > b.height.max) {
      return {
        status: "no-band",
        reason: `${config.fireRating} is limited to ${b.height.max} mm high. Reduce the height or the fire rating.`,
      }
    }
  }

  return { status: "no-band", reason: "No standard product covers this combination. Contact us to discuss." }
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
  const { width: wl, height: hl } = product.limits

  if (w == null) errors.push({ field: "width", message: "Enter a maximum width." })
  else if (w > wl.absoluteMax) errors.push({ field: "width", message: `Maximum width is ${wl.absoluteMax} mm.` })
  else if (w < wl.min) errors.push({ field: "width", message: `Minimum width is ${wl.min} mm.` })

  if (h == null) errors.push({ field: "height", message: "Enter a maximum height." })
  else if (h > hl.absoluteMax) errors.push({ field: "height", message: `Maximum height is ${hl.absoluteMax} mm.` })
  else if (h < hl.min) errors.push({ field: "height", message: `Minimum height is ${hl.min} mm.` })

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
  if (resolution.status === "over-limit" || resolution.status === "no-band") {
    errors.push({ field: "size", message: resolution.reason })
  }

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

  if (!pd.projectName?.trim()) {
    warnings.push({ field: "projectName", message: "No project name — the specification will be issued untitled." })
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

/** Flatten the configuration into labelled rows for review and PDF. */
export function specRows(product, config) {
  if (!product) return []
  const rows = [
    { label: "Number of leaves", value: String(config.leaves) },
    { label: "Maximum width", value: config.width ? `${config.width} mm` : "—" },
    { label: "Maximum height", value: config.height ? `${config.height} mm` : "—" },
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
