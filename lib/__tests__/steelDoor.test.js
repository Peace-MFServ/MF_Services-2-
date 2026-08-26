// Steel doorsets, checked against the manufacturer's own configurator.
// The numbers here are read straight from that spreadsheet — if a data
// edit moves one, these fail before a customer sees it.

import { describe, it, expect } from "vitest"
import {
  STEEL, fireRatings, findType, leafCountsFor, highPerformanceAvailable,
  framesFor, exposuresFor, limitsFor, clearOpeningFor,
  resolveSteelDoor, validateSteelDoor, describeSteelDoor,
  steelSpecRows, constructionFor, standardsFor,
  hardwareGroupsFor, settleHardware, defaultHardware, reconcileHardware,
  hardwareWithPlaceholders,
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
  // Hardware answers itself in from its defaults, the same way the
  // interface fills them in the moment a doorset exists.
  const complete = settleHardware({
    minutes: 60, leaves: 1, highPerformance: false,
    exposure: "INT", frameId: "corner", width: 1000, height: 2100,
  })

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
    const v = validateSteelDoor({ minutes: 60, leaves: 1, ...settleHardware({ minutes: 60, leaves: 1 }) })
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

describe("the specification sheet", () => {
  const complete = {
    minutes: 60, leaves: 2, highPerformance: false,
    exposure: "EXT", frameId: "corner", width: 1600, height: 2100,
    handing: "left",
  }

  it("lists the doorset, the opening and what is left clear", () => {
    const rows = steelSpecRows(complete)
    const value = label => rows.find(r => r.label === label)?.value
    expect(value("Doorset")).toBe("Double leaf")
    expect(value("Fire rating")).toBe("EI2 60 — 60 minutes")
    expect(value("Structural opening")).toBe("1600 × 2100 mm")
    // A corner frame on a double leaf takes 120 mm across, 40 mm up.
    expect(value("Clear opening")).toBe("1480 × 2060 mm")
    // Each leaf is half of what the frame leaves clear.
    expect(value("Leaf size")).toBe("740 × 2060 mm")
  })

  it("never prints a type code or a certificate reference", () => {
    const printed = JSON.stringify(steelSpecRows(complete))
    expect(printed).not.toMatch(/DS /)
    expect(printed).not.toMatch(/certificate/i)
  })

  it("says plainly when a doorset is not fire rated", () => {
    const rows = steelSpecRows({ ...complete, minutes: 0 })
    expect(rows.find(r => r.label === "Fire rating").value).toBe("Not fire rated")
  })

  it("adds the High Performance paragraph only when it applies", () => {
    const std = constructionFor(findType({ minutes: 30, leaves: 1 }))
    const hp = constructionFor(findType({ minutes: 30, leaves: 1, highPerformance: true }))
    expect(std.some(p => /High Performance/.test(p))).toBe(false)
    expect(hp.some(p => /65 mm leaf/.test(p))).toBe(true)
  })

  it("leaves the fire standards off an unrated doorset", () => {
    const unrated = standardsFor(findType({ minutes: 0, leaves: 1 }), "INT")
    expect(unrated.map(s => s.code)).not.toContain("EN 13501-2")
  })

  it("cites the external doorset standard only outside", () => {
    const t = findType({ minutes: 60, leaves: 1 })
    expect(standardsFor(t, "EXT").map(s => s.code)).toContain("EN 14351-1")
    expect(standardsFor(t, "INT").map(s => s.code)).not.toContain("EN 14351-1")
  })
})

describe("hardware", () => {
  const doorset = extra => settleHardware({
    minutes: 60, leaves: 1, highPerformance: false,
    exposure: "INT", frameId: "corner", width: 1000, height: 2100,
    ...extra,
  })

  const group = (config, id) => hardwareGroupsFor(config).find(g => g.id === id)

  it("asks nothing until there is a doorset to fit it to", () => {
    expect(hardwareGroupsFor({})).toEqual([])
  })

  it("fits nothing by default, but a lock and hinges always", () => {
    const c = doorset()
    expect(c.hinge).toBe("standard INOX without regul.")
    expect(c.hingeCount).toBe("2")
    expect(c.lock).toBe("standard")
    expect(c.cylinder).toBe("double cylinder")
    expect(c.doorCloser).toBe("without")
    expect(c.glazing).toBe("without")
    expect(c.threshold).toBe("without")
  })

  it("lets the lock decide the cylinders and handles", () => {
    const gbs = doorset({ lock: "GBS 90" })
    // GBS 90 has no thumb turn — the cylinder list is the short one.
    expect(group(gbs, "cylinder").options).toEqual([
      "double cylinder", "half cylinder HS", "half cylinder OHS", "without preparation for cylinder",
    ])
    expect(group(gbs, "handleActiveInside").options).toContain("handle on long shield")
    expect(group(gbs, "handleActiveInside").options).not.toContain("knob on long shield")
  })

  it("moves an answer the new lock does not offer", () => {
    const c = doorset({ cylinder: "thumb turn OHS" })
    expect(c.cylinder).toBe("thumb turn OHS")
    const changed = settleHardware({ ...c, lock: "GBS 90" })
    expect(changed.cylinder).toBe("double cylinder")
  })

  it("offers a panic bar outside but never inside", () => {
    const c = doorset({ lock: "panic B" })
    expect(group(c, "handleActiveOutside").options).toContain("panic bar EPN 900 inox")
    expect(group(c, "handleActiveInside").options).not.toContain("panic bar EPN 900 inox")
  })

  it("only asks about the passive leaf on a pair", () => {
    const single = doorset()
    const double = settleHardware({ ...single, leaves: 2, width: 1600 })
    expect(group(single, "handlePassiveOutside")).toBeUndefined()
    expect(group(single, "flushBolt")).toBeUndefined()
    expect(group(double, "flushBolt").options).toContain("standard - mortise EI")
  })

  it("forces the smoke sealed doorset onto three hinges and a drop seal", () => {
    const c = doorset({ smokeProtection: "YES" })
    expect(group(c, "hinge").options).toEqual(["3D INOX 95mm"])
    expect(group(c, "hingeCount").options).toEqual(["3", "4"])
    expect(group(c, "dropSeal").options).toEqual(["automatic 1 L"])
    expect(c.dropSeal).toBe("automatic 1 L")
  })

  it("does not offer smoke protection on a doorset with no fire rating", () => {
    const c = doorset({ minutes: 0 })
    expect(group(c, "smokeProtection").options).toEqual(["NO"])
  })

  it("puts a 120 minute doorset on its own hinge", () => {
    const c = doorset({ minutes: 120 })
    expect(group(c, "hinge").options).toEqual(["3D INOX 160mm"])
  })

  it("puts a High Performance doorset on its own hinge", () => {
    const c = doorset({ minutes: 30, highPerformance: true })
    expect(group(c, "hinge").options[0]).toBe("3D INOX HP")
  })

  it("offers a drip cap outside only", () => {
    expect(group(doorset({ exposure: "EXT" }), "dripCap").options).toContain("upper drip cap")
    expect(group(doorset({ exposure: "INT" }), "dripCap")).toBeUndefined()
  })

  it("matches the glazing to the rating, the leaves and the exposure", () => {
    expect(group(doorset(), "glazing").options).toContain("EI60 size up to 0,3m2 single")
    expect(group(doorset({ exposure: "EXT" }), "glazing").options).toContain("EI60 size up to 0,3m2 double")
    // Nothing is glazed into a 90 minute doorset.
    expect(group(doorset({ minutes: 90 }), "glazing").options).toEqual(["without"])
  })

  it("clears an answer when the question stops being asked", () => {
    const ext = doorset({ exposure: "EXT", dripCap: "upper drip cap" })
    expect(ext.dripCap).toBe("upper drip cap")
    expect(settleHardware({ ...ext, exposure: "INT" }).dripCap).toBe("")
  })

  it("wants the words when the answer is 'other'", () => {
    const c = doorset({ doorCloser: "other" })
    const v = validateSteelDoor(c)
    expect(v.isValid).toBe(false)
    expect(v.errors.find(e => e.field === "doorCloser").message).toMatch(/describe/i)
    expect(validateSteelDoor({ ...c, doorCloserText: "Geze TS 5000" }).isValid).toBe(true)
  })

  it("takes the nothing option as the default where there is one", () => {
    expect(defaultHardware(["without", "1 pc door stopper"])).toBe("without")
    expect(defaultHardware(["standard", "panic B"])).toBe("standard")
  })

  it("leaves a settled configuration alone", () => {
    expect(reconcileHardware(doorset())).toEqual({})
  })
})

describe("hardware on the sheet", () => {
  const c = settleHardware({
    minutes: 60, leaves: 1, exposure: "EXT", frameId: "corner",
    width: 1000, height: 2100,
  })

  it("prints the lock, cylinder and hinges even when nothing else is fitted", () => {
    const labels = steelSpecRows(c).map(r => r.label)
    expect(labels).toEqual(expect.arrayContaining(["Hinges", "Hinges per leaf", "Lock", "Cylinder", "Door closer"]))
  })

  it("leaves out the items nobody asked for", () => {
    const labels = steelSpecRows(c).map(r => r.label)
    expect(labels).not.toContain("Door stopper")
    expect(labels).not.toContain("Glazing")
  })

  it("prints an item once it is fitted", () => {
    const rows = steelSpecRows({ ...c, doorStopper: "1 pc door stopper" })
    expect(rows.find(r => r.label === "Door stopper").value).toBe("1 pc door stopper")
  })

  it("prints a colour only when one was given", () => {
    expect(steelSpecRows(c).some(r => r.label === "Finish")).toBe(false)
    expect(steelSpecRows({ ...c, ral: "7016" }).find(r => r.label === "Finish").value).toBe("RAL 7016")
    expect(steelSpecRows({ ...c, ral: "RAL 9005" }).find(r => r.label === "Finish").value).toBe("RAL 9005")
  })

  it("prints what was written against 'other'", () => {
    const rows = steelSpecRows({ ...c, doorCloser: "other", doorCloserText: "Geze TS 5000" })
    expect(rows.find(r => r.label === "Door closer").value).toBe("Other — Geze TS 5000")
  })
})

describe("the questions the quick layout keeps on screen", () => {
  const ids = config => hardwareWithPlaceholders(config).map(g => g.id)

  it("asks everything from the start, even with nothing answered", () => {
    const groups = hardwareWithPlaceholders({})
    expect(groups.map(g => g.id)).toContain("lock")
    expect(groups.map(g => g.id)).toContain("threshold")
    expect(groups.every(g => g.options.length === 0)).toBe(true)
    expect(groups[0].blocked).toBe("Choose the doorset first")
  })

  it("keeps away the questions a doorset like this never asks", () => {
    // No passive leaf on a single, no drip cap indoors.
    expect(ids({})).not.toContain("handlePassiveOutside")
    expect(ids({})).not.toContain("dripCap")
  })

  it("says what each question is still waiting for", () => {
    const waiting = config => Object.fromEntries(
      hardwareWithPlaceholders(config).map(g => [g.id, g.blocked]),
    )
    const doorset = { minutes: 60, leaves: 1, frameId: "corner", width: 1000, height: 2100 }
    expect(waiting({ ...doorset, exposure: "" }).glazing).toBe("Choose where it goes first")
    expect(waiting({ ...doorset, exposure: "INT" }).cylinder).toBe("Choose a lock first")
  })

  it("hands back the real options once they exist", () => {
    const c = settleHardware({
      minutes: 60, leaves: 1, exposure: "INT", frameId: "corner", width: 1000, height: 2100,
    })
    const cylinder = hardwareWithPlaceholders(c).find(g => g.id === "cylinder")
    expect(cylinder.options).toContain("double cylinder")
    expect(cylinder.blocked).toBeUndefined()
  })
})
