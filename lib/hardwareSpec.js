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
    width: "", height: "",
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

/**
 * Fewest leaves that bring one leaf inside the evidenced envelope.
 *
 * Splitting an opening across more leaves makes each leaf narrower but
 * leaves its height alone, so width and area both improve with leaf
 * count and height does not. That makes the answer a closed form rather
 * than a search, and it makes height the one constraint no leaf count
 * can fix.
 *
 * A count always comes back, even when the envelope cannot be met — a
 * 2600 mm opening still takes the leaves it takes, and the caller says
 * separately whether a report backs that up. Falling back to the
 * maximum leaf count instead would quietly overstate the answer.
 */
function leafCountFor(clearW, clearH, env, maxLeaves) {
  const byWidth = Math.ceil(clearW / env.maxLeafWidth)
  const byArea  = Math.ceil((clearW * clearH) / env.maxLeafArea)
  const wanted = Math.max(1, byWidth, byArea)
  return {
    leaves: Math.min(wanted, maxLeaves),
    withinEvidence: wanted <= maxLeaves && clearH <= env.maxLeafHeight,
  }
}

/**
 * Work out what the entered opening actually needs, and how well it is
 * backed up.
 *
 * Leaf count is an output here, not an input. The person specifying a
 * riser knows the hole in the wall; how many leaves it takes to close it
 * is our problem, and it falls straight out of the test evidence.
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

  // Work out the doorset first and judge it second. The leaf count is
  // geometry — it holds whether or not a report backs the size up, and
  // the elevation needs it either way.
  const derived = env && clear
    ? leafCountFor(clear.width, clear.height, env, maxLeaves)
    : { leaves: 1, withinEvidence: false }
  const leaves = derived.leaves
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

  if (derived.withinEvidence) {
    return {
      ...base,
      status: "evidenced",
      basis: `${leaves} ${leaves === 1 ? "leaf" : "leaves"} at ${leaf.width} × ${leaf.height} mm, inside the ${mm2(env.maxLeafWidth)} × ${mm2(env.maxLeafHeight)} mm / ${m2(env.maxLeafArea)} m² leaf permitted by ${env.standard} from a ${env.specimen.leafWidth} × ${env.specimen.leafHeight} mm tested leaf.`,
    }
  }

  // Buildable per the literature, but nothing on file covers a leaf this
  // size. Height is the usual culprit — no number of leaves shortens a
  // leaf, so only the supplier's report can close that gap.
  const reason = clear.height > env.maxLeafHeight
    ? `A ${leaf.height} mm leaf is taller than the ${mm2(env.maxLeafHeight)} mm our test evidence covers, and adding leaves does not shorten a leaf. The supplier states it manufactures this size — we will obtain the test report covering it before order.`
    : `This opening needs a leaf larger than the ${mm2(env.maxLeafWidth)} × ${mm2(env.maxLeafHeight)} mm / ${m2(env.maxLeafArea)} m² our test evidence covers, even at ${maxLeaves} leaves. The supplier states it manufactures this size — we will obtain the test report covering it before order.`

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

/**
 * Flatten the configuration into labelled rows for review and PDF.
 *
 * Leaf count comes from the resolution rather than the configuration —
 * it is worked out from the opening, not chosen.
 */
export function specRows(product, config, resolution) {
  if (!product) return []
  const clear = getClearOpening(product, config)
  const leaves = resolution?.leaves
  const rows = [
    { label: "Structural opening", value: config.width && config.height ? `${config.width} × ${config.height} mm` : "—" },
    { label: "Clear opening", value: clear ? `${clear.width} × ${clear.height} mm` : "—" },
    { label: "Number of leaves", value: leaves ? String(leaves) : "—" },
    { label: "Leaf size", value: leaves && clear ? `${Math.round(clear.width / leaves)} × ${clear.height} mm` : "—" },
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
