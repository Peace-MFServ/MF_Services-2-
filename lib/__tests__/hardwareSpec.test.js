// The resolution layer between the form and the matcher: statuses,
// reasons and the rows that reach the sheet.

import { describe, it, expect } from "vitest"
import {
  getProduct, buildInitialConfig, buildRequirement,
  resolveProduct, validateSpec, specRows,
} from "../hardwareSpec"

const product = getProduct("riser-doors")

const config = (over = {}) => ({
  ...buildInitialConfig(product),
  width: "1100", height: "2200",
  ...over,
})

describe("requirement building", () => {
  it("maps the fire rating option to minutes", () => {
    expect(buildRequirement(product, config({ fireRating: "EW60" })).fireMinutes).toBe(60)
  })
  it("clamps the leaf count to what suppliers make", () => {
    expect(buildRequirement(product, config({ leaves: 9 })).leaves).toBe(4)
  })
  it("is null until both dimensions are entered", () => {
    expect(buildRequirement(product, config({ width: "" }))).toBeNull()
  })
})

describe("resolution", () => {
  it("is incomplete without dimensions", () => {
    expect(resolveProduct(product, config({ height: "" })).status).toBe("incomplete")
  })

  it("evidenced at 90 minutes, with the report references in the basis", () => {
    const res = resolveProduct(product, config({ fireRating: "EW90" }))
    expect(res.status).toBe("evidenced")
    expect(res.basis).toContain("XL070")
    expect(res.basis).toContain("both directions")
  })

  it("stated at 120 minutes on a single leaf, suggesting two leaves", () => {
    const res = resolveProduct(product, config())
    expect(res.status).toBe("stated")
    expect(res.suggestedLeaves).toBe(2)
    expect(res.reason).toContain("2 leaves")
  })

  it("bespoke past every supplier, and still not a rejection", () => {
    const res = resolveProduct(product, config({ width: "6000", height: "4000" }))
    expect(res.status).toBe("over-limit")
    expect(res.reason).toContain("bespoke enquiry")
  })

  it("never names a supplier in customer-facing text", () => {
    for (const c of [config(), config({ fireRating: "EW90" }), config({ width: "6000" })]) {
      const res = resolveProduct(product, c)
      const text = `${res.basis ?? ""} ${res.reason ?? ""}`
      expect(text).not.toMatch(/profab|access 360|vega|integra/i)
    }
  })
})

describe("validation and rows", () => {
  it("a complete configuration is valid", () => {
    const v = validateSpec(product, config({ fireRating: "EW90" }), { projectName: "Test" })
    expect(v.isValid).toBe(true)
  })

  it("spec rows use the matched doorset's clear opening", () => {
    const res = resolveProduct(product, config({ fireRating: "EW90" }))
    const rows = specRows(product, config({ fireRating: "EW90" }), res)
    const clearRow = rows.find(r => r.label === "Clear opening")
    expect(clearRow.value).toBe(`${res.clear.width} × ${res.clear.height} mm`)
  })

  it("new requirement fields reach the rows", () => {
    const rows = specRows(product, config(), resolveProduct(product, config()))
    const labels = rows.map(r => r.label)
    expect(labels).toContain("Riser guardrails")
    expect(labels).toContain("Smoke control")
    expect(labels).toContain("Acoustic requirement")
  })
})
