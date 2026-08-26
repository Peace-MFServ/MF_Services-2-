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

  const groups = hardwareGroupsFor(config, resolution);
  for (const g of groups) {
    if (!g.options.length) {
      errors.push({ field: g.id, message: `Choose a ${GROUP_BY_ID[g.needs]?.label.toLowerCase() ?? g.needs} first.` });
    } else if (!g.options.includes(config[g.id])) {
      errors.push({ field: g.id, message: `Choose ${article(g.label)}.` });
    } else if (hardwareNeedsText(config[g.id]) && !config[`${g.id}Text`]?.trim()) {
      errors.push({ field: g.id, message: `Describe the ${g.label.toLowerCase()} required.` });
    }
  }

  return { errors, isValid: errors.length === 0, resolution, hardware: groups };
}

/** How the doorset reads on the specification, customer-side. */
export function describeSteelDoor(type) {
  if (!type) return "";
  const leaves = type.leaves === 1 ? "Single leaf" : "Double leaf";
  const rating = type.minutes === 0 ? "not fire rated" : `${type.classification} to ${STEEL.standard}`;
  return `${leaves} steel doorset, ${rating}${type.highPerformance ? ", High Performance" : ""}`;
}

/**
 * The construction paragraphs that belong on this doorset's sheet —
 * the base description, plus whatever the answers add to it.
 */
export function constructionFor(type) {
  if (!type) return [];
  const c = STEEL.construction;
  const paras = [c.base];
  if (type.minutes > 0) paras.push(c.fireRated);
  if (type.highPerformance) paras.push(c.highPerformance);
  return paras.filter(Boolean);
}

/** The standards this doorset is specified against, in order. */
export function standardsFor(type, exposure) {
  if (!type) return [];
  return STEEL.standards.filter(s =>
    (s.appliesTo === "fire-rated" && type.minutes > 0)
    || (s.appliesTo === "external" && exposure === "EXT")
    || s.appliesTo == null
  ).map(({ code, description }) => ({ code, description }));
}

/**
 * The specification as labelled rows — what the review panel lists and
 * the PDF prints, in that one order so the two never drift apart. The
 * type code and certificate stay out of it; they live in `basis`.
 */
export function steelSpecRows(config = {}, resolution = resolveSteelDoor(config)) {
  const { type, frame, exposure, clear } = resolution;
  if (!type) return [];

  const w = Number(config.width);
  const h = Number(config.height);
  const hasSize = Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0;
  const leafWidth = clear ? Math.round(clear.width / type.leaves) : null;

  const rows = [
    // How many of this same doorset — a schedule is quantities of one.
    { label: "Quantity", value: String(config.quantity ?? "").trim() || "1" },
    { label: "Doorset", value: type.leaves === 1 ? "Single leaf" : "Double leaf" },
    { label: "Fire rating", value: type.minutes === 0 ? "Not fire rated" : `${type.classification} — ${type.minutes} minutes` },
    { label: "Performance", value: type.highPerformance ? "High Performance" : "Standard" },
    { label: "Exposure", value: EXPOSURES.find(e => e.id === exposure)?.label ?? "—" },
    { label: "Frame", value: frame?.label ?? "—" },
    { label: "Structural opening", value: hasSize ? `${w} × ${h} mm` : "—" },
    { label: "Clear opening", value: clear ? `${clear.width} × ${clear.height} mm` : "—" },
    { label: "Leaf size", value: clear ? `${leafWidth} × ${clear.height} mm` : "—" },
    { label: "Handing", value: config.handing === "right" ? "Right hand" : "Left hand" },
  ];

  // Hardware follows the doorset. Items left unfitted are dropped so
  // the sheet does not run to a page of "without" — except the ones a
  // specifier reads as a decision either way, which always print.
  const always = new Set(["hinge", "hingeCount", "lock", "cylinder", "doorCloser"]);
  for (const g of hardwareGroupsFor(config, resolution)) {
    const chosen = config[g.id];
    if (!chosen) continue;
    if (!always.has(g.id) && NOTHING.test(chosen)) continue;
    const text = hardwareNeedsText(chosen) ? config[`${g.id}Text`]?.trim() : "";
    rows.push({ label: g.label, value: text ? `Other — ${text}` : sentenceCase(chosen) });
  }

  // Colour is the manufacturer's own field: a RAL number, or nothing.
  const ral = config.ral?.trim();
  if (ral) rows.push({ label: "Finish", value: /^ral/i.test(ral) ? ral : `RAL ${ral}` });

  return rows;
}

/** Manufacturer labels arrive in mixed case; only the first letter is
 *  ours to change — the rest are their designations. */
function sentenceCase(v) {
  const s = String(v);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const article = label => `${/^[aeiou]/i.test(label) ? "an" : "a"} ${label.toLowerCase()}`;

// ─────────────────────────────────────────────────────────────────
// Hardware
// ─────────────────────────────────────────────────────────────────
// Ironmongery cascades off the doorset and off itself: the lock decides
// which cylinders and handles exist, the leaf count decides whether
// there is a passive leaf to fit at all, smoke protection forces the
// hinge and the drop seal. Every list below is the manufacturer's own,
// keyed the way their configurator keys it, so nothing is offered that
// cannot be built.
// ─────────────────────────────────────────────────────────────────

const H = STEEL.hardware;

/** Value that means "none of this item". */
const NOTHING = /^(without|no|n\/a|-)$/i;

export const HARDWARE_GROUPS = [
  { id: "smokeProtection", label: "Smoke protection", note: "A smoke sealed doorset takes three hinges per leaf." },
  { id: "hinge", label: "Hinges" },
  { id: "hingeCount", label: "Hinges per leaf" },
  { id: "lock", label: "Lock", note: "The lock decides which cylinders and handles are available." },
  { id: "cylinder", label: "Cylinder", needs: "lock" },
  { id: "handleActiveInside", label: "Handle — active leaf, inside", needs: "lock" },
  { id: "handleActiveOutside", label: "Handle — active leaf, outside", needs: "lock" },
  { id: "handlePassiveOutside", label: "Handle — passive leaf, outside", needs: "lock", onlyWhen: "pair" },
  { id: "flushBolt", label: "Flush bolt", needs: "lock", onlyWhen: "pair" },
  { id: "electricStrike", label: "Electric strike", needs: "lock" },
  { id: "doorCloser", label: "Door closer" },
  { id: "glazing", label: "Glazing", needs: "exposure" },
  { id: "ventilationGrill", label: "Ventilation grill", needs: "exposure" },
  { id: "dropSeal", label: "Automatic drop-down seal" },
  { id: "threshold", label: "Threshold" },
  { id: "dripCap", label: "Drip cap", onlyWhen: "external" },
  { id: "doorStopper", label: "Door stopper" },
  { id: "magnetContact", label: "Magnet contact" },
];

const GROUP_BY_ID = Object.fromEntries(HARDWARE_GROUPS.map(g => [g.id, g]));

/**
 * The same questions, but with the ones that cannot be answered yet
 * still on the page, greyed out and saying what they are waiting for.
 * The quick layout puts the whole specification on one screen, so the
 * form has to stand still as the answers come in rather than growing
 * under the customer. Questions that genuinely never apply — a passive
 * leaf on a single, a drip cap indoors — stay away.
 */
export function hardwareWithPlaceholders(config = {}, resolution = resolveSteelDoor(config)) {
  const live = new Map(hardwareGroupsFor(config, resolution).map(g => [g.id, g]));
  return HARDWARE_GROUPS
    .filter(g => live.has(g.id) || !g.onlyWhen)
    .map(g => live.get(g.id) ?? { ...g, options: [], blocked: waitingOn(g, config, resolution) });
}

/** What a question is still waiting for, in the customer's words. */
function waitingOn(group, config, resolution) {
  if (!resolution.type) return "Choose the doorset first";
  if (group.needs === "lock" && !config.lock) return "Choose a lock first";
  if (group.needs === "exposure" && !resolution.exposure) return "Choose where it goes first";
  return "Not available yet";
}

/** Which hinge range this doorset is built with. */
function hingeSetFor(type, smoke) {
  if (type.highPerformance) return "hp";
  if (type.minutes >= 120) return "ei120";
  return smoke === "YES" ? "smoke" : "standard";
}

/**
 * Every hardware question this doorset asks, in order, with the options
 * each one currently offers. A group whose parent answer is missing
 * comes back with no options and a `needs` id, so the interface can say
 * what to answer first rather than showing an empty list.
 */
export function hardwareGroupsFor(config = {}, resolution = resolveSteelDoor(config)) {
  const type = resolution.type;
  if (!type) return [];

  const { leaves, code, minutes } = type;
  const rated = minutes > 0;
  const smoke = config.smokeProtection === "YES" ? "YES" : "NO";
  const lock = config.lock;
  const exposure = resolution.exposure;
  const typeKey = code.slice(0, 5);          // "DS 00", "DS 12"
  const boltKey = code.slice(2, 5);          // " 00", " 30", " 12"

  const groups = [];
  const add = (id, options) => {
    const list = options ?? [];
    const meta = GROUP_BY_ID[id];
    // A group whose parent is unanswered still appears, so the order of
    // the questions never changes under the customer.
    if (!list.length && !(meta.needs === "lock" && !lock)) return;
    groups.push({
      ...meta,
      options: list.map(String),
      ...(list.length ? {} : { blocked: "Choose a lock first" }),
    });
  };

  add("smokeProtection", rated ? ["YES", "NO"] : ["NO"]);
  add("hinge", H.hingeSets[hingeSetFor(type, smoke)]);
  add("hingeCount", smoke === "YES" ? H.hingeCounts.smoke : H.hingeCounts.standard);
  add("lock", H.lock[code]);
  add("cylinder", H.cylinder[lock]);
  add("handleActiveInside", H.handleActiveInside[lock]);
  add("handleActiveOutside", H.handleActiveOutside[lock]);
  if (leaves === 2) {
    add("handlePassiveOutside", H.handlePassiveOutside[lock]);
    add("flushBolt", H.flushBolt[`${leaves}${lock}${boltKey}`]);
  }
  add("electricStrike", H.electricStrike[`${rated ? "E" : "B"}${leaves}${lock}`]);
  add("doorCloser", H.doorCloser[String(leaves)]);
  if (exposure) {
    add("glazing", H.glazing[`${exposure}${leaves}${typeKey}`]);
    add("ventilationGrill", H.ventilationGrill[`${exposure}${leaves}${typeKey}`]);
  }
  add("dropSeal", H.dropSeal[`${leaves}${smoke}`]);
  add("threshold", H.threshold[String(leaves)]);
  if (exposure === "EXT") add("dripCap", H.dripCap[`EXT${leaves}`]);
  add("doorStopper", H.doorStopper[String(leaves)]);
  add("magnetContact", H.magnetContact[String(leaves)]);

  return groups;
}

/** What a group starts on: nothing fitted where that is a choice. */
export function defaultHardware(options = []) {
  return options.find(o => NOTHING.test(o)) ?? options[0] ?? "";
}

/**
 * Bring a configuration back into line after an answer higher up
 * changed what is on offer. Returns only the keys that need to move,
 * so a caller can tell whether anything did.
 */
export function reconcileHardware(config = {}, groups = hardwareGroupsFor(config)) {
  const changes = {};
  const live = new Set(groups.map(g => g.id));

  for (const g of groups) {
    if (!g.options.length) continue;
    if (!g.options.includes(config[g.id])) changes[g.id] = defaultHardware(g.options);
  }
  // A question that no longer applies should not leave an answer behind.
  for (const g of HARDWARE_GROUPS) {
    if (!live.has(g.id) && config[g.id]) changes[g.id] = "";
  }
  return changes;
}

/**
 * Apply reconciliation until nothing more moves. One pass is not
 * enough: answering the lock is what makes the cylinder and handle
 * questions exist, so their defaults land on the pass after it.
 */
export function settleHardware(config = {}) {
  let next = config;
  for (let pass = 0; pass < 4; pass++) {
    const changes = reconcileHardware(next);
    if (!Object.keys(changes).length) return next;
    next = { ...next, ...changes };
  }
  return next;
}

/** "other" means the customer describes it — the sheet needs the words. */
export function hardwareNeedsText(value) {
  return typeof value === "string" && value.trim().toLowerCase() === "other";
}
