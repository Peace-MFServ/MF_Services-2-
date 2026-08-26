import STEEL from "../data/dfm-steel-door.json";

// ─────────────────────────────────────────────────────────────────
// Steel doorsets
// ─────────────────────────────────────────────────────────────────
// The customer answers questions they understand — is it fire rated,
// for how long, single or double, standard or High Performance — and
// the manufacturer's type code is derived from the answers. The code
// itself never reaches the screen; it exists to look up the approved
// sizes, which is the whole point of the exercise.
//
// What is approved depends on the type, the frame and whether the door
// is internal or external, so those come before the dimensions. Enter
// a size outside the approved range and the tool says so rather than
// letting it through to a specification.
// ─────────────────────────────────────────────────────────────────

export { STEEL };

export const EXPOSURES = [
  { id: "INT", label: "Internal" },
  { id: "EXT", label: "External" },
];

/** Every fire rating in the range, shortest first, 0 being unrated. */
export function fireRatings() {
  return [...new Set(STEEL.types.map(t => t.minutes))].sort((a, b) => a - b);
}

/** The one type matching a set of answers, or null if none exists. */
export function findType({ minutes, leaves, highPerformance = false }) {
  return STEEL.types.find(t =>
    t.minutes === Number(minutes)
    && t.leaves === Number(leaves)
    && t.highPerformance === !!highPerformance
  ) ?? null;
}

/** Leaf counts that exist at this rating and performance level. */
export function leafCountsFor({ minutes, highPerformance = false }) {
  return STEEL.types
    .filter(t => t.minutes === Number(minutes) && t.highPerformance === !!highPerformance)
    .map(t => t.leaves)
    .sort((a, b) => a - b);
}

/** Whether High Performance is made at this rating and leaf count. */
export function highPerformanceAvailable({ minutes, leaves }) {
  return STEEL.types.some(t =>
    t.minutes === Number(minutes) && t.leaves === Number(leaves) && t.highPerformance
  );
}

export function frameById(id) {
  return STEEL.frames.find(f => f.id === id) ?? null;
}

/** The frames this type is made with, in the manufacturer's order. */
export function framesFor(type) {
  if (!type) return [];
  return type.frames.map(frameById).filter(Boolean);
}

/** Internal, external, or both — whichever the approvals cover. */
export function exposuresFor(type) {
  if (!type) return [];
  return EXPOSURES.filter(e => type.exposures.includes(e.id));
}

/** The approved size range for a type, frame and exposure together. */
export function limitsFor(type, frameId, exposure) {
  const frame = frameById(frameId);
  if (!type || !frame || !exposure) return null;
  return STEEL.limits[`${type.code}${frame.limitKey}${exposure}`] ?? null;
}

/**
 * Clear opening — the structural opening less the frame's own take.
 * The deduction depends on the frame family (corner, embracing or
 * block), which is why each frame carries its class.
 */
export function clearOpeningFor(type, frameId, width, height) {
  const frame = frameById(frameId);
  const w = Number(width);
  const h = Number(height);
  if (!type || !frame || !Number.isFinite(w) || !Number.isFinite(h)) return null;
  const dw = type.deductions.width[frame.class];
  const dh = type.deductions.height[frame.class];
  if (dw == null || dh == null) return null;
  const clearW = w - dw;
  const clearH = h - dh;
  return clearW > 0 && clearH > 0 ? { width: clearW, height: clearH } : null;
}

/**
 * Resolve a configuration into everything downstream needs: the type
 * it maps to, what is approved, and where the entered size sits
 * against it.
 */
export function resolveSteelDoor(config = {}) {
  const type = findType(config);
  if (!type) {
    return { status: "no-such-type", type: null, frames: [], exposures: [] };
  }

  const frames = framesFor(type);
  const exposures = exposuresFor(type);
  const frame = frameById(config.frameId);
  const exposure = exposures.some(e => e.id === config.exposure) ? config.exposure : null;
  const limits = limitsFor(type, config.frameId, exposure);

  const w = Number(config.width);
  const h = Number(config.height);
  const hasSize = Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0;

  let sizeStatus = "incomplete";
  if (limits && hasSize) {
    const widthOk = w >= limits.minWidth && w <= limits.maxWidth;
    const heightOk = h >= limits.minHeight && h <= limits.maxHeight;
    sizeStatus = widthOk && heightOk ? "approved" : "outside-limits";
  }

  return {
    status: sizeStatus,
    type,
    frame,
    exposure,
    frames,
    exposures,
    limits,
    clear: clearOpeningFor(type, config.frameId, w, h),
    // Internal only — the code and certificate are for our paperwork,
    // never for the customer's sheet.
    basis: { code: type.code, certificate: type.certificate },
  };
}

/** Everything still outstanding, in the order it should be answered. */
export function validateSteelDoor(config = {}) {
  const errors = [];
  const resolution = resolveSteelDoor(config);

  if (config.minutes == null || config.minutes === "") {
    errors.push({ field: "minutes", message: "Choose whether the door is fire rated." });
  }
  if (!config.leaves) {
    errors.push({ field: "leaves", message: "Choose single or double." });
  }
  if (!resolution.type && config.minutes != null && config.leaves) {
    errors.push({ field: "leaves", message: "That combination is not made — try another leaf count or performance level." });
  }
  if (resolution.type && !resolution.exposure) {
    errors.push({ field: "exposure", message: "Choose internal or external." });
  }
  if (resolution.type && !resolution.frame) {
    errors.push({ field: "frameId", message: "Choose a frame." });
  }

  const limits = resolution.limits;
  const w = Number(config.width);
  const h = Number(config.height);

  if (!config.width) errors.push({ field: "width", message: "Enter a structural width." });
  else if (limits && (w < limits.minWidth || w > limits.maxWidth)) {
    errors.push({ field: "width", message: `Width must be between ${limits.minWidth} and ${limits.maxWidth} mm for this doorset.` });
  }

  if (!config.height) errors.push({ field: "height", message: "Enter a structural height." });
  else if (limits && (h < limits.minHeight || h > limits.maxHeight)) {
    errors.push({ field: "height", message: `Height must be between ${limits.minHeight} and ${limits.maxHeight} mm for this doorset.` });
  }

  return { errors, isValid: errors.length === 0, resolution };
}

/** How the doorset reads on the specification, customer-side. */
export function describeSteelDoor(type) {
  if (!type) return "";
  const leaves = type.leaves === 1 ? "Single leaf" : "Double leaf";
  const rating = type.minutes === 0 ? "not fire rated" : `${type.classification} to ${STEEL.standard}`;
  return `${leaves} steel doorset, ${rating}${type.highPerformance ? ", High Performance" : ""}`;
}
