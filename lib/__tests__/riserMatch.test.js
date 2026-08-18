// The evidence math behind the specification sheet. These pin the
// EN 1634-1 Annex B rules and the direction logic to the two held
// test reports — if a data edit or refactor shifts what the tool
// calls "evidenced", these fail before a customer sees it.

import { describe, it, expect } from "vitest"
import {
  ratingSupported,
  specimenEnvelope,
  leafFitsEnvelope,
  matchRequirement,
  smallestEvidencedLeafCount,
  REPORTS,
} from "../riserMatch"

const FOA_B = { widthIncrease: 0.15, heightIncrease: 0.15, areaIncrease: 0.2 }
const SPECIMEN = { leafWidth: 992, leafHeight: 2167, integrityMinutes: 132 }

describe("Annex B overrun rule", () => {
  it("132 minutes carries Category B allowances for a 120-minute door", () => {
    expect(ratingSupported(132, 120)).toBe(true)
  })
  it("118 minutes does NOT carry a 120-minute door", () => {
    expect(ratingSupported(118, 120)).toBe(false)
  })
  it("118 minutes carries a 90-minute door", () => {
    expect(ratingSupported(118, 90)).toBe(true)
  })
})

describe("Annex B envelope from the tested specimen", () => {
  it("reproduces the size-variation table printed in the reports", () => {
    const env = specimenEnvelope(SPECIMEN, FOA_B)
    expect(env.maxLeafWidth).toBeCloseTo(1140.8, 1)
    expect(env.maxLeafHeight).toBeCloseTo(2492.05, 1)
    expect(env.maxLeafArea / 1e6).toBeCloseTo(2.579, 2)
  })

  it("the area cap binds before the linear caps do", () => {
    const env = specimenEnvelope(SPECIMEN, FOA_B)
    // Inside both linear caps, outside the area cap.
    expect(leafFitsEnvelope(1140, 2400, env)).toBe(false)
    // Inside all three.
    expect(leafFitsEnvelope(1100, 2300, env)).toBe(true)
  })
})

describe("direction-aware matching", () => {
  const door = (over = {}) => ({
    structuralWidth: 1100, structuralHeight: 2200,
    leaves: 1, fireMinutes: 120, acousticDb: null, frame: null,
    ...over,
  })

  it("holds both reports, one per direction", () => {
    expect(REPORTS["XL070-17&18"].direction).toBe("away")
    expect(REPORTS["XL070-13&14"].direction).toBe("towards")
  })

  it("a single leaf at 120 minutes is NOT evidenced — towards-furnace only reached 118", () => {
    const res = matchRequirement(door())
    expect(res.status).toBe("stated")
  })

  it("the same single leaf at 90 minutes IS evidenced", () => {
    const res = matchRequirement(door({ fireMinutes: 90 }))
    expect(res.status).toBe("evidenced")
  })

  it("a double leaf at 120 minutes IS evidenced — both directions held 132", () => {
    const res = matchRequirement(door({ structuralWidth: 2000, leaves: 2 }))
    expect(res.status).toBe("evidenced")
    // Direct double-leaf specimens, not per-leaf derivation.
    expect(res.best.evidence.perLeafBasis).toBe(false)
  })

  it("suggests two leaves for the un-evidenced 120-minute single leaf", () => {
    expect(smallestEvidencedLeafCount(door())).toBe(2)
  })

  it("far outside every supplier envelope resolves to a bespoke enquiry", () => {
    const res = matchRequirement(door({ structuralWidth: 6000, structuralHeight: 4000 }))
    expect(res.status).toBe("over-limit")
    expect(res.best).toBeNull()
  })

  it("a 47 dB acoustic requirement can only ever be stated — that supplier holds one direction of evidence", () => {
    const res = matchRequirement(door({ fireMinutes: 60, acousticDb: 47 }))
    expect(res.status).toBe("stated")
    expect(res.candidates.every(c => c.product.id === "rd-standard")).toBe(true)
  })
})
