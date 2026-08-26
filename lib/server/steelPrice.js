import PRICES from "./dfm-steel-prices.json";

// ─────────────────────────────────────────────────────────────────
// Steel doorset prices — SERVER ONLY
// ─────────────────────────────────────────────────────────────────
// This module and its data must never reach a browser. The figures are
// the manufacturer's own cost list; anything imported by a component
// ends up in the client bundle where anyone can read it, so the price
// is worked out here and only the answer is sent back. There is a test
// that fails if a component ever imports this file.
//
// The build follows the source configurator part for part: a base
// price from a size grid, the frame by the metre, hinges by how many
// per leaf, every fitted item from one flat list, and the surcharges
// for High Performance and smoke protection on top.
// ─────────────────────────────────────────────────────────────────

export const CURRENCY = PRICES.currency;

/** Excel's approximate MATCH: how many bands the value has passed. */
const bandIndex = (bands, value) => bands.filter(b => b != null && b <= value - 1).length;

/** The label the price list knows a frame by. */
const frameKey = frameId => String(frameId ?? "").replace(/-/g, " ");

const priceOf = label => (label == null ? 0 : PRICES.option[label] ?? 0);

/**
 * The doorset itself, from its size grid. A size inside the approved
 * range but outside the priced grid comes back null rather than zero —
 * the quote has to say "on application", not "free".
 */
function basePrice(type, width, height) {
  const grid = PRICES.base[type.code];
  if (!grid) return null;
  const row = bandIndex(grid.widthBands, width);
  const col = bandIndex(grid.heightBands, height);
  if (row >= grid.grid.length || col >= grid.heightBands.length) return null;
  return grid.grid[row]?.[col] ?? null;
}

/** The frame, charged by the metre of jamb and head. */
function framePrice(frameId, width, height, wallThickness) {
  const key = frameKey(frameId);
  const perimetre = (2 * height + width) / 1000;
  const byWall = PRICES.embracingByWall[key];
  if (byWall) {
    // The embracing frames are priced by how thick the wall is.
    const i = bandIndex(PRICES.wallBands, wallThickness);
    const rate = byWall[i];
    return rate == null ? null : rate * perimetre;
  }
  return priceOf(key) * perimetre;
}

/** Hinges are priced by how many go on each leaf, then per leaf. */
function hingePrice(hinge, count, leaves) {
  const rates = PRICES.hingeByCount[hinge];
  if (!rates) return 0;
  return (rates[String(count)] ?? 0) * leaves;
}

// What each priced item is called on the quote, in the order it reads.
const ITEMS = [
  ["lock", "Lock"],
  ["cylinder", "Cylinder"],
  ["handleActiveInside", "Handle — active leaf, inside"],
  ["handleActiveOutside", "Handle — active leaf, outside"],
  ["handlePassiveOutside", "Handle — passive leaf, outside"],
  ["flushBolt", "Flush bolt"],
  ["electricStrike", "Electric strike"],
  ["doorCloser", "Door closer"],
  ["glazing", "Glazing"],
  ["ventilationGrill", "Ventilation grill"],
  ["dropSeal", "Automatic drop-down seal"],
  ["dripCap", "Drip cap"],
  ["doorStopper", "Door stopper"],
  ["magnetContact", "Magnet contact"],
  ["threshold", "Threshold"],
];

/**
 * Price one configured doorset, broken down the way the estimator
 * needs to read it. `type` is the resolved doorset; `config` is what
 * the specification tool produced, plus a wall thickness for the frames
 * that are priced by it.
 *
 * Returns { total, lines, onApplication } — onApplication is true when
 * some part of the doorset has no published price, in which case total
 * covers only what could be priced.
 */
export function priceSteelDoor({ type, config = {} }) {
  const width = Number(config.width);
  const height = Number(config.height);
  const leaves = type.leaves;
  const lines = [];
  let onApplication = false;

  const add = (label, amount, detail) => {
    if (amount == null) { onApplication = true; lines.push({ label, detail, amount: null }); return; }
    if (amount) lines.push({ label, detail, amount: round(amount) });
  };

  add("Doorset", basePrice(type, width, height), `${width} × ${height} mm`);
  add("Frame", framePrice(config.frameId, width, height, Number(config.wallThickness) || 0),
      frameKey(config.frameId));
  add("Hinges", hingePrice(config.hinge, config.hingeCount, leaves),
      `${config.hinge} · ${config.hingeCount} per leaf`);

  for (const [id, label] of ITEMS) {
    const chosen = config[id];
    if (!chosen || NOTHING.test(chosen)) continue;
    // "Other" is priced by hand — the estimator types the figure in.
    if (chosen.toLowerCase() === "other") {
      const manual = Number(config[`${id}Price`]);
      add(label, Number.isFinite(manual) ? manual : null, config[`${id}Text`]?.trim() || "other");
      continue;
    }
    add(label, priceOf(chosen), chosen);
  }

  if (type.highPerformance) {
    const band = type.minutes > 0 ? "rated" : "unrated";
    const key = String(leaves);
    add("High Performance",
        (PRICES.surcharge.highPerformance[key] ?? 0)
        + (PRICES.surcharge.highPerformanceExtra[band][key] ?? 0));
    if (config.hpPanel === "YES") {
      add("Flush panel", PRICES.surcharge.hpPanelPerSquareMetre * width * height / 1e6,
          `${(width * height / 1e6).toFixed(2)} m²`);
    }
  }

  if (config.smokeProtection === "YES") {
    add("Smoke protection", PRICES.surcharge.smokeProtection[String(leaves)] ?? 0);
  }

  const total = lines.reduce((sum, l) => sum + (l.amount ?? 0), 0);
  return { total: round(total), lines, onApplication, currency: CURRENCY };
}

const NOTHING = /^(without|no|n\/a|-)$/i;
const round = n => Math.round(n * 100) / 100;
