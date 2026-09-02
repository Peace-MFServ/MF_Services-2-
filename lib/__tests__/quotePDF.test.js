// A smoke render of the quote PDF: every drawing call runs in node,
// so a broken reference or bad coordinate fails here instead of at
// the moment an estimator presses Download.

import { describe, it, expect } from "vitest"
import { jsPDF } from "jspdf"
import { buildQuote } from "../quote"
import { generateQuotePDF } from "../generateQuotePDF"

describe("quote PDF", () => {
  it("renders a quote, specification notes included, without throwing", async () => {
    jsPDF.API.save = function () { return this }
    const quote = buildQuote({
      lines: [{
        name: "D-01", quantity: "2",
        config: {
          minutes: 120, leaves: 1, width: 1100, height: 2500,
          frameId: "block-thermal", exposure: "EXT", lock: "panic B",
          smokeProtection: "YES", highPerformance: false,
        },
        priced: {
          total: 1268, onApplication: false,
          lines: [{ label: "Doorset", detail: "EI2 120", amount: 1000 }, { label: "Lock", detail: "panic B", amount: 268 }],
        },
      }],
      margin: "40", transport: "200", labourMen: "2", labourDays: "2", discount: "4",
      project: "ZakTest",
    })
    expect(quote.specNotes.length).toBeGreaterThan(0)
    const filename = await generateQuotePDF(quote)
    expect(filename).toMatch(/\.pdf$/)
  })
})
