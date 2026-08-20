// The resolution layer between the form and the approved-size match:
// statuses, step gating and the rows that reach the sheet.

import { describe, it, expect } from "vitest"
import {
  getProduct, buildInitialConfig,
  resolveProduct, validateSpec, specRows,
} from "../hardwareSpec"

const product = getProduct("riser-doors")

const config = (over = {}) => ({
  ...buildInitialConfig(product),
  width: "1100", height: "2300",
  wallType: "steel-stud", lockType: "slik-plus-euro",
  ...over,
})

describe("resolution", () => {
  it("is incomplete without dimensions", () => {
    expect(resolveProduct(product, config({ height: "" })).status).toBe("incomplete")
  })

  it("carries the approved leaf counts for the opening", () => {
    const res = resolveProduct(product, config())
    expect(res.status).toBe("evidenced")
    expect(res.allowedLeaves).toEqual([1, 2, 3])
  })

  it("outside every envelope is a bespoke enquiry", () => {
    const res = resolveProduct(product, config({ width: "1400", height: "2950" }))
    expect(res.status).toBe("over-limit")
    expect(res.allowedLeaves).toEqual([])
  })

  it("never names the supplier in anything the resolution carries for display", () => {
    const res = resolveProduct(product, config())
    expect(JSON.stringify({ clear: res.clear, leaf: res.leaf, allowed: res.allowedLeaves }))
      .not.toMatch(/simplis|christo/i)
  })
})

describe("validation", () => {
  it("a complete configuration is valid", () => {
    const v = validateSpec(product, config(), { projectName: "Test" })
    expect(v.isValid).toBe(true)
  })

  it("requires a wall construction and a lock", () => {
    const v = validateSpec(product, config({ wallType: "", lockType: "" }), {})
    const fields = v.errors.map(e => e.field)
    expect(fields).toContain("wallType")
    expect(fields).toContain("lockType")
  })

  it("rejects masonry past two leaves", () => {
    const v = validateSpec(product, config({ leaves: 3, width: "2300", wallType: "masonry" }), {})
    expect(v.errors.some(e => e.field === "wallType")).toBe(true)
  })
})

describe("sheet rows", () => {
  it("carries wall, frame and lock", () => {
    const rows = specRows(product, config(), resolveProduct(product, config()))
    const byLabel = Object.fromEntries(rows.map(r => [r.label, r.value]))
    expect(byLabel["Wall construction"]).toBe("Steel stud partition")
    expect(byLabel["Frame"]).toBe("Flush (standard)")
    expect(byLabel["Lock and key"]).toBe("SLIK+ with euro cylinder")
  })

  it("notes the passive-leaf lock on multi-leaf sets", () => {
    const c = config({ leaves: 2, width: "1600" })
    const rows = specRows(product, c, resolveProduct(product, c))
    const lock = rows.find(r => r.label === "Lock and key")
    expect(lock.value).toContain("passive leaves")
  })

  it("has no smoke control row — seals are standard", () => {
    const rows = specRows(product, config(), resolveProduct(product, config()))
    expect(rows.some(r => /smoke/i.test(r.label))).toBe(false)
  })
})
