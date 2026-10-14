// The customer quote must give nothing of our pricing away. These
// tests build the real customer PDF and spreadsheet from a quote whose
// costs are distinctive figures, then search the files themselves for
// any of them — a cost, the margin, the labour, or the supplier's name
// anywhere in what the customer receives fails the build.

import { describe, it, expect } from "vitest"
import { jsPDF } from "jspdf"
import { buildQuote } from "../quote"
import { buildCustomerQuote, customerPart, quoteReference } from "../customerQuote"
import { buildCustomerQuotePDF, buildQuotePDF } from "../generateQuotePDF"
import { buildCustomerWorkbook } from "../generateQuoteXLSX"

const line = (name, quantity, components, extra = {}) => ({
  name, quantity,
  config: { minutes: 60, leaves: 1, width: 1000, height: 2100, frameId: "block", exposure: "INT", ...extra },
  priced: {
    total: components.reduce((s, c) => s + (c.amount ?? 0), 0),
    onApplication: components.some(c => c.amount == null),
    lines: components,
  },
})

const sample = () => buildQuote({
  project: "Docklands Block C",
  margin: "40", transport: "433.17", labourMen: "2", labourDays: "3", discount: "5",
  lines: [
    line("D-01", "3", [
      { label: "Doorset", detail: "1000 × 2100 mm", amount: 1234.57 },
      { label: "Frame", detail: "block", amount: 61.93 },
      { label: "Handle — passive leaf, outside", detail: "handle on blind long shield standard DFM", amount: 17.41 },
    ]),
    line("D-02", "1", [
      { label: "Doorset", detail: "1000 × 2100 mm", amount: 987.61 },
      { label: "Door closer", detail: "TS 50", amount: 73.19 },
    ]),
    line("D-03", "2", [
      { label: "Doorset", detail: "1000 × 2100 mm", amount: 1111.11 },
      { label: "Frame", detail: "embracing", amount: null },
    ], { frameId: "embracing" }),
  ],
})

/** Every cost figure the internal quote holds, as it would be printed. */
function costFigures(q) {
  const amounts = [q.doorsetsCost, q.transport, q.labour.total, q.subtotal, q.marginAmount]
  for (const d of q.doorsets) {
    if (d.each != null) amounts.push(d.each, d.lineTotal)
    for (const c of d.components) if (c.amount != null) amounts.push(c.amount)
  }
  return [...new Set(amounts.filter(a => a > 0))]
}

const amount = n => n.toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** The words a PDF actually prints — its text operators, not its bytes. */
const pdfText = doc => [...doc.output().matchAll(/\((.*?)\)\s*Tj/g)].map(m => m[1]).join("\n")

const FORBIDDEN_WORDS = ["Margin", "margin", "Labour", "labour", "cost", "Cost", "DFM", "INTERNAL", " men", "450"]

describe("the customer quote", () => {
  it("prices each doorset at cost ÷ (1 − margin)", () => {
    const q = sample()
    const cq = buildCustomerQuote(q)
    const d2 = cq.doorsets.find(d => d.name === "D-02")
    expect(d2.each).toBeCloseTo(q.doorsets[1].each / 0.6, 2)
  })

  it("adds up to exactly the internal total", () => {
    for (const discount of ["0", "3", "5"]) {
      for (const transport of ["0", "433.17"]) {
        const q = buildQuote({ ...sampleInputs(), discount, transport, labourDays: transport === "0" ? "0" : "3" })
        const cq = buildCustomerQuote(q)
        const sum = cq.doorsets.reduce((s, d) => s + (d.lineTotal ?? 0), 0)
        expect(Math.round((sum + cq.delivery) * 100) / 100).toBe(q.beforeDiscount)
        expect(cq.total).toBe(q.total)
      }
    }
  })

  it("keeps the doorsets awaiting a price as price to follow", () => {
    const cq = buildCustomerQuote(sample())
    const d3 = cq.doorsets.find(d => d.name === "D-03")
    expect(d3.each).toBeNull()
    expect(cq.unpriced).toBe(1)
  })

  it("never names the supplier", () => {
    expect(customerPart({ label: "Handle — passive leaf, outside", detail: "handle on blind long shield standard DFM" }))
      .toEqual({ label: "Handle, passive leaf, outside", value: "Handle on blind long shield standard", note: "" })
  })

  it("states the rating and size on their own rows, then each part", () => {
    const d = buildCustomerQuote(sample()).doorsets[0]
    expect(d.spec.map(r => r.label)).toEqual(["Fire rating", "Size", "Frame", "Handle, passive leaf, outside"])
    expect(d.spec[0]).toEqual({
      label: "Fire rating", value: "EI2 60",
      note: "Fire resisting for 60 minutes, integrity and insulation (EN 13501-2)",
    })
    expect(d.spec[1].value).toBe("1000 × 2100 mm")
  })

  it("carries the same reference as the internal breakdown", () => {
    const q = sample()
    const date = new Date("2026-10-14T10:00:00Z")
    expect(buildCustomerQuote(q, date).reference).toBe(quoteReference(q, date))
    expect(quoteReference(q, date)).toMatch(/^Q-20261014-[0-9A-F]{4}$/)
  })
})

describe("what the customer receives", () => {
  it("the PDF shows selling prices and none of our costs", () => {
    const q = sample()
    const cq = buildCustomerQuote(q)
    const text = pdfText(buildCustomerQuotePDF(cq))
    // The search works: the selling figures are there…
    expect(text).toContain(amount(cq.total))
    expect(text).toContain(amount(cq.doorsets[1].each))
    expect(text).toContain("Docklands Block C")
    // …and nothing that gives our pricing away is.
    for (const figure of costFigures(q)) expect(text, `cost ${figure}`).not.toContain(amount(figure))
    for (const word of FORBIDDEN_WORDS) expect(text, word).not.toContain(word)
  })

  it("the spreadsheet holds plain values, one sheet, and none of our costs", async () => {
    const q = sample()
    const cq = buildCustomerQuote(q)
    const wb = await buildCustomerWorkbook(cq)
    expect(wb.worksheets).toHaveLength(1)
    const ws = wb.worksheets[0]
    expect(ws.state).toBe("visible")
    const costs = costFigures(q)
    const values = []
    ws.eachRow({ includeEmpty: true }, row => {
      expect(row.hidden).toBeFalsy()
      row.eachCell({ includeEmpty: true }, cell => {
        expect(cell.formula, `formula in ${cell.address}`).toBeFalsy()
        expect(cell.note, `note in ${cell.address}`).toBeFalsy()
        if (cell.value != null) values.push(cell.value)
      })
    })
    ws.columns.forEach(col => expect(col.hidden).toBeFalsy())
    expect(values).toContain(cq.total)
    for (const v of values) {
      if (typeof v === "number") expect(costs, `cost ${v}`).not.toContain(Math.abs(v))
      if (typeof v === "string") for (const word of FORBIDDEN_WORDS) expect(v, word).not.toContain(word)
    }
  })

  it("the internal breakdown is marked as internal", () => {
    jsPDF.API.save = function () { return this }
    const text = pdfText(buildQuotePDF(sample()))
    expect(text).toContain("INTERNAL")
    expect(text).toContain("NOT FOR CUSTOMERS")
  })
})

function sampleInputs() {
  return {
    project: "Docklands Block C", margin: "40", transport: "433.17", labourMen: "2", labourDays: "3", discount: "5",
    lines: [
      line("A", "3", [{ label: "Doorset", amount: 1234.57 }]),
      line("B", "7", [{ label: "Doorset", amount: 333.33 }]),
      line("C", "1", [{ label: "Doorset", amount: 0.01 }]),
    ],
  }
}
