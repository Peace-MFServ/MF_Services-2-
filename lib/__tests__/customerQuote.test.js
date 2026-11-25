// The customer quote must give nothing of our pricing away. These
// tests build the real customer PDF and spreadsheet from a quote whose
// costs are distinctive figures, then search the files themselves for
// any of them — a cost, the margin, the labour, or the supplier's name
// anywhere in what the customer receives fails the build.

import { describe, it, expect } from "vitest"
import { jsPDF } from "jspdf"
import { buildQuote } from "../quote"
import { buildCustomerQuote, customerPart, quoteReference, vatFor } from "../customerQuote"
import { buildCustomerQuotePDF, buildQuotePDF } from "../generateQuotePDF"
import { buildCustomerWorkbook, buildQuoteWorkbook } from "../generateQuoteXLSX"

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
  project: "Docklands Block C", customer: "J. Murphy, ABC Construction",
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

  it("keeps delivery a clean figure — the cents of rounding settle on a single doorset", () => {
    const q = buildQuote({
      ...sampleInputs(), transport: "1200", labourDays: "4", discount: "3",
      lines: [line("A", "1", [{ label: "Doorset", amount: 711.4 }]), line("B", "3", [{ label: "Doorset", amount: 578 }])],
    })
    const cq = buildCustomerQuote(q)
    expect(cq.delivery).toBe(8000)
    expect(cq.doorsets[1].each).toBe(963.33)
    expect(cq.doorsets[0].each).toBe(cq.doorsets[0].lineTotal)
    expect(Math.round((cq.doorsetsTotal + cq.delivery) * 100) / 100).toBe(q.beforeDiscount)
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
    expect(d.spec.map(r => r.label)).toEqual([
      "Fire rating", "Size", "Exposure", "Clear opening", "Leaf size", "Handing", "Frame",
      "Handle, passive leaf, outside",
    ])
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

// Everything ticked in the Pricer belongs on the quote, priced or not:
// handing, exposure, the finish and any part that costs nothing are
// still what is being built.
describe("choices without a price", () => {
  const ticked = () => buildQuote({
    ...sampleInputs(),
    lines: [line("D-09", "2", [
      { label: "Doorset", detail: "1000 × 2100 mm", amount: 1234.57 },
      { label: "Frame", detail: "block", amount: 61.93 },
    ], { handing: "right", ral: "7016", doorCloser: "TS 61 B" })],
  })

  it("join the quote as included rows, costing nothing", () => {
    const q = ticked()
    const parts = Object.fromEntries(q.doorsets[0].components.map(c => [c.label, c]))
    expect(parts.Handing).toMatchObject({ detail: "Right hand", amount: 0, included: true })
    expect(parts.Exposure).toMatchObject({ detail: "Internal", included: true })
    expect(parts["Door closer"]).toMatchObject({ detail: "TS 61 B", included: true })
    expect(parts.Finish).toMatchObject({ detail: "RAL 7016", included: true })
    expect(parts.Frame.included).toBeUndefined()
    expect(q.doorsets[0].each).toBe(1296.5)
  })

  it("read in the order of the specification", () => {
    const labels = ticked().doorsets[0].components.map(c => c.label)
    expect(labels.indexOf("Doorset")).toBe(0)
    expect(labels.indexOf("Handing")).toBeLessThan(labels.indexOf("Frame"))
    expect(labels.indexOf("Frame")).toBeLessThan(labels.indexOf("Door closer"))
    expect(labels.at(-1)).toBe("Finish")
  })

  it("show on the customer quote", () => {
    const spec = Object.fromEntries(buildCustomerQuote(ticked()).doorsets[0].spec.map(r => [r.label, r.value]))
    expect(spec.Handing).toBe("Right hand")
    expect(spec.Exposure).toBe("Internal")
    expect(spec["Door closer"]).toBe("TS 61 B")
    expect(spec.Finish).toBe("RAL 7016")
  })

  it("show as included on the internal PDF", () => {
    jsPDF.API.save = function () { return this }
    const text = pdfText(buildQuotePDF(ticked()))
    expect(text).toContain("Right hand")
    expect(text).toContain("Included")
  })

  it("leave the internal workbook's sums alone", async () => {
    const q = ticked()
    const ws = (await buildQuoteWorkbook(q)).getWorksheet("Quote")
    let handing, set
    ws.eachRow(row => {
      if (row.getCell(2).value === "Handing") handing = row
      if (row.getCell(2).value === "D-09") set = row
    })
    expect(handing.getCell(3).value).toBe("Right hand")
    expect(handing.getCell(5).value).toBe("Included")
    expect(set.getCell(5).value.result).toBe(q.doorsets[0].each)
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
    expect(text).toContain("J. Murphy, ABC Construction")
    expect(text).toContain(amount(cq.doorsets[0].each))         // unit price, its own column
    expect(text).toContain(amount(cq.totalIncVat))
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

// VAT goes on top of the ex-VAT total at the rate picked for each part
// — usually one rate for the lot, but 23% on product with 13.5% on
// labour happens (Liam, November 2026) — and the quote carries the
// header from the MF template.
describe("VAT and the quote header", () => {
  it("charges one rate on the whole total as one line", () => {
    const v = vatFor({ total: 5988.32, delivery: 3500, discountPct: 5, vatRates: { doorsets: 13.5, delivery: 13.5 } })
    expect(v.lines).toHaveLength(1)
    expect(v.lines[0].label).toBe("VAT @ 13.5%")
    expect(v.amount).toBeCloseTo(5988.32 * 0.135, 1)
    expect(v.totalIncVat).toBe(Math.round((5988.32 + v.amount) * 100) / 100)
  })

  it("splits product and labour when their rates differ", () => {
    const v = vatFor({ total: 10000, delivery: 2000, discountPct: 0, vatRates: { doorsets: 23, delivery: 13.5 } })
    expect(v.lines.map(l => l.label)).toEqual(["VAT @ 23% on doorsets", "VAT @ 13.5% on delivery and installation"])
    expect(v.lines.map(l => l.amount)).toEqual([1840, 270])
    expect(v.totalIncVat).toBe(12110)
  })

  it("discounts the delivery's share before taxing it", () => {
    const v = vatFor({ total: 9500, delivery: 2000, discountPct: 5, vatRates: { doorsets: 23, delivery: 13.5 } })
    expect(v.parts.find(p => p.on === "delivery and installation").base).toBe(1900)
    expect(v.parts.find(p => p.on === "doorsets").base).toBe(7600)
  })

  it("prints a zero rate as a zero line", () => {
    const v = vatFor({ total: 1000, delivery: 0, discountPct: 0, vatRates: { doorsets: 0, delivery: 0 } })
    expect(v.lines).toEqual([{ rate: 0, base: 1000, amount: 0, label: "VAT @ 0%" }])
    expect(v.totalIncVat).toBe(1000)
  })

  it("only takes the rates in use, falling back to 23%", () => {
    const q = buildQuote({ ...sampleInputs(), vatDoorsets: "17", vatDelivery: "13.5" })
    expect(q.vatRates).toEqual({ doorsets: 23, delivery: 13.5 })
  })

  it("takes the project as the site until a site is given", () => {
    expect(buildQuote({ ...sampleInputs() }).details.site).toBe("Docklands Block C")
    expect(buildQuote({ ...sampleInputs(), details: { site: "Block C, east core" } }).details.site).toBe("Block C, east core")
  })

  const branded = () => buildQuote({
    ...sampleInputs(), discount: "0", vatDoorsets: "23", vatDelivery: "13.5",
    details: { orderNo: "PO-4471", address1: "Unit 4, Ballycoolin", siteContact: "Mark Byrne", salesperson: "Zak", salespersonEmail: "sales@mfservices.ie" },
  })

  it("the customer PDF carries the header, the VAT and the payment page", () => {
    jsPDF.API.save = function () { return this }
    const cq = buildCustomerQuote(branded())
    const text = pdfText(buildCustomerQuotePDF(cq))
    for (const s of ["5620", "PO-4471", "Valid for 30 days", "Unit 4, Ballycoolin", "Mark Byrne", "Zak",
      "VAT @ 23% on doorsets", "Total inc VAT", amount(cq.totalIncVat), "PAYMENT METHODS", "IE03AIBK93638343211046"]) {
      expect(text, s).toContain(s)
    }
    // No discount given, so no discount line to ask about.
    expect(text).not.toContain("Discount")
  })

  it("the internal PDF ends on the same total, without the payment page", () => {
    jsPDF.API.save = function () { return this }
    const q = branded()
    const text = pdfText(buildQuotePDF(q))
    expect(text).toContain(amount(buildCustomerQuote(q).totalIncVat))
    expect(text).not.toContain("PAYMENT METHODS")
  })

  it("the customer spreadsheet carries the VAT and how to pay", async () => {
    const cq = buildCustomerQuote(branded())
    const ws = (await buildCustomerWorkbook(cq)).worksheets[0]
    const values = []
    ws.eachRow(row => row.eachCell(cell => values.push(cell.value)))
    expect(values).toContain(cq.totalIncVat)
    expect(values.some(v => typeof v === "string" && v.includes("IE03AIBK93638343211046"))).toBe(true)
    expect(values).toContain("5620")
  })
})
