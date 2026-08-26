// ─────────────────────────────────────────────────────────────────
// Quote spreadsheet
// ─────────────────────────────────────────────────────────────────
// The quote as a working document rather than a printout: every
// component priced on its own row, and the sums are real Excel
// formulas — type a price into an empty cell, or change the margin,
// and the totals recalculate without coming back to the app. That is
// how an "on application" line gets finished: the estimator fills the
// figure in Excel and the sheet does the rest.
//
// exceljs is loaded on demand — the Pricer is staff-only, so the
// library should not travel in the bundle everyone downloads.
// ─────────────────────────────────────────────────────────────────

import { quoteFilename } from "./quote";

const NAVY = "FF00387B";
const INK = "FF101922";
const MUTED = "FF57646F";
const SUNKEN = "FFF2F5F7";
const MONEY = '€#,##0.00';

/** Build the workbook. Split from the download so a test can open it. */
export async function buildQuoteWorkbook(quote) {
  const { Workbook } = await import("exceljs");
  const wb = new Workbook();
  // Formulas are written without cached results — make every reader
  // recalculate on open rather than showing zeros until a cell is
  // touched.
  wb.calcProperties.fullCalcOnLoad = true;
  const ws = wb.addWorksheet("Quote", {
    properties: { defaultRowHeight: 16 },
    views: [{ showGridLines: false }],
  });

  ws.columns = [
    { key: "ref", width: 22 },
    { key: "item", width: 34 },
    { key: "detail", width: 44 },
    { key: "qty", width: 8 },
    { key: "unit", width: 14 },
    { key: "total", width: 14 },
  ];

  const title = ws.addRow(["MF Services — steel doorset quote"]);
  title.font = { bold: true, size: 14, color: { argb: NAVY } };
  ws.addRow([
    quote.project ? `Project: ${quote.project}` : "",
    "", "", "", "",
    new Date().toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric" }),
  ]).font = { color: { argb: MUTED } };
  ws.addRow([]);

  const header = ws.addRow(["Doorset", "Item", "Detail", "Qty", "Unit €", "Total €"]);
  header.font = { bold: true, size: 10, color: { argb: MUTED } };
  header.border = { bottom: { style: "medium", color: { argb: NAVY } } };

  // Rows the grand total will sum — one "line total" cell per doorset.
  const lineTotalCells = [];

  for (const d of quote.doorsets) {
    const setRow = ws.addRow([d.name, d.description, "", d.qty || null]);
    setRow.font = { bold: true, color: { argb: INK } };
    setRow.eachCell({ includeEmpty: true }, c => {
      if (c.col <= 6) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SUNKEN } };
    });

    const first = ws.rowCount + 1;
    for (const c of d.components) {
      const row = ws.addRow(["", c.label, c.detail, "", c.amount]);
      row.getCell(5).numFmt = MONEY;
      if (c.amount == null) {
        row.getCell(5).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3E8" } };
        row.getCell(3).value = c.detail ? `${c.detail} — price to be entered` : "price to be entered";
        row.getCell(3).font = { italic: true, color: { argb: MUTED } };
      }
    }
    const last = ws.rowCount;

    // Each = the sum of its parts; line total = each × how many.
    const eachRow = ws.addRow(["", `Each, ${d.name}`]);
    eachRow.font = { bold: true };
    const eachCell = eachRow.getCell(5);
    if (last >= first) eachCell.value = { formula: `SUM(E${first}:E${last})` };
    eachCell.numFmt = MONEY;
    const totalCell = eachRow.getCell(6);
    totalCell.value = { formula: `E${eachRow.number}*D${setRow.number}` };
    totalCell.numFmt = MONEY;
    totalCell.font = { bold: true };
    eachRow.border = { bottom: { style: "thin", color: { argb: "FFC4CCD4" } } };
    lineTotalCells.push(`F${eachRow.number}`);

    ws.addRow([]);
  }

  // ── Totals, live ────────────────────────────────────────────
  const label = (text, bold = false) => {
    const row = ws.addRow(["", "", "", "", text]);
    row.getCell(5).font = { bold, color: { argb: bold ? INK : MUTED } };
    return row;
  };

  const sub = label("Doorsets");
  sub.getCell(6).value = { formula: lineTotalCells.length ? lineTotalCells.join("+") : "0" };
  sub.getCell(6).numFmt = MONEY;

  const marginRow = label("Margin %");
  marginRow.getCell(4).value = quote.markupPct;
  marginRow.getCell(4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3E8" } };
  marginRow.getCell(6).value = { formula: `F${sub.number}*D${marginRow.number}/100` };
  marginRow.getCell(6).numFmt = MONEY;

  const transportRow = label("Transport");
  transportRow.getCell(6).value = quote.transport || null;
  transportRow.getCell(6).numFmt = MONEY;
  transportRow.getCell(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3E8" } };

  const totalRow = label("TOTAL", true);
  totalRow.getCell(6).value = { formula: `F${sub.number}+F${marginRow.number}+F${transportRow.number}` };
  totalRow.getCell(6).numFmt = MONEY;
  totalRow.getCell(6).font = { bold: true, size: 12 };
  totalRow.border = { top: { style: "medium", color: { argb: NAVY } } };

  if (quote.unpriced > 0) {
    ws.addRow([]);
    const note = ws.addRow([
      `${quote.unpriced} doorset${quote.unpriced === 1 ? "" : "s"} ${quote.unpriced === 1 ? "has" : "have"} lines awaiting a price — type the figures into the highlighted cells and the totals recalculate.`,
    ]);
    note.font = { italic: true, color: { argb: MUTED } };
  }
  ws.addRow(["Internal document — carries cost breakdown. Prices ex-works EUR, manufacturer's October 2025 list."])
    .font = { italic: true, size: 9, color: { argb: MUTED } };

  return wb;
}

/** Build and hand the file to the browser. */
export async function generateQuoteXLSX(quote) {
  const wb = await buildQuoteWorkbook(quote);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const filename = quoteFilename(quote, "xlsx");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return filename;
}
