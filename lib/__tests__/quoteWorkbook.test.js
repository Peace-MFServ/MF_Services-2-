// The internal spreadsheet is a working document: its totals are
// formulas, not figures, so the estimator can change a shaded cell in
// Excel and watch the quote rework itself. These tests open the
// workbook the way Excel would and check the arithmetic wired into it —
// especially the division by (1 − margin) that makes margin a share of
// the sale — and that every formula also carries its figure, so the
// sheet reads right before Excel recalculates.

import { describe, it, expect } from "vitest"
import { buildQuote } from "../quote"
import { buildQuoteWorkbook } from "../generateQuoteXLSX"

const line = {
  name: "D-01",
  quantity: "4",
  config: { minutes: 60, leaves: 1, width: 1000, height: 2100, frameId: "corner", exposure: "INT" },
  priced: { total: 2500, onApplication: false, lines: [{ label: "Doorset", amount: 2500 }] },
}

/** The totals rows, indexed by their labels in column C. */
async function totalsOf(quote) {
  const ws = (await buildQuoteWorkbook(quote)).getWorksheet("Quote")
  const rows = {}
  ws.eachRow(row => {
    const c = row.getCell(3).value
    if (typeof c === "string") rows[c.startsWith("Labour") ? "Labour" : c] = row
  })
  return { ws, rows }
}

const formula = (row, col = 6) => row.getCell(col).value?.formula
const result = (row, col = 6) => row.getCell(col).value?.result

describe("the internal workbook", () => {
  it("writes the selling arithmetic as live formulas", async () => {
    const { rows } = await totalsOf(buildQuote({
      lines: [line], margin: "40", transport: "500",
      labourMen: "2", labourDays: "3", discount: "5", project: "Docklands",
    }))

    // Labour multiplies its two editable cells by the day rate.
    expect(rows.Labour.getCell(4).value).toBe(2)
    expect(rows.Labour.getCell(5).value).toBe(3)
    expect(formula(rows.Labour)).toBe(`D${rows.Labour.number}*E${rows.Labour.number}*450`)

    // Subtotal gathers all three costs.
    const subtotal = rows["Subtotal (cost)"]
    expect(formula(subtotal)).toContain(`F${rows.Labour.number}`)

    // Margin divides the subtotal by (1 − margin%) — a share of the
    // sale, not an addition — with the 40 in an editable cell.
    const margin = rows["Margin — % of sale"]
    expect(margin.getCell(4).value).toBe(40)
    expect(formula(margin)).toBe(`F${subtotal.number}/(1-D${margin.number}/100)-F${subtotal.number}`)

    // Discount comes off subtotal + margin, and lands negative.
    const discount = rows["Discount — %, at most 5"]
    expect(discount.getCell(4).value).toBe(5)
    expect(formula(discount)).toBe(`-(F${subtotal.number}+F${margin.number})*D${discount.number}/100`)

    // The total is the sum of the three rows above it.
    expect(formula(rows["Total (ex. VAT)"])).toBe(`F${subtotal.number}+F${margin.number}+F${discount.number}`)
  })

  it("carries each formula's figure, so the sheet reads right before Excel recalculates", async () => {
    const quote = buildQuote({
      lines: [line], margin: "40", transport: "500",
      labourMen: "2", labourDays: "3", discount: "5",
    })
    const { rows } = await totalsOf(quote)
    expect(result(rows["Doorsets (cost)"])).toBe(quote.doorsetsCost)
    expect(result(rows.Labour)).toBe(quote.labour.total)
    expect(result(rows["Subtotal (cost)"])).toBe(quote.subtotal)
    expect(result(rows["Margin — % of sale"])).toBe(quote.marginAmount)
    expect(result(rows["Discount — %, at most 5"])).toBe(-quote.discountAmount)
    expect(result(rows["Total (ex. VAT)"])).toBe(quote.total)
  })

  it("keeps a doorset with an unpriced part out of the total until it is priced", async () => {
    const tba = {
      ...line, name: "D-02", quantity: "1",
      priced: {
        total: 900, onApplication: true,
        lines: [{ label: "Doorset", amount: 900 }, { label: "Frame", detail: "embracing", amount: null }],
      },
    }
    const { ws } = await totalsOf(buildQuote({ lines: [tba], margin: "40" }))
    let set
    ws.eachRow(row => { if (row.getCell(2).value === "D-02") set = row })
    expect(formula(set, 5)).toMatch(/^IF\(COUNTBLANK\(E\d+:E\d+\)>0,"",SUM\(E\d+:E\d+\)\)$/)
    expect(result(set, 5) ?? "").toBe("")     // shows blank, as "on application"
  })

  it("leaves blank labour and discount as empty editable cells", async () => {
    const { rows } = await totalsOf(buildQuote({
      lines: [line], margin: "40", transport: "",
      labourMen: "2", labourDays: "", discount: "",
    }))
    // No days entered → no men baked in either; the formula still
    // stands ready for Excel.
    expect(rows.Labour.getCell(4).value).toBeNull()
    expect(rows.Labour.getCell(5).value).toBeNull()
    expect(rows["Discount — %, at most 5"].getCell(4).value).toBeNull()
  })
})
