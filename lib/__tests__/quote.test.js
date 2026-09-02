// The quote model both downloads render. The numbers here mirror the
// Pricer's own footer — if these drift, the file and the screen would
// disagree, which is the one thing an estimator cannot forgive.
//
// The selling arithmetic under test, as agreed with the estimators:
// costs (doorsets + transport + labour) ÷ (1 − margin%) × (1 − disc%).
// Margin is a share of the SALE — 40% margin divides by 0.6.

import { describe, it, expect } from "vitest"
import { buildQuote, quoteFilename, labourFor } from "../quote"

const pricedLine = (name, qty, total, components = []) => ({
  name,
  quantity: String(qty),
  config: { minutes: 60, leaves: 1, width: 1000, height: 2100, frameId: "corner", exposure: "INT" },
  priced: { total, onApplication: false, lines: components },
})

describe("building a quote", () => {
  it("works the estimators' example end to end", () => {
    // €10,000 of doorsets + €500 transport + 2 men × 3 days × €450
    // = €13,200 → ÷ 0.6 = €22,000 → −5% = €20,900.
    const q = buildQuote({
      lines: [pricedLine("D-01", 4, 2500)],
      margin: "40", transport: "500",
      labourMen: "2", labourDays: "3",
      discount: "5", project: "Docklands Block C",
    })
    expect(q.doorsetsCost).toBe(10000)
    expect(q.labour.total).toBe(2700)
    expect(q.subtotal).toBe(13200)
    expect(q.beforeDiscount).toBe(22000)
    expect(q.marginAmount).toBe(8800)
    expect(q.discountAmount).toBe(1100)
    expect(q.total).toBe(20900)
  })

  it("leaves the discount at nothing when blank, and caps it at 5", () => {
    const base = {
      lines: [pricedLine("D-01", 1, 600)],
      margin: "40", transport: "", labourMen: "2", labourDays: "",
    }
    expect(buildQuote({ ...base, discount: "" }).total).toBe(1000)
    expect(buildQuote({ ...base, discount: "12" }).discountPct).toBe(5)
    expect(buildQuote({ ...base, discount: "12" }).total).toBe(950)
  })

  it("charges no labour without days, and never fewer than two men with them", () => {
    expect(labourFor({ labourMen: "", labourDays: "" }).total).toBe(0)
    expect(labourFor({ labourMen: "5", labourDays: "" }).total).toBe(0)
    expect(labourFor({ labourMen: "1", labourDays: "2" })).toMatchObject({ men: 2, total: 1800 })
    expect(labourFor({ labourMen: "", labourDays: "1" })).toMatchObject({ men: 2, total: 900 })
    expect(labourFor({ labourMen: "4", labourDays: "2" }).total).toBe(3600)
  })

  it("divides by the margin share of the sale rather than adding it on", () => {
    // 30% margin on €700 of cost: sale = 700 / 0.7 = €1,000 —
    // NOT 700 × 1.3 = €910.
    const q = buildQuote({
      lines: [pricedLine("D-01", 1, 700)],
      margin: "30", transport: "", labourMen: "", labourDays: "", discount: "",
    })
    expect(q.beforeDiscount).toBe(1000)
    expect(q.marginAmount).toBe(300)
  })

  it("keeps an on-application doorset out of the money but in the file", () => {
    const open = {
      ...pricedLine("D-03", 2, 999),
      priced: { total: 400, onApplication: true, lines: [{ label: "Doorset", amount: null }] },
    }
    const q = buildQuote({
      lines: [pricedLine("D-01", 1, 500), open],
      margin: "0", transport: "", labourMen: "", labourDays: "", discount: "",
    })
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

describe("specification notes", () => {
  const line = config => ({ name: "D", quantity: "1", config, priced: { total: 100, onApplication: false, lines: [] } })

  it("explains the technical picks, once each, and only the ones made", () => {
    const notes = buildQuote({
      lines: [
        line({ minutes: 120, leaves: 1, frameId: "block-thermal", exposure: "EXT", lock: "panic B", smokeProtection: "YES" }),
        line({ minutes: 120, leaves: 1, frameId: "block-thermal", exposure: "EXT", lock: "panic B" }),
      ],
      margin: "40",
    }).specNotes
    const terms = notes.map(n => n.term)
    expect(terms).toEqual(["EI2 120", "External", "panic B", "Block thermal", "Smoke protection"])
    expect(notes[0].text).toContain("120 minutes")
    expect(notes[0].text).toContain("EN 13501-2")
    expect(notes[3].text).toContain("Thermally broken")
  })

  it("says not fire rated when it is not, and stays quiet on plain picks", () => {
    const notes = buildQuote({
      lines: [line({ minutes: 0, leaves: 1, frameId: "block", exposure: "INT", lock: "standard" })],
      margin: "40",
    }).specNotes
    expect(notes).toEqual([
      { term: "Not fire rated", text: "No fire resistance classification." },
    ])
  })
})
