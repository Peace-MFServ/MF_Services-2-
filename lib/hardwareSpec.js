// ─────────────────────────────────────────────────────────────────
// Hardware specification — domain logic
// ─────────────────────────────────────────────────────────────────
// Turns a set of user inputs into a doorset specification and checks
// it against what is supplied as standard. Anything outside that is
// not refused — it is marked as a bespoke enquiry, because the
// business sources to requirement rather than selling a fixed
// catalogue. Every threshold lives in the product JSON, so extending
// what is offered is a data change, not a code change.
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

/**
 * The largest leaf a test report actually supports.
 *
 * EN 1634-1 Annex B lets a tested specimen stand for a range of sizes
 * around it — Category B allows +15% on width, +15% on height and +20%
 * on area, all applying at once. Three caps, not one: a leaf can sit
 * inside both linear caps and still bust the area cap.
 */
export function evidencedEnvelope(product) {
  const ev = product?.testEvidence
  if (!ev) return null
  const { leafWidth, leafHeight } = ev.specimen
  const foa = ev.fieldOfApplication
  return {
    maxLeafWidth:  leafWidth  * (1 + foa.widthIncrease),
    maxLeafHeight: leafHeight * (1 + foa.heightIncrease),
    maxLeafArea:   leafWidth * leafHeight * (1 + foa.areaIncrease),
    specimen: ev.specimen,
    standard: foa.standard,
  }
}

/** All three Annex B caps have to hold at once, not just the linear two. */
function leafFitsEnvelope(leafW, leafH, env) {
  return leafW <= env.maxLeafWidth
    && leafH <= env.maxLeafHeight
    && leafW * leafH <= env.maxLeafArea
}

/**
 * Fewest leaves that would bring one leaf inside the evidenced envelope,
 * or null when no leaf count manages it.
 *
 * Only used to make a better suggestion when the chosen count does not
 * fit — the count itself stays the user's call. Splitting an opening
 * across more leaves narrows each leaf without shortening it, so width
 * and area improve with leaf count and height never does. That makes
 * this a closed form rather than a search, and it makes height the one
 * constraint no leaf count can fix.
 */
function smallestLeafCount(clearW, clearH, env, maxLeaves) {
  if (clearH > env.maxLeafHeight) return null
  const byWidth = Math.ceil(clearW / env.maxLeafWidth)
  const byArea  = Math.ceil((clearW * clearH) / env.maxLeafArea)
  const n = Math.max(1, byWidth, byArea)
  return n <= maxLeaves ? n : null
}

/**
 * Judge the configured doorset against the evidence we hold.
 *
 * The leaf count is the user's choice. What the tool does is work out
 * the leaf that choice implies and say whether a test report actually
 * covers it — and, when it does not, what leaf count would.
 *
 * Returns one of:
 *   { status: "incomplete" }               — no dimensions yet
 *   { status: "evidenced",  leaves, ... }  — a report on file covers it
 *   { status: "stated",     leaves, ... }  — supplier says yes, no report sighted
 *   { status: "over-limit", reason }       — past anything a supplier offers
 */
export function resolveProduct(product, config) {
  if (!product) return { status: "incomplete" }

  const w = num(config.width)
  const h = num(config.height)
  if (w == null || h == null || w <= 0 || h <= 0) return { status: "incomplete" }

  const limits = product.statedLimits
  const maxLeaves = limits.maxLeaves ?? 6
  const clear = getClearOpening(product, config)
  const env = evidencedEnvelope(product)

  const leaves = Math.max(1, Math.min(maxLeaves, num(config.leaves) ?? 1))
  const leaf = clear && {
    width: mm2(clear.width / leaves),
    height: mm2(clear.height),
    area: (clear.width / leaves) * clear.height,
  }
  const base = { leaves, clear, leaf, env }

  if (w > limits.width.absoluteMax || h > limits.height.absoluteMax) {
    return {
      ...base,
      status: "over-limit",
      reason: `${w} × ${h} mm is larger than any of our suppliers offers as standard (${limits.width.absoluteMax} × ${limits.height.absoluteMax} mm). We can still quote — the specification will be marked as a bespoke enquiry.`,
    }
  }
  if (w < limits.width.min || h < limits.height.min) {
    return {
      ...base,
      status: "over-limit",
      reason: `${w} × ${h} mm is smaller than any of our suppliers offers as standard (${limits.width.min} × ${limits.height.min} mm). We can still quote — the specification will be marked as a bespoke enquiry.`,
    }
  }

  // No report on file at all — everything rests on what the supplier
  // claims, and the sheet says so rather than implying otherwise.
  if (!env || !clear) {
    return {
      ...base,
      status: "stated",
      reason: "No test report on file for this product. The size is within what the supplier states it manufactures; we will confirm the certification before order.",
    }
  }

  if (leafFitsEnvelope(leaf.width, leaf.height, env)) {
    return {
      ...base,
      status: "evidenced",
      basis: `${leaves} ${leaves === 1 ? "leaf" : "leaves"} at ${leaf.width} × ${leaf.height} mm, inside the ${mm2(env.maxLeafWidth)} × ${mm2(env.maxLeafHeight)} mm / ${m2(env.maxLeafArea)} m² leaf permitted by ${env.standard} from a ${env.specimen.leafWidth} × ${env.specimen.leafHeight} mm tested leaf.`,
    }
  }

  // Buildable per the literature, but nothing on file covers a leaf this
  // size. Where more leaves would fix it, say so and let the user decide
  // — height is the case where they cannot, because no number of leaves
  // shortens a leaf and only the supplier's report closes that gap.
  const suggested = smallestLeafCount(clear.width, clear.height, env, maxLeaves)
  const confirm = "The supplier states it manufactures this size — we will obtain the test report covering it before order."
  const cap = `the ${mm2(env.maxLeafWidth)} × ${mm2(env.maxLeafHeight)} mm / ${m2(env.maxLeafArea)} m² leaf our test evidence covers`

  let reason
  if (clear.height > env.maxLeafHeight) {
    reason = `A ${leaf.height} mm leaf is taller than the ${mm2(env.maxLeafHeight)} mm our test evidence covers, and adding leaves does not shorten a leaf. ${confirm}`
  } else if (suggested != null && suggested > leaves) {
    reason = `At ${leaves} ${leaves === 1 ? "leaf" : "leaves"} each leaf is ${leaf.width} × ${leaf.height} mm, larger than ${cap}. ${suggested} ${suggested === 1 ? "leaf" : "leaves"} would bring it inside. ${confirm}`
  } else {
    reason = `This opening needs a leaf larger than ${cap}, even at ${maxLeaves} leaves. ${confirm}`
  }

  return { ...base, status: "stated", suggestedLeaves: suggested, reason }
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

  const resolution = resolveProduct(product, config)
  if (resolution.reason) {
    // Not a blocker. "Tell us what you need and we will source it" means
    // an unusual opening is a conversation, not a rejection — the sheet
    // still issues, saying plainly what is and is not backed by a report.
    warnings.push({ field: "size", message: resolution.reason })
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

/**
 * Clear opening implied by the structural opening. This is the number
 * the architect actually needs — the frame eats a fixed amount off
 * each dimension — so the tool works it out rather than leaving them to.
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

/** Flatten the configuration into labelled rows for review and PDF. */
export function specRows(product, config) {
  if (!product) return []
  const clear = getClearOpening(product, config)
  const leaves = config.leaves || 1
  const rows = [
    { label: "Number of leaves", value: String(leaves) },
    { label: "Structural opening", value: config.width && config.height ? `${config.width} × ${config.height} mm` : "—" },
    { label: "Clear opening", value: clear ? `${clear.width} × ${clear.height} mm` : "—" },
    { label: "Leaf size", value: clear ? `${Math.round(clear.width / leaves)} × ${clear.height} mm` : "—" },
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
