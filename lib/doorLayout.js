// How the leaves of a riser doorset group into door sets.
//
// A multi-leaf riser is not a row of independently hung leaves — it is
// a row of PAIRS. Each pair is a double door: two leaves meeting at a
// centre mullion, pivoted at their outer edges, sharing one lock. The
// active leaf carries the handle; the passive leaf is held by bolts
// top and bottom (the 2-point lock the specification already notes).
//
// So six leaves read as three double doorsets, four as two, and so on.
//
// ODD counts: the report approves 1, 3 and 5 leaf sets, so one door
// set in the row is a single leaf. It is placed at the end furthest
// from the handing side, keeping the pair nearest the approach clear.
// ASSUMPTION — pending confirmation from the business; changing it is
// a change to this constant alone.
const SINGLE_AT_FAR_END = true;

/**
 * Group leaves into door sets and describe each leaf's hardware.
 *
 * @param {number} leaves   total leaves across the opening
 * @param {"left"|"right"} handing  viewed from the access side
 * @returns {{sets: {start: number, count: number}[],
 *            leaves: {index: number, set: number, pivotSide: "left"|"right",
 *                     isActive: boolean, isPassive: boolean}[],
 *            boundaries: number[]}}
 *          `boundaries` are the leaf indices where one door set ends
 *          and the next begins — where a mullion is drawn.
 */
export function leafLayout(leaves, handing = "left") {
  const total = Math.max(1, Math.floor(leaves) || 1);
  const rightHand = handing === "right";

  // Sizes of each door set across the opening, left to right.
  const pairs = Math.floor(total / 2);
  const sizes = Array.from({ length: pairs }, () => 2);
  if (total % 2 === 1) {
    // The single sits away from the handing side: right-hand sets put
    // it on the left, left-hand sets on the right.
    const atStart = SINGLE_AT_FAR_END ? rightHand : !rightHand;
    if (atStart) sizes.unshift(1); else sizes.push(1);
  }

  const sets = [];
  const leafInfo = [];
  let index = 0;

  sizes.forEach((count, set) => {
    sets.push({ start: index, count });
    for (let n = 0; n < count; n++) {
      // Within a pair the leaves pivot at the outer edges and meet in
      // the middle; a single leaf pivots on the handing side.
      const pivotSide = count === 1
        ? (rightHand ? "right" : "left")
        : (n === 0 ? "left" : "right");
      // Handing decides which leaf of the pair is the active one.
      const isActive = count === 1 || (rightHand ? n === count - 1 : n === 0);
      leafInfo.push({ index, set, pivotSide, isActive, isPassive: !isActive });
      index++;
    }
  });

  const boundaries = sets.slice(1).map(s => s.start);
  return { sets, leaves: leafInfo, boundaries };
}

/** How the door sets read in words — "3 no. double doorsets", etc. */
export function describeSets(leaves, handing = "left") {
  const { sets } = leafLayout(leaves, handing);
  const pairs = sets.filter(s => s.count === 2).length;
  const singles = sets.filter(s => s.count === 1).length;
  const parts = [];
  if (pairs) parts.push(`${pairs} × double`);
  if (singles) parts.push(`${singles} × single`);
  return parts.join(" + ");
}
