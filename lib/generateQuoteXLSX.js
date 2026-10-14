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
import { quoteReference } from "./customerQuote";

const NAVY = "FF00387B";
const INK = "FF101922";
const MUTED = "FF57646F";
const TINT = "FFE8EEF6";     // set rows — a legible navy tint
const FILLIN = "FFFFF3E8";   // cells the estimator types into
const WARN = "FFB4470E";     // the internal warning band
const MONEY = '€#,##0.00';

// A visible table is the point — thin borders on every cell so the
// sheet reads as a spreadsheet, not text floating on white.
const EDGE = { style: "thin", color: { argb: "FFC4CCD4" } };
const BOX = { top: EDGE, bottom: EDGE, left: EDGE, right: EDGE };

const borderRow = row => {
  for (let c = 1; c <= 6; c++) row.getCell(c).border = BOX;
};

/** Build the workbook. Split from the download so a test can open it. */
export async function buildQuoteWorkbook(quote) {
  const { Workbook } = await import("exceljs");
  const wb = new Workbook();
  // Formulas are written without cached results — make every reader
  // recalculate on open rather than showing zeros until a cell is
  // touched.
  wb.calcProperties.fullCalcOnLoad = true;
  // Gridlines stay on and the header stays put when the quote scrolls.
  const ws = wb.addWorksheet("Quote", {
    views: [{ state: "frozen", ySplit: 5 }],
  });

  ws.columns = [
    { key: "ref", width: 20 },
    { key: "item", width: 32 },
    { key: "detail", width: 50 },
    { key: "qty", width: 7 },
    { key: "unit", width: 13 },
    { key: "total", width: 13 },
  ];

  // Costs, margin and labour live on this sheet — it says so before
  // anything else, across the full width.
  const warning = ws.addRow(["INTERNAL — NOT FOR CUSTOMERS · costs, margin and labour · send the customer quote instead"]);
  ws.mergeCells(warning.number, 1, warning.number, 6);
  warning.getCell(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  warning.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: WARN } };
  warning.height = 20;
  warning.getCell(1).alignment = { vertical: "middle" };

  const title = ws.addRow(["MF Services — internal cost breakdown, steel doorsets"]);
  title.font = { bold: true, size: 14, color: { argb: NAVY } };
  ws.addRow([
    quote.project ? `Project: ${quote.project}` : "",
    `Quote ref. ${quoteReference(quote)}`, "", "", "",
    new Date().toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric" }),
  ]).font = { color: { argb: MUTED } };
  ws.addRow([]);

  const header = ws.addRow(["Doorset", "Item", "Detail", "Qty", "Unit €", "Total €"]);
  header.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
  header.height = 20;
  header.eachCell({ includeEmpty: true }, c => {
    if (c.col > 6) return;
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    c.border = BOX;
    c.alignment = { vertical: "middle" };
  });

  // Rows the grand total will sum — one "line total" cell per doorset.
  const lineTotalCells = [];

  for (const d of quote.doorsets) {
    const setRow = ws.addRow([d.name, d.description, "", d.qty || null]);
    setRow.font = { bold: true, color: { argb: INK } };
    setRow.getCell(4).alignment = { horizontal: "center" };
    setRow.eachCell({ includeEmpty: true }, c => {
      if (c.col > 6) return;
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TINT } };
      c.border = BOX;
    });

    const first = ws.rowCount + 1;
    for (const c of d.components) {
      const detail = [c.detail, c.note].filter(Boolean).join(" — ");
      const row = ws.addRow(["", c.label, detail, "", c.amount]);
      row.getCell(5).numFmt = MONEY;
      // Long manufacturer designations wrap rather than truncate.
      row.getCell(3).alignment = { wrapText: true, vertical: "top" };
      if (c.amount == null) {
        row.getCell(5).fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILLIN } };
        row.getCell(3).value = c.detail ? `${c.detail} — price to be entered` : "price to be entered";
        row.getCell(3).font = { italic: true, color: { argb: MUTED } };
      }
      borderRow(row);
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
    eachRow.font = { bold: true };
    borderRow(eachRow);
    lineTotalCells.push(`F${eachRow.number}`);

    ws.addRow([]);
  }

  // ── Totals, live ────────────────────────────────────────────
  // The estimator's arithmetic, every step on its own row and every
  // figure a real cell: costs sum into a subtotal, the subtotal
  // divides by (1 − margin) — margin is a share of the sale — and
  // the discount comes off the top. Change any highlighted cell and
  // the sheet reworks itself.
  const label = (text, bold = false) => {
    const row = ws.addRow(["", "", "", "", text]);
    row.getCell(5).font = { bold, color: { argb: bold ? INK : MUTED } };
    return row;
  };

  const money = cell => { cell.numFmt = MONEY; cell.border = BOX; };
  const editable = (cell, value) => {
    cell.value = value;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILLIN } };
    cell.border = BOX;
    cell.alignment = { horizontal: "center" };
  };

  const sub = label("Doorsets");
  sub.getCell(6).value = { formula: lineTotalCells.length ? lineTotalCells.join("+") : "0" };
  money(sub.getCell(6));

  const transportRow = label("Transport");
  transportRow.getCell(6).value = quote.transport || null;
  money(transportRow.getCell(6));
  transportRow.getCell(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILLIN } };

  // Labour needs two figures, so its label sits in the detail column
  // and the men and days get the two cells beside the amount.
  const labourRow = ws.addRow(["", "", "Labour — men × days"]);
  labourRow.getCell(3).font = { italic: true, color: { argb: MUTED } };
  labourRow.getCell(3).alignment = { horizontal: "right" };
  editable(labourRow.getCell(4), quote.labour.men || null);
  editable(labourRow.getCell(5), quote.labour.days || null);
  labourRow.getCell(6).value = { formula: `D${labourRow.number}*E${labourRow.number}*450` };
  money(labourRow.getCell(6));

  const subtotalRow = label("Subtotal", true);
  subtotalRow.getCell(6).value = {
    formula: `F${sub.number}+F${transportRow.number}+F${labourRow.number}`,
  };
  money(subtotalRow.getCell(6));
  subtotalRow.getCell(6).font = { bold: true };

  const marginRow = label("Margin % of sale");
  editable(marginRow.getCell(4), quote.marginPct);
  marginRow.getCell(6).value = {
    formula: `F${subtotalRow.number}/(1-D${marginRow.number}/100)-F${subtotalRow.number}`,
  };
  money(marginRow.getCell(6));

  const discountRow = label("Discount % (max 5)");
  editable(discountRow.getCell(4), quote.discountPct || null);
  discountRow.getCell(6).value = {
    formula: `-(F${subtotalRow.number}+F${marginRow.number})*D${discountRow.number}/100`,
  };
  money(discountRow.getCell(6));

  const totalRow = label("TOTAL (ex. VAT)", true);
  totalRow.getCell(6).value = {
    formula: `F${subtotalRow.number}+F${marginRow.number}+F${discountRow.number}`,
  };
  money(totalRow.getCell(6));
  totalRow.getCell(6).font = { bold: true, size: 12 };
  totalRow.getCell(6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: TINT } };

  if (quote.unpriced > 0) {
    ws.addRow([]);
    const note = ws.addRow([
      `${quote.unpriced} doorset${quote.unpriced === 1 ? "" : "s"} ${quote.unpriced === 1 ? "has" : "have"} lines awaiting a price — type the figures into the highlighted cells and the totals recalculate.`,
    ]);
    note.font = { italic: true, color: { argb: MUTED } };
  }
  return wb;
}

/**
 * The customer's spreadsheet: the customer quote, one sheet, plain
 * values only. No formulas — a formula would carry the margin or the
 * day rate inside it — and no hidden sheets, columns or notes. The
 * costs are not left out of this sheet; they were never in the
 * customer quote it is built from.
 */
export async function buildCustomerWorkbook(cq) {
  const { Workbook } = await import("exceljs");
  const wb = new Workbook();
  wb.creator = "MF Services";
  const ws = wb.addWorksheet("Quote", { views: [{ state: "frozen", ySplit: cq.customer ? 8 : 7 }] });
  ws.columns = [
    { key: "doorset", width: 30 },
    { key: "description", width: 70 },
    { key: "qty", width: 7 },
    { key: "each", width: 16 },
    { key: "total", width: 16 },
  ];
  const cells = row => { for (let c = 1; c <= 5; c++) row.getCell(c).border = BOX; };

  const title = ws.addRow(["Quotation — steel doorsets"]);
  title.font = { bold: true, size: 14, color: { argb: NAVY } };
  for (const [label, value] of [
    ["Project", cq.project || "—"],
    ...(cq.customer ? [["Prepared for", cq.customer]] : []),
    ["Quote no.", cq.reference],
    ["Date", new Date().toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric" })],
    ["Doorsets", cq.doorsetCount],
  ]) {
    const row = ws.addRow([label, value]);
    row.getCell(1).font = { color: { argb: MUTED } };
    row.getCell(2).font = { bold: true };
    row.getCell(2).alignment = { horizontal: "left" };
  }
  ws.addRow([]);

  const header = ws.addRow(["Doorset", "Description", "Qty", "Price each", "Total"]);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.height = 20;
  header.eachCell({ includeEmpty: true }, c => {
    if (c.col > 5) return;
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    c.border = BOX;
    c.alignment = { vertical: "middle", horizontal: c.col >= 3 ? "right" : "left" };
  });

  cq.doorsets.forEach((d, i) => {
    const set = ws.addRow([
      `${String(i + 1).padStart(2, "0")}  ${d.name}`, d.description, d.qty || null,
      d.each == null ? "Price to follow" : d.each,
      d.lineTotal,
    ]);
    set.font = { bold: true, color: { argb: INK } };
    set.eachCell({ includeEmpty: true }, c => {
      if (c.col > 5) return;
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TINT } };
      c.border = BOX;
    });
    set.getCell(2).alignment = { wrapText: true, vertical: "top" };
    set.getCell(3).alignment = { horizontal: "center" };
    for (const col of [4, 5]) {
      set.getCell(col).numFmt = MONEY;
      set.getCell(col).alignment = { horizontal: "right" };
    }
    if (d.each == null) set.getCell(4).font = { bold: true, color: { argb: WARN } };
    // The specification, label and value — a note on the line below
    // the value where the pick needs explaining.
    for (const r of d.spec) {
      const row = ws.addRow([r.label, r.note ? `${r.value}\n${r.note}` : r.value]);
      row.getCell(1).font = { color: { argb: MUTED } };
      row.getCell(1).alignment = { indent: 1, vertical: "top" };
      row.getCell(2).alignment = { wrapText: true, vertical: "top" };
      if (r.note) row.height = 30;
      cells(row);
    }
    ws.addRow([]);
  });

  const totalRow = (label, value, bold = false) => {
    const row = ws.addRow(["", "", "", label, value]);
    row.getCell(4).alignment = { horizontal: "right" };
    row.getCell(4).font = { bold, color: { argb: bold ? INK : MUTED } };
    row.getCell(5).numFmt = MONEY;
    row.getCell(5).font = { bold };
    row.getCell(5).border = BOX;
    return row;
  };
  totalRow("Doorsets", cq.doorsetsTotal);
  if (cq.delivery > 0) totalRow("Delivery and installation", cq.delivery);
  if (cq.discountPct > 0) {
    totalRow("Total before discount", cq.beforeDiscount);
    totalRow(`Discount, ${cq.discountPct}%`, -cq.discountAmount);
  }
  const grand = totalRow("TOTAL (ex. VAT)", cq.total, true);
  grand.getCell(5).font = { bold: true, size: 12 };
  grand.getCell(5).fill = { type: "pattern", pattern: "solid", fgColor: { argb: TINT } };

  ws.addRow([]);
  if (cq.unpriced > 0) {
    ws.addRow([`${cq.unpriced} doorset${cq.unpriced === 1 ? " is" : "s are"} priced on application and not included in this total.`])
      .getCell(1).font = { color: { argb: WARN } };
  }
  ws.addRow(["Prices are in euro and exclude VAT."]).getCell(1).font = { color: { argb: MUTED } };
  return wb;
}

/** Hand a built workbook to the browser. */
async function download(wb, filename) {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return filename;
}

/** The internal breakdown, as a working spreadsheet. */
export async function generateQuoteXLSX(quote) {
  return download(await buildQuoteWorkbook(quote), quoteFilename(quote, "xlsx", { internal: true }));
}

/** The customer's spreadsheet. */
export async function generateCustomerQuoteXLSX(cq) {
  const project = cq.project.replace(/\s+/g, "-").toLowerCase() || "untitled";
  return download(await buildCustomerWorkbook(cq), `quote_${project}_${cq.reference}.xlsx`);
}
