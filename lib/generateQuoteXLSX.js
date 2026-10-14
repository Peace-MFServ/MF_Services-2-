// ─────────────────────────────────────────────────────────────────
// Quote spreadsheets — internal breakdown and customer quote
// ─────────────────────────────────────────────────────────────────
// Both follow the quote PDFs: the title, the quote's facts, then one
// table — a numbered row per doorset with its parts beneath — and the
// totals, ending on a navy total row.
//
// The internal breakdown is a working document: every part priced on
// its own row and the sums are real Excel formulas, so an estimator
// can fill in a part still to be priced, or change the margin, and the
// totals rework themselves. The shaded cells are the ones to change.
// Each formula also carries the figure it works out to, so the sheet
// reads correctly the moment it is opened — before Excel recalculates,
// and in Protected View, where it does not.
//
// The customer's spreadsheet holds plain values only: a formula would
// carry the margin or the day rate inside it.
//
// exceljs is loaded on demand — the Pricer is staff-only, so the
// library should not travel in the bundle everyone downloads.
// ─────────────────────────────────────────────────────────────────

import { quoteFilename, LABOUR_RATE } from "./quote";
import { quoteReference, customerPart } from "./customerQuote";

const NAVY = "FF00387B";
const INK = "FF101922";
const MUTED = "FF57646F";
const WHITE = "FFFFFFFF";
const TINT = "FFE8EEF6";     // doorset rows — a legible navy tint
const FILLIN = "FFFFF3E8";   // cells the estimator may change
const WARN = "FFB4470E";     // the internal warning bar
const MONEY = '€#,##0.00';

const EDGE = { style: "thin", color: { argb: "FFC4CCD4" } };
const BOX = { top: EDGE, bottom: EDGE, left: EDGE, right: EDGE };
const solid = argb => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

const COLS = 6;
const today = () => new Date().toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric" });

/**
 * The frame both spreadsheets share: optional warning bar, title,
 * the quote's facts and the table header. Returns the sheet and a
 * few helpers for writing rows inside the frame.
 */
function sheetFrame(wb, { warning, title, facts, columns }) {
  const ws = wb.addWorksheet("Quote");
  ws.columns = [
    { key: "no", width: 5 },
    { key: "item", width: 30 },
    { key: "detail", width: 54 },
    { key: "qty", width: 9 },
    { key: "each", width: 15 },
    { key: "total", width: 16 },
  ];

  const full = (text, { font, fill, height } = {}) => {
    const row = ws.addRow([text]);
    ws.mergeCells(row.number, 1, row.number, COLS);
    row.getCell(1).font = font ?? {};
    if (fill) row.getCell(1).fill = solid(fill);
    row.getCell(1).alignment = { vertical: "middle", wrapText: true };
    if (height) row.height = height;
    return row;
  };

  if (warning) full(warning, { font: { bold: true, color: { argb: WHITE } }, fill: WARN, height: 20 });
  full(title, { font: { bold: true, size: 16, color: { argb: NAVY } }, height: 28 });
  ws.addRow([]);
  for (const [label, value] of facts) {
    const row = ws.addRow(["", label, value]);
    row.getCell(2).font = { color: { argb: MUTED } };
    row.getCell(3).font = { bold: true };
    row.getCell(3).alignment = { horizontal: "left" };
  }
  ws.addRow([]);

  const header = ws.addRow(["#", "Description", "", "Qty", columns[0], columns[1]]);
  ws.mergeCells(header.number, 2, header.number, 3);
  header.height = 20;
  for (let c = 1; c <= COLS; c++) {
    const cell = header.getCell(c);
    cell.font = { bold: true, color: { argb: WHITE } };
    cell.fill = solid(NAVY);
    cell.alignment = { vertical: "middle", horizontal: c === 4 ? "center" : c >= 5 ? "right" : "left" };
  }
  ws.views = [{ state: "frozen", ySplit: header.number }];

  const boxed = row => { for (let c = 1; c <= COLS; c++) row.getCell(c).border = BOX; return row; };

  /** A doorset's own row: number, name, description, quantity. */
  const doorsetRow = (i, d) => {
    const row = boxed(ws.addRow([i + 1, d.name, d.description, d.qty || null]));
    for (let c = 1; c <= COLS; c++) row.getCell(c).fill = solid(TINT);
    row.font = { bold: true, color: { argb: INK } };
    row.getCell(1).alignment = { horizontal: "center", vertical: "top" };
    row.getCell(2).alignment = { vertical: "top", wrapText: true };
    row.getCell(3).font = { color: { argb: INK } };
    row.getCell(3).alignment = { vertical: "top", wrapText: true };
    row.getCell(4).alignment = { horizontal: "center", vertical: "top" };
    return row;
  };

  /** A part beneath its doorset: label, then the pick with its note. */
  const partRow = part => {
    const row = boxed(ws.addRow(["", part.label, part.note ? `${part.value}\n${part.note}` : part.value]));
    row.getCell(2).font = { color: { argb: MUTED } };
    row.getCell(2).alignment = { indent: 1, vertical: "top", wrapText: true };
    row.getCell(3).alignment = { vertical: "top", wrapText: true };
    if (part.note) row.height = 30;
    return row;
  };

  /** A totals row: label right-aligned beside the amount column. */
  const totalRow = (label, { bold = false, ruleAbove = false } = {}) => {
    const row = ws.addRow(["", "", label]);
    row.getCell(3).alignment = { horizontal: "right" };
    row.getCell(3).font = { bold, color: { argb: bold ? INK : MUTED } };
    row.getCell(6).numFmt = MONEY;
    row.getCell(6).border = BOX;
    row.getCell(6).font = { bold };
    if (ruleAbove) for (let c = 3; c <= COLS; c++) row.getCell(c).border = { ...row.getCell(c).border, top: { style: "thin", color: { argb: INK } } };
    return row;
  };

  /** The total, on navy, as the PDFs end. */
  const grandRow = () => {
    const row = ws.addRow(["", "", "Total (ex. VAT)"]);
    row.height = 22;
    for (let c = 3; c <= COLS; c++) {
      row.getCell(c).fill = solid(NAVY);
      row.getCell(c).font = { bold: true, size: 12, color: { argb: WHITE } };
      row.getCell(c).alignment = { vertical: "middle", horizontal: c === 3 ? "left" : "right" };
    }
    row.getCell(6).numFmt = MONEY;
    return row;
  };

  const note = (text, colour = MUTED) => full(text, { font: { color: { argb: colour } } });

  return { ws, doorsetRow, partRow, totalRow, grandRow, note };
}

const editable = (cell, value, numFmt) => {
  cell.value = value;
  cell.fill = solid(FILLIN);
  cell.border = BOX;
  cell.alignment = { horizontal: "center" };
  if (numFmt) cell.numFmt = numFmt;
};

const unpricedNote = n =>
  `${n} doorset${n === 1 ? " is" : "s are"} priced on application and not included in this total.`;

/** The internal breakdown. Split from the download so a test can open it. */
export async function buildQuoteWorkbook(quote) {
  const { Workbook } = await import("exceljs");
  const wb = new Workbook();
  wb.calcProperties.fullCalcOnLoad = true;
  const reference = quoteReference(quote);

  const { ws, doorsetRow, partRow, totalRow, grandRow, note } = sheetFrame(wb, {
    warning: "INTERNAL — NOT FOR CUSTOMERS · costs, margin and labour · send the customer quote instead",
    title: "Cost breakdown — steel doorsets",
    facts: [
      ["Quote no.", reference], ["Date", today()], ["Project", quote.project || "—"],
      ...(quote.customer ? [["Prepared for", quote.customer]] : []),
    ],
    columns: ["Each (cost)", "Total (cost)"],
  });

  let firstSet = null;
  let lastSet = null;
  quote.doorsets.forEach((d, i) => {
    const set = doorsetRow(i, d);
    firstSet ??= set.number;
    lastSet = set.number;

    const first = ws.rowCount + 1;
    for (const c of d.components) {
      const row = partRow(customerPart(c));
      const cost = row.getCell(5);
      cost.numFmt = MONEY;
      if (c.amount == null) editable(cost, null, MONEY);
      else cost.value = c.amount;
    }
    const last = ws.rowCount;

    // Each = the sum of its parts once every part has a price — an
    // unpriced part leaves the doorset on application, as in the PDF.
    const each = set.getCell(5);
    each.numFmt = MONEY;
    if (last >= first) {
      each.value = {
        formula: `IF(COUNTBLANK(E${first}:E${last})>0,"",SUM(E${first}:E${last}))`,
        result: d.each ?? "",
      };
    }
    const lineTotal = set.getCell(6);
    lineTotal.numFmt = MONEY;
    lineTotal.value = { formula: `IF(E${set.number}="","",E${set.number}*D${set.number})`, result: d.lineTotal ?? "" };
    if (d.each == null) set.getCell(5).font = { bold: true, color: { argb: WARN } };

    ws.addRow([]);
  });

  // ── Totals, live ────────────────────────────────────────────
  // The estimator's arithmetic, every step its own row: costs sum to
  // a subtotal, the subtotal divides by (1 − margin) — margin is a
  // share of the sale — and the discount comes off the top.
  const doorsets = totalRow("Doorsets (cost)");
  doorsets.getCell(6).value = firstSet
    ? { formula: `SUM(F${firstSet}:F${lastSet})`, result: quote.doorsetsCost }
    : 0;

  const transport = totalRow("Transport (cost)");
  editable(transport.getCell(6), quote.transport || null, MONEY);
  transport.getCell(6).alignment = { horizontal: "right" };

  const labour = totalRow(`Labour — men × days × €${LABOUR_RATE}`);
  editable(labour.getCell(4), quote.labour.men || null, '0 "men"');
  editable(labour.getCell(5), quote.labour.days || null, '0 "days"');
  labour.getCell(6).value = {
    formula: `D${labour.number}*E${labour.number}*${LABOUR_RATE}`, result: quote.labour.total,
  };

  const subtotal = totalRow("Subtotal (cost)", { bold: true, ruleAbove: true });
  subtotal.getCell(6).value = {
    formula: `F${doorsets.number}+F${transport.number}+F${labour.number}`, result: quote.subtotal,
  };

  const margin = totalRow("Margin — % of sale");
  editable(margin.getCell(4), quote.marginPct, '0"%"');
  margin.getCell(6).value = {
    formula: `F${subtotal.number}/(1-D${margin.number}/100)-F${subtotal.number}`, result: quote.marginAmount,
  };

  const discount = totalRow("Discount — %, at most 5");
  editable(discount.getCell(4), quote.discountPct || null, '0"%"');
  discount.getCell(6).value = {
    formula: `-(F${subtotal.number}+F${margin.number})*D${discount.number}/100`, result: -quote.discountAmount,
  };

  const grand = grandRow();
  grand.getCell(6).value = {
    formula: `F${subtotal.number}+F${margin.number}+F${discount.number}`, result: quote.total,
  };

  ws.addRow([]);
  if (quote.unpriced > 0) note(unpricedNote(quote.unpriced), WARN);
  note(`Same total as customer quote ${reference}.`);
  note("Prices are in euro and exclude VAT.");
  note("Shaded cells can be changed — a missing price, the transport, labour, margin or discount — and the totals recalculate.");
  return wb;
}

/**
 * The customer's spreadsheet: the customer quote, one sheet, plain
 * values only — no formulas, no hidden sheets, columns or notes. The
 * costs are not left out of this sheet; they were never in the
 * customer quote it is built from.
 */
export async function buildCustomerWorkbook(cq) {
  const { Workbook } = await import("exceljs");
  const wb = new Workbook();
  wb.creator = "MF Services";

  const { ws, doorsetRow, partRow, totalRow, grandRow, note } = sheetFrame(wb, {
    title: "Quotation — steel doorsets",
    facts: [
      ["Quote no.", cq.reference], ["Date", today()], ["Project", cq.project || "—"],
      ...(cq.customer ? [["Prepared for", cq.customer]] : []),
    ],
    columns: ["Price each", "Amount"],
  });

  cq.doorsets.forEach((d, i) => {
    const set = doorsetRow(i, d);
    for (const col of [5, 6]) {
      set.getCell(col).numFmt = MONEY;
      set.getCell(col).alignment = { horizontal: "right", vertical: "top" };
    }
    if (d.each == null) {
      set.getCell(5).value = "Price to follow";
      set.getCell(5).font = { bold: true, color: { argb: WARN } };
    } else {
      set.getCell(5).value = d.each;
      set.getCell(6).value = d.lineTotal;
    }
    for (const r of d.spec) partRow(r);
    ws.addRow([]);
  });

  totalRow("Doorsets").getCell(6).value = cq.doorsetsTotal;
  if (cq.delivery > 0) totalRow("Delivery and installation").getCell(6).value = cq.delivery;
  if (cq.discountPct > 0) {
    totalRow("Total before discount", { ruleAbove: true }).getCell(6).value = cq.beforeDiscount;
    totalRow(`Discount, ${cq.discountPct}%`).getCell(6).value = -cq.discountAmount;
  }
  grandRow().getCell(6).value = cq.total;

  ws.addRow([]);
  if (cq.unpriced > 0) note(unpricedNote(cq.unpriced), WARN);
  note("Prices are in euro and exclude VAT.");
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
