// Steel doorset prices, checked against the source configurator's own
// totals. The three configurations below are lines 6, 7 and 10 of that
// spreadsheet; the expected figures are the numbers it calculated for
// them. If a price table is re-extracted and something shifts, these
// fail before a quote goes out with the wrong number on it.

import { describe, it, expect } from "vitest"
import { priceSteelDoor, CURRENCY } from "../server/steelPrice"
import { findType, settleHardware } from "../steelDoor"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const price = (type, config) => priceSteelDoor({ type, config })
const amount = (result, label) => result.lines.find(l => l.label === label)?.amount

describe("prices from the source configurator", () => {
  it("prices a plain unrated single leaf", () => {
    // Line 6: DS 00-1, 1000 × 2100, corner frame, nothing fitted.
    const type = findType({ minutes: 0, leaves: 1 })
    const config = settleHardware({
      minutes: 0, leaves: 1, exposure: "EXT", frameId: "corner",
      width: 1000, height: 2100,
    })
    const r = price(type, config)
    expect(r.total).toBe(441)
    expect(r.onApplication).toBe(false)
  })

  it("prices a plain unrated pair", () => {
    // Line 7: DS 00-2, 2000 × 2200, corner frame, nothing fitted.
    const type = findType({ minutes: 0, leaves: 2 })
    const config = settleHardware({
      minutes: 0, leaves: 2, exposure: "INT", frameId: "corner",
      width: 2000, height: 2200,
    })
    expect(price(type, config).total).toBe(979)
  })

  it("prices a loaded 60 minute doorset to the euro", () => {
    // Line 10: DS 60-1, 1000 × 2200, block frame, smoke sealed, with a
    // closer, glazing, a drop seal and a thumb turn.
    const type = findType({ minutes: 60, leaves: 1 })
    const config = {
      ...settleHardware({
        minutes: 60, leaves: 1, exposure: "EXT", frameId: "block",
        width: 1000, height: 2200,
      }),
      smokeProtection: "YES",
      hinge: "3D INOX 95mm",
      hingeCount: "2",
      cylinder: "thumb turn OHS",
      doorCloser: "TS 50",
      glazing: "EI60 size up to 0,3m2 double",
      dropSeal: "automatic 1 L",
    }
    const r = price(type, config)

    expect(amount(r, "Doorset")).toBe(511)
    expect(amount(r, "Frame")).toBe(54)          // 10/m × (2×2200 + 1000)/1000
    expect(amount(r, "Hinges")).toBe(20)
    expect(amount(r, "Cylinder")).toBe(19)
    expect(amount(r, "Door closer")).toBe(69)
    expect(amount(r, "Glazing")).toBe(292)
    expect(amount(r, "Automatic drop-down seal")).toBe(30)
    expect(amount(r, "Smoke protection")).toBe(10)
    expect(r.total).toBe(1005)
  })
})

describe("what it will not price", () => {
  const type = findType({ minutes: 0, leaves: 1 })
  const base = extra => settleHardware({
    minutes: 0, leaves: 1, exposure: "INT", frameId: "corner",
    width: 1000, height: 2100, ...extra,
  })

  it("says on application above the priced size grid", () => {
    // The doorset is approved to 2800 mm high but priced only to 2550.
    const r = price(type, base({ height: 2700 }))
    expect(r.onApplication).toBe(true)
    expect(r.lines.find(l => l.label === "Doorset").amount).toBeNull()
  })

  it("waits for a figure when the answer was 'other'", () => {
    const r = price(type, base({ doorCloser: "other", doorCloserText: "Geze TS 5000" }))
    expect(r.onApplication).toBe(true)
    expect(r.lines.find(l => l.label === "Door closer").detail).toBe("Geze TS 5000")
  })

  it("takes the figure once it is given", () => {
    const r = price(type, base({ doorCloser: "other", doorCloserPrice: 210 }))
    expect(r.onApplication).toBe(false)
    expect(amount(r, "Door closer")).toBe(210)
  })
})

describe("frames priced by the wall", () => {
  const type = findType({ minutes: 0, leaves: 1 })

  it("charges an embracing frame by how thick the wall is", () => {
    const at = wall => priceSteelDoor({
      type,
      config: settleHardware({
        minutes: 0, leaves: 1, exposure: "INT", frameId: "embracing",
        width: 1000, height: 2100, wallThickness: wall,
      }),
    }).lines.find(l => l.label === "Frame").amount

    // 18/m up to 200 mm, 29/m to 225, 31/m beyond — over 5.2 m of frame.
    expect(at(150)).toBeCloseTo(18 * 5.2, 2)
    expect(at(220)).toBeCloseTo(29 * 5.2, 2)
    expect(at(300)).toBeCloseTo(31 * 5.2, 2)
  })

  it("does not guess when no wall thickness was given", () => {
    const r = priceSteelDoor({
      type,
      config: settleHardware({
        minutes: 0, leaves: 1, exposure: "INT", frameId: "embracing",
        width: 1000, height: 2100,
      }),
    })
    expect(r.onApplication).toBe(true)
  })
})

describe("High Performance", () => {
  it("adds the surcharge for the rating and the leaf count", () => {
    const hp = findType({ minutes: 30, leaves: 2, highPerformance: true })
    const r = priceSteelDoor({
      type: hp,
      config: settleHardware({
        minutes: 30, leaves: 2, highPerformance: true, exposure: "INT",
        frameId: "corner", width: 1600, height: 2100,
      }),
    })
    expect(amount(r, "High Performance")).toBe(187)
  })
})

describe("keeping the prices off the browser", () => {
  it("is imported by nothing that ships to the client", () => {
    const offenders = []
    for (const dir of ["components", "app"]) {
      walk(join(process.cwd(), dir), file => {
        if (!/\.(js|jsx)$/.test(file)) return
        const src = readFileSync(file, "utf8")
        if (/from\s+["'][^"']*server\/(steelPrice|dfm-steel-prices)/.test(src)) {
          offenders.push(file)
        }
      })
    }
    expect(offenders).toEqual([])
  })
})

function walk(dir, fn) {
  const { readdirSync, statSync } = require("node:fs")
  let entries
  try { entries = readdirSync(dir) } catch { return }
  for (const name of entries) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, fn)
    else fn(full)
  }
}

describe("the currency", () => {
  it("is stated so a quote can never be ambiguous about it", () => {
    expect(CURRENCY).toBeTruthy()
  })
})
