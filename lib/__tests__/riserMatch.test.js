// The approved-size math behind the specification. These pin the
// Kiwa report's leaf envelopes (PAR/21319/01 Rev E) and the
// measurements-decide-the-leaves rule — a data edit that shifts what
// the tool calls approved fails here before a customer sees it.

import { describe, it, expect } from "vitest"
import {
  CHRISTO,
  leafFitsEnvelope,
  leafCountApproved,
  allowedLeafCounts,
  clearOpeningFor,
  matchChristo,
} from "../riserMatch"

describe("corner envelope geometry", () => {
  const single = CHRISTO.envelopes["1"][0]  // [[931,2700],[1026,2492]]

  it("full height holds up to the first corner", () => {
    expect(leafFitsEnvelope(931, 2700, single)).toBe(true)
    expect(leafFitsEnvelope(700, 2700, single)).toBe(true)
  })
  it("max width holds at the second corner height", () => {
    expect(leafFitsEnvelope(1026, 2492, single)).toBe(true)
    expect(leafFitsEnvelope(1027, 1500, single)).toBe(false)
  })
  it("the slope between corners interpolates", () => {
    // At 1000 wide the ceiling is ≈2549 mm.
    expect(leafFitsEnvelope(1000, 2540, single)).toBe(true)
    expect(leafFitsEnvelope(1000, 2560, single)).toBe(false)
  })
  it("full height past the first corner is rejected", () => {
    expect(leafFitsEnvelope(1000, 2700, single)).toBe(false)
  })
})

describe("leaf counts from measurements", () => {
  it("a standard opening approves one to three leaves", () => {
    // 1100×2300 structural → clear 899×2225. 4 leaves would need a
    // 225 mm leaf — under the 250 mm stability minimum.
    expect(allowedLeafCounts(1100, 2300)).toEqual([1, 2, 3])
  })

  it("a wide opening is only approved at high leaf counts", () => {
    // 4000×2600 structural → clear 3799×2525 → 6 × 633 mm leaves.
    expect(allowedLeafCounts(4000, 2600)).toEqual([6])
  })

  it("the double-leaf extension evidence widens what two leaves cover", () => {
    // Leaf 1000×2250 fails the primary double envelope (856 cap) but
    // sits inside the extension corner (1024 @ 2280).
    expect(leafCountApproved(2, 1000, 2250)).toBe(true)
    expect(leafCountApproved(2, 1000, 2450)).toBe(false)
  })

  it("nothing is approved past every envelope", () => {
    expect(allowedLeafCounts(1400, 2950)).toEqual([])
  })

  it("clear opening applies the frame deductions", () => {
    expect(clearOpeningFor(1100, 2300)).toEqual({ width: 899, height: 2225 })
  })
})

describe("full requirement match", () => {
  it("approved inside the envelopes, citing the report internally", () => {
    const res = matchChristo({ structuralWidth: 1100, structuralHeight: 2300, leaves: 1, wall: "masonry" })
    expect(res.status).toBe("approved")
    expect(res.wallConflict).toBe(false)
    expect(res.basis).toContain("PAR/21319/01")
  })

  it("masonry conflicts past two leaves", () => {
    const res = matchChristo({ structuralWidth: 2300, structuralHeight: 2300, leaves: 3, wall: "masonry" })
    expect(res.wallConflict).toBe(true)
  })

  it("outside every envelope is a bespoke enquiry", () => {
    const res = matchChristo({ structuralWidth: 1400, structuralHeight: 2950, leaves: 1, wall: null })
    expect(res.status).toBe("over-limit")
    expect(res.allowedLeaves).toEqual([])
  })
})
