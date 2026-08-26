// Steel doorsets, checked against the manufacturer's own configurator.
// The numbers here are read straight from that spreadsheet — if a data
// edit moves one, these fail before a customer sees it.

import { describe, it, expect } from "vitest"
import {
  STEEL, fireRatings, findType, leafCountsFor, highPerformanceAvailable,
  framesFor, exposuresFor, limitsFor, clearOpeningFor,
  resolveSteelDoor, validateSteelDoor, describeSteelDoor,
} from "../steelDoor"

describe("the range", () => {
  it("carries the fifteen types the configurator offers", () => {
    expect(STEEL.types).toHaveLength(15)
  })

  it("offers unrated, 30, 60, 90 and 120 minutes", () => {
    expect(fireRatings()).toEqual([0, 30, 60, 90, 120])
  })

  it("never exposes a type code as something to choose", () => {
    // The customer answers rating, leaves and performance; the code is
    // derived. Nothing in the customer-facing helpers returns it.
    expect(describeSteelDoor(findType({ minutes: 60, leaves: 1 }))).not.toMatch(/DS /)
  })
})

describe("deriving the type from the answers", () => {
  it("finds the plain types", () => {
    expect(findType({ minutes: 0, leaves: 1 }).code).toBe("DS 00-1")
    expect(findType({ minutes: 60, leaves: 2 }).code).toBe("DS 60-2")
    expect(findType({ minutes: 120, leaves: 1 }).code).toBe("DS 120-1 (EI2)")
  })

  it("finds the High Performance types", () => {
    expect(findType({ minutes: 30, leaves: 2, highPerformance: true }).code).toBe("DS 30-2 HP")
  })

  it("returns nothing for combinations that are not made", () => {
    // There is no 90 minute double leaf, and no HP above 60 minutes.
    expect(findType({ minutes: 90, leaves: 2 })).toBeNull()
    expect(findType({ minutes: 90, leaves: 1, highPerformance: true })).toBeNull()
    expect(findType({ minutes: 120, leaves: 1, highPerformance: true })).toBeNull()
  })
})

describe("what each answer leaves available", () => {
  it("offers single and double except at 90 minutes", () => {
    expect(leafCountsFor({ minutes: 60 })).toEqual([1, 2])
    expect(leafCountsFor({ minutes: 90 })).toEqual([1])
  })

  it("offers High Performance only up to 60 minutes", () => {
    expect(highPerformanceAvailable({ minutes: 60, leaves: 1 })).toBe(true)
    expect(highPerformanceAvailable({ minutes: 90, leaves: 1 })).toBe(false)
    expect(highPerformanceAvailable({ minutes: 120, leaves: 1 })).toBe(false)
  })

  it("restricts the 90 minute doorset to internal use", () => {
    const t = findType({ minutes: 90, leaves: 1 })
    expect(exposuresFor(t).map(e => e.id)).toEqual(["INT"])
  })

  it("offers the 90 minute doorset in thermal frames only", () => {
    const t = findType({ minutes: 90, leaves: 1 })
    expect(framesFor(t).every(f => /thermal/i.test(f.label))).toBe(true)
  })
})

describe("approved sizes", () => {
  it("matches the configurator for an unrated single leaf", () => {
    const t = findType({ minutes: 0, leaves: 1 })
    expect(limitsFor(t, "corner", "INT")).toEqual({
      minWidth: 254, maxWidth: 1380, minHeight: 513, maxHeight: 2800,
    })
  })

  it("gives a block frame a wider minimum than a corner frame", () => {
    const t = findType({ minutes: 0, leaves: 1 })
    expect(limitsFor(t, "block", "INT").minWidth)
      .toBeGreaterThan(limitsFor(t, "corner", "INT").minWidth)
  })

  it("lets an external 30 minute doorset run taller than an internal one", () => {
    const t = findType({ minutes: 30, leaves: 1 })
    expect(limitsFor(t, "corner", "EXT").maxHeight).toBe(2800)
    expect(limitsFor(t, "corner", "INT").maxHeight).toBe(2531)
  })
})

describe("clear opening", () => {
  it("takes the frame's own deduction off the structural opening", () => {
    const t = findType({ minutes: 0, leaves: 1 })
    // Corner frame on a single leaf: 80 mm across, 40 mm up.
    expect(clearOpeningFor(t, "corner", 1000, 2100)).toEqual({ width: 920, height: 2060 })
    // A block frame takes considerably more.
    expect(clearOpeningFor(t, "block", 1000, 2100)).toEqual({ width: 850, height: 2025 })
  })

  it("takes more off a High Performance doorset", () => {
    const std = findType({ minutes: 30, leaves: 1 })
    const hp = findType({ minutes: 30, leaves: 1, highPerformance: true })
    expect(clearOpeningFor(hp, "corner", 1200, 2200).width)
      .toBeLessThan(clearOpeningFor(std, "corner", 1200, 2200).width)
  })
})

describe("resolving a configuration", () => {
  const complete = {
    minutes: 60, leaves: 1, highPerformance: false,
    exposure: "INT", frameId: "corner", width: 1000, height: 2100,
  }

  it("approves a doorset inside its limits", () => {
    const r = resolveSteelDoor(complete)
    expect(r.status).toBe("approved")
    expect(r.type.code).toBe("DS 60-1")
    expect(validateSteelDoor(complete).isValid).toBe(true)
  })

  it("refuses one outside them, and says the range", () => {
    const v = validateSteelDoor({ ...complete, width: 4000 })
    expect(v.isValid).toBe(false)
    expect(v.errors.find(e => e.field === "width").message).toMatch(/between \d+ and \d+ mm/)
    expect(v.resolution.status).toBe("outside-limits")
  })

  it("asks for the exposure and frame before the size can be judged", () => {
    const v = validateSteelDoor({ minutes: 60, leaves: 1 })
    expect(v.errors.map(e => e.field)).toEqual(
      expect.arrayContaining(["exposure", "frameId", "width", "height"]),
    )
  })

  it("keeps the type code and certificate to the internal basis", () => {
    const r = resolveSteelDoor(complete)
    expect(r.basis.code).toBe("DS 60-1")
    expect(JSON.stringify(r.type.classification)).not.toMatch(/DS /)
  })
})
