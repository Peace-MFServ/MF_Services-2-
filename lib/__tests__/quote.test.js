// The quote model both downloads render. The numbers here mirror the
// Pricer's own footer — if these drift, the file and the screen would
// disagree, which is the one thing an estimator cannot forgive.

import { describe, it, expect } from "vitest"
import { buildQuote, quoteFilename } from "../quote"

const pricedLine = (name, qty, total, components = []) => ({
  name,
  quantity: String(qty),
  config: { minutes: 60, leaves: 1, width: 1000, height: 2100, frameId: "corner", exposure: "INT" },
  priced: { total, onApplication: false, lines: components },
})

describe("building a quote", () => {
  it("prices the schedule, the margin and the transport", () => {
    const q = buildQuote({
      lines: [pricedLine("D-01", 3, 500), pricedLine("D-02", 1, 250)],
      markup: "10", transport: "120", project: "Docklands Block C",
    })
    expect(q.subtotal).toBe(1750)
    expect(q.margin).toBe(175)
    expect(q.total).toBe(2045)
    expect(q.unpriced).toBe(0)
  })

  it("keeps an on-application doorset out of the money but in the file", () => {
    const open = {
      ...pricedLine("D-03", 2, 999),
      priced: { total: 400, onApplication: true, lines: [{ label: "Doorset", amount: null }] },
    }
    const q = buildQuote({ lines: [pricedLine("D-01", 1, 500), open], markup: "", transport: "" })
    expect(q.subtotal).toBe(500)
    expect(q.unpriced).toBe(1)
    const d = q.doorsets[1]
    expect(d.each).toBeNull()
    expect(d.lineTotal).toBeNull()
    expect(d.components[0].amount).toBeNull()
  })

  it("describes each doorset the way the screen does", () => {
    const q = buildQuote({ lines: [pricedLine("D-01", 1, 500)] })
    expect(q.doorsets[0].description).toContain("EI2 60")
    expect(q.doorsets[0].description).toContain("1000 × 2100 mm")
    expect(q.doorsets[0].description).toContain("Corner frame")
  })

  it("names the file after the project", () => {
    const q = buildQuote({ lines: [], project: "Docklands Block C" })
    expect(quoteFilename(q, "pdf")).toMatch(/^quote_docklands-block-c_\d{4}-\d{2}-\d{2}\.pdf$/)
    expect(quoteFilename(buildQuote({ lines: [] }), "xlsx")).toMatch(/^quote_untitled_/)
  })
})
