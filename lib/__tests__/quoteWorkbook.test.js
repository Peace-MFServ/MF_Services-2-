// The spreadsheet is a working document: its totals are formulas, not
// figures, so the estimator can change a highlighted cell in Excel and
// watch the quote rework itself. These tests open the workbook the way
// Excel would and check the arithmetic wired into it — especially the
// division by (1 − margin) that makes margin a share of the sale.

import { describe, it, expect } from "vitest"
import { buildQuote } from "../quote"
import { buildQuoteWorkbook } from "../generateQuoteXLSX"

const line = {
  name: "D-01",
  quantity: "4",
  config: { minutes: 60, leaves: 1, width: 1000, height: 2100, frameId: "corner", exposure: "INT" },
  priced: { total: 2500, onApplication: false, lines: [{ label: "Doorset", amount: 2500 }] },
}

describe("the quote workbook", () => {
  it("writes the selling arithmetic as live formulas", async () => {
    const quote = buildQuote({
      lines: [line], margin: "40", transport: "500",
      labourMen: "2", labourDays: "3", discount: "5", project: "Docklands",
    })
    const wb = await buildQuoteWorkbook(quote)
    const ws = wb.getWorksheet("Quote")

    // Index the totals rows by their labels (column E for most, the
    // labour note in column C).
    const rows = {}
    ws.eachRow(row => {
      const e = row.getCell(5).value
      if (typeof e === "string") rows[e] = row
      const c = row.getCell(3).value
      if (typeof c === "string" && c.startsWith("Labour")) rows.Labour = row
    })

    const formula = (row, col = 6) => row.getCell(col).value?.formula

    // Labour multiplies its two editable cells by the day rate.
    expect(rows.Labour.getCell(4).value).toBe(2)
    expect(rows.Labour.getCell(5).value).toBe(3)
    expect(formula(rows.Labour)).toBe(`D${rows.Labour.number}*E${rows.Labour.number}*450`)

    // Subtotal gathers all three costs.
    expect(formula(rows.Subtotal)).toContain(`F${rows.Labour.number}`)

    // Margin divides the subtotal by (1 − margin%) — a share of the
    // sale, not an addition — with the 40 in an editable cell.
    const marginRow = rows["Margin % of sale"]
    expect(marginRow.getCell(4).value).toBe(40)
    expect(formula(marginRow)).toBe(
      `F${rows.Subtotal.number}/(1-D${marginRow.number}/100)-F${rows.Subtotal.number}`,
    )

    // Discount comes off subtotal + margin, and lands negative.
    const discountRow = rows["Discount % (max 5)"]
    expect(discountRow.getCell(4).value).toBe(5)
    expect(formula(discountRow)).toBe(
      `-(F${rows.Subtotal.number}+F${marginRow.number})*D${discountRow.number}/100`,
    )

    // The total is the sum of the three rows above it.
    expect(formula(rows.TOTAL)).toBe(
      `F${rows.Subtotal.number}+F${marginRow.number}+F${discountRow.number}`,
    )
  })

  it("leaves blank labour and discount as empty editable cells", async () => {
    const quote = buildQuote({
      lines: [line], margin: "40", transport: "",
      labourMen: "2", labourDays: "", discount: "",
    })
    const wb = await buildQuoteWorkbook(quote)
    const ws = wb.getWorksheet("Quote")
    let labourRow, discountRow
    ws.eachRow(row => {
      const c = row.getCell(3).value
      if (typeof c === "string" && c.startsWith("Labour")) labourRow = row
      if (row.getCell(5).value === "Discount % (max 5)") discountRow = row
    })
    // No days entered → no men baked in either; the formula still
    // stands ready for Excel.
    expect(labourRow.getCell(4).value).toBeNull()
    expect(labourRow.getCell(5).value).toBeNull()
    expect(discountRow.getCell(4).value).toBeNull()
  })
})
