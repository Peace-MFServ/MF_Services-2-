import { jsPDF } from "jspdf";
import { LOGO_DATA_URI } from "./logo";
import { quoteFilename } from "./quote";
import { quoteReference } from "./customerQuote";

// ─────────────────────────────────────────────────────────────────
// Quote PDFs — internal breakdown and customer quote
// ─────────────────────────────────────────────────────────────────
// The same house sheet as the specifications: navy band, project
// strip, footer. One block per doorset — the set line in bold, its
// parts beneath — then the totals.
//
// The internal breakdown carries every cost, the margin and the
// labour, so it is marked on every page — an orange band under the
// title and an orange footer — and its filename starts INTERNAL_.
// The customer quote renders the customer quote object only
// (lib/customerQuote.js), which holds selling prices and nothing else.
// ─────────────────────────────────────────────────────────────────

const NAVY   = "#00387B";
const INK    = "#101922";
const BODY   = "#2B3641";
const MUTED  = "#57646F";
const RULE   = "#C4CCD4";
const SUNKEN = "#F2F5F7";
const WARN   = "#B4470E";

const CONTACT = { phone: "021 434 8996", website: "www.mfservices.ie" };

const fill   = (d, hex) => d.setFillColor(hex);
const stroke = (d, hex) => d.setDrawColor(hex);
const ink    = (d, hex) => d.setTextColor(hex);

const euro = n => "€" + n.toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The navy title band, an optional warning band beneath it, and the
 *  project strip. Returns the y the content starts at. */
function sheetHeader(doc, { title, warning, meta }) {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const cW = pageW - margin * 2;
  fill(doc, NAVY); doc.rect(0, 0, pageW, 21, "F");
  doc.setFont("helvetica", "normal"); doc.setFontSize(15); ink(doc, "#FFFFFF");
  doc.text(title, margin, 13.5);
  let y = 27;
  if (warning) {
    fill(doc, WARN); doc.rect(0, 21, pageW, 8, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); ink(doc, "#FFFFFF");
    doc.text(warning[0], margin, 26.2);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text(warning[1], pageW - margin, 26.2, { align: "right" });
    y = 35;
  }
  doc.addImage(LOGO_DATA_URI, "JPEG", pageW - margin - 26, y - 1.5, 26, 5.2);
  const colW = (cW - 30) / meta.length;
  meta.forEach(([label, value], i) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); ink(doc, MUTED);
    doc.text(label.toUpperCase(), margin + i * colW, y);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); ink(doc, INK);
    doc.text(doc.splitTextToSize(value, colW - 5)[0] ?? "", margin + i * colW, y + 5);
  });
  y += 11;
  stroke(doc, RULE); doc.setLineWidth(0.25);
  doc.line(margin, y, pageW - margin, y);
  return y + 7;
}

/** The footer on every page, in the colour that says who it is for. */
function sheetFooter(doc, { text, colour }) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    fill(doc, colour); doc.rect(0, pageH - 14, pageW, 14, "F");
    fill(doc, "#FFFFFF"); doc.rect(margin, pageH - 8.2, 2.4, 2.4, "F");
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); ink(doc, "#FFFFFF");
    doc.text(text, margin + 5.5, pageH - 6.2);
    doc.setFontSize(8);
    doc.text(`${p} / ${total}`, pageW - margin, pageH - 6.2, { align: "right" });
  }
}

const today = () => new Date().toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric" });

/** The internal breakdown — every cost, the margin and the labour. */
export function buildQuotePDF(quote) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const cW = pageW - margin * 2;
  const bottom = pageH - 20;

  const reference = quoteReference(quote);

  // Column x positions, right-aligned money.
  const xQty = margin + cW - 74;
  const xEach = margin + cW - 44;
  const xTotal = margin + cW;

  let y;

  const breakIfNeeded = need => {
    if (y + need <= bottom) return;
    doc.addPage();
    y = margin + 4;
  };

  y = sheetHeader(doc, {
    title: "Steel doorsets — internal cost breakdown",
    warning: ["INTERNAL — NOT FOR CUSTOMERS", "Costs, margin and labour · send the customer quote instead"],
    meta: [["Project", quote.project || "—"], ["Quote ref.", reference], ["Date", today()]],
  });

  // ══ Column headings ═════════════════════════════════════════
  const headings = () => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); ink(doc, MUTED);
    doc.text("DOORSET", margin, y);
    doc.text("QTY", xQty, y, { align: "right" });
    doc.text("EACH (COST)", xEach, y, { align: "right" });
    doc.text("TOTAL (COST)", xTotal, y, { align: "right" });
    y += 2;
    stroke(doc, NAVY); doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 5;
  };
  headings();

  // ══ Doorsets ════════════════════════════════════════════════
  for (const d of quote.doorsets) {
    breakIfNeeded(16 + d.components.length * 4.2);

    // The set line
    fill(doc, SUNKEN); doc.rect(margin, y - 3.6, cW, 6.4, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); ink(doc, INK);
    doc.text(d.name, margin + 2, y + 0.6);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(String(d.qty || "—"), xQty, y + 0.6, { align: "right" });
    doc.setFont("helvetica", "bold");
    ink(doc, d.each == null ? WARN : INK);
    doc.text(d.each == null ? "on application" : euro(d.each), xEach, y + 0.6, { align: "right" });
    if (d.lineTotal != null) doc.text(euro(d.lineTotal), xTotal, y + 0.6, { align: "right" });
    y += 6.2;

    if (d.description) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); ink(doc, MUTED);
      doc.text(doc.splitTextToSize(d.description, cW - 40)[0], margin + 2, y);
      y += 4.4;
    }

    // Its parts — the pick, what it means where that matters, and the
    // price, on the one line (wrapping when the words need room).
    doc.setFontSize(8);
    for (const c of d.components) {
      const text = [c.label, c.detail, c.note].filter(Boolean).join(" — ");
      // Stop the words well short of the price column.
      const wrapped = doc.splitTextToSize(text, cW - 70);
      breakIfNeeded(wrapped.length * 4.2 + 0.4);
      ink(doc, BODY);
      wrapped.forEach((l, i) => doc.text(l, margin + 6, y + i * 4.2));
      if (c.amount == null) {
        ink(doc, WARN);
        doc.text("t.b.a.", xEach, y, { align: "right" });
      } else {
        ink(doc, INK);
        doc.text(euro(c.amount), xEach, y, { align: "right" });
      }
      y += wrapped.length * 4.2;
    }

    stroke(doc, RULE); doc.setLineWidth(0.15);
    doc.line(margin, y - 1, pageW - margin, y - 1);
    y += 3.4;
  }

  // ══ Totals ══════════════════════════════════════════════════
  // Costs first, ruled off into a subtotal; then the margin on the
  // sale (subtotal ÷ (1 − margin)) and the discount off the top.
  breakIfNeeded(48);
  const lab = quote.labour;
  const costRows = [
    ["Doorsets (cost)", euro(quote.doorsetsCost)],
    ["Transport (cost)", euro(quote.transport)],
    [
      lab.total > 0
        ? `Labour, ${lab.men} men × ${lab.days} day${lab.days === 1 ? "" : "s"}`
        : "Labour",
      euro(lab.total),
    ],
  ];
  const sellRows = [
    [`Margin, ${quote.marginPct}% of sale`, euro(quote.marginAmount)],
    ...(quote.discountPct > 0
      ? [[`Discount, ${quote.discountPct}%`, "-" + euro(quote.discountAmount)]]
      : []),
  ];
  const boxX = margin + cW - 88;
  const totalsRow = (label, value, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(9); ink(doc, bold ? INK : BODY);
    doc.text(label, boxX, y);
    doc.setFont("helvetica", "bold"); ink(doc, INK);
    doc.text(value, xTotal, y, { align: "right" });
    y += 5.4;
  };
  for (const [label, value] of costRows) totalsRow(label, value);
  stroke(doc, RULE); doc.setLineWidth(0.25);
  doc.line(boxX, y - 2.4, pageW - margin, y - 2.4);
  totalsRow("Subtotal (cost)", euro(quote.subtotal), true);
  for (const [label, value] of sellRows) totalsRow(label, value);
  stroke(doc, NAVY); doc.setLineWidth(0.5);
  doc.line(boxX, y - 2.4, pageW - margin, y - 2.4);
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); ink(doc, INK);
  doc.text("TOTAL (ex. VAT)", boxX, y + 2.4);
  doc.text(euro(quote.total), xTotal, y + 2.4, { align: "right" });
  y += 9;

  if (quote.unpriced > 0) {
    breakIfNeeded(8);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); ink(doc, WARN);
    doc.text(
      `${quote.unpriced} doorset${quote.unpriced === 1 ? " is" : "s are"} on application and not included in this total.`,
      margin, y,
    );
    y += 6;
  }

  breakIfNeeded(8);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); ink(doc, MUTED);
  doc.text(`Same total as customer quote ${reference}.`, margin, y);

  sheetFooter(doc, { text: "MF SERVICES  ·  INTERNAL — NOT FOR CUSTOMERS", colour: WARN });
  return doc;
}

export async function generateQuotePDF(quote) {
  const doc = buildQuotePDF(quote);
  const filename = quoteFilename(quote, "pdf", { internal: true });
  doc.save(filename);
  return filename;
}

// ══ The customer quote ═══════════════════════════════════════════
// A classic quotation: the logo and QUOTATION across the top with the
// quote's number, date and project; who it is from and who it is for;
// then one numbered row per doorset — its description and its
// specification in a two-column grid of labelled values — with the
// quantity and one amount. A quantity above one shows "3 × €985.00"
// under the amount rather than a second price column. The totals
// close it with the total on a navy bar. Renders a customer quote
// (lib/customerQuote.js) — selling prices only.

const GRID_RULE = "#DDE3EA";

/** Text spaced out by `cs` mm per gap, ending at `right`. */
function spacedRight(doc, text, right, y, cs) {
  const w = doc.getTextWidth(text) + cs * (text.length - 1);
  doc.text(text, right - w, y, { charSpace: cs });
}

/** What the customer is sent: their doorsets, what is in them, and
 *  selling prices. */
export function buildCustomerQuotePDF(cq) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const cW = pageW - margin * 2;
  const right = pageW - margin;
  const bottom = pageH - 22;

  // Table columns
  const xNo = margin + 3;
  const xDesc = margin + 11;
  const xQty = right - 40;
  const xAmount = right - 3;
  const descW = xQty - 9 - xDesc;
  const colGap = 6;
  const cellW = (descW - colGap) / 2;

  // ── Logo, title and the quote's facts ─────────────────────
  doc.addImage(LOGO_DATA_URI, "JPEG", margin, 13, 40, 8);
  doc.setFont("helvetica", "bold"); doc.setFontSize(22); ink(doc, NAVY);
  spacedRight(doc, "QUOTATION", right, 22, 1.4);
  const facts = [["Quote no.", cq.reference], ["Date", today()], ["Project", cq.project || "—"]];
  facts.forEach(([label, value], i) => {
    const fy = 30 + i * 5;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); ink(doc, MUTED);
    doc.text(label, right - 42, fy, { align: "right" });
    doc.setFont("helvetica", "bold"); ink(doc, INK);
    doc.text(doc.splitTextToSize(value, 38)[0] ?? "", right, fy, { align: "right" });
  });

  // ── From and prepared for ─────────────────────────────────
  const heading = (text, x, at) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); ink(doc, MUTED);
    doc.text(text, x, at, { charSpace: 0.4 });
  };
  heading("FROM", margin, 46);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); ink(doc, INK);
  doc.text("MF Services", margin, 51);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); ink(doc, BODY);
  doc.text("Door systems", margin, 55.4);
  doc.text(`${CONTACT.phone} · ${CONTACT.website}`, margin, 59.8);
  if (cq.customer) {
    heading("PREPARED FOR", margin + 83, 46);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); ink(doc, INK);
    doc.splitTextToSize(cq.customer, cW - 83).slice(0, 3)
      .forEach((l, i) => doc.text(l, margin + 83, 51 + i * 4.4));
  }

  // ── Lay everything out before drawing any of it ───────────
  // Heights are known up front, so a doorset moves whole to the next
  // page, and the last one goes with the totals rather than leaving
  // them stranded on a page of their own.
  const items = cq.doorsets.map(d => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    const desc = doc.splitTextToSize(d.description, descW);
    const cells = d.spec.map(r => {
      doc.setFontSize(8.5);
      const value = doc.splitTextToSize(r.value, cellW);
      doc.setFontSize(7);
      const note = r.note ? doc.splitTextToSize(r.note, cellW) : [];
      return { ...r, value, note, h: 2.8 + value.length * 3.5 + note.length * 2.9 + 1.5 };
    });
    const gridRows = [];
    for (let k = 0; k < cells.length; k += 2) {
      const pair = cells.slice(k, k + 2);
      gridRows.push({ cells: pair, h: Math.max(...pair.map(c => c.h)) });
    }
    const gridH = gridRows.reduce((sum, r) => sum + r.h, 0);
    return { d, desc, gridRows, h: 10.7 + desc.length * 3.9 + gridH };
  });

  const lines = [["Doorsets", euro(cq.doorsetsTotal)]];
  if (cq.delivery > 0) lines.push(["Delivery and installation", euro(cq.delivery)]);
  if (cq.discountPct > 0) {
    lines.push(["Total before discount", euro(cq.beforeDiscount)]);
    lines.push([`Discount, ${cq.discountPct}%`, "-" + euro(cq.discountAmount)]);
  }
  const totalsH = 8 + lines.length * 6 + 12;

  // ── The table ─────────────────────────────────────────────
  let y = 68;
  const tableHead = () => {
    fill(doc, NAVY); doc.rect(margin, y, cW, 8, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); ink(doc, "#FFFFFF");
    doc.text("#", xNo, y + 5.2);
    doc.text("DESCRIPTION", xDesc, y + 5.2, { charSpace: 0.35 });
    doc.text("QTY", xQty, y + 5.2, { align: "center" });
    doc.text("AMOUNT", xAmount, y + 5.2, { align: "right" });
    y += 8;
  };
  // A continuation page says what it continues.
  const newPage = withTable => {
    doc.addPage();
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); ink(doc, MUTED);
    doc.text(`QUOTATION  ${cq.reference}`, margin, 15, { charSpace: 0.3 });
    doc.setFont("helvetica", "normal");
    doc.text("continued", right, 15, { align: "right" });
    y = 20;
    if (withTable) tableHead();
  };
  tableHead();
  let pageTop = y;

  items.forEach((item, i) => {
    const last = i === items.length - 1;
    const need = item.h + (last ? totalsH : 0);
    if (y + need > bottom && y > pageTop) { newPage(true); pageTop = y; }

    const { d, desc, gridRows } = item;
    const top = y + 5;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); ink(doc, MUTED);
    doc.text(String(i + 1), xNo, top);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); ink(doc, INK);
    doc.text(doc.splitTextToSize(d.name, descW)[0] ?? "", xDesc, top);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); ink(doc, BODY);
    desc.forEach((l, k) => doc.text(l, xDesc, top + 4.6 + k * 3.9));

    // Quantity and the one amount
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); ink(doc, INK);
    doc.text(String(d.qty || "—"), xQty, top, { align: "center" });
    if (d.lineTotal == null) {
      doc.setFont("helvetica", "bold"); ink(doc, WARN);
      doc.text("Price to follow", xAmount, top, { align: "right" });
    } else {
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); ink(doc, INK);
      doc.text(euro(d.lineTotal), xAmount, top, { align: "right" });
      if (d.qty > 1) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); ink(doc, MUTED);
        doc.text(`${d.qty} × ${euro(d.each)}`, xAmount, top + 4.2, { align: "right" });
      }
    }

    // The specification, two labelled values to a row
    let gy = top + 4.6 + (desc.length - 1) * 3.9 + 2.4;
    for (const row of gridRows) {
      row.cells.forEach((c, k) => {
        const cx = xDesc + k * (cellW + colGap);
        stroke(doc, GRID_RULE); doc.setLineWidth(0.2); doc.setLineDashPattern([0.5, 0.6], 0);
        doc.line(cx, gy, cx + cellW, gy);
        doc.setLineDashPattern([], 0);
        doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); ink(doc, MUTED);
        doc.text(doc.splitTextToSize(c.label.toUpperCase(), cellW)[0] ?? "", cx, gy + 2.8, { charSpace: 0.2 });
        doc.setFontSize(8.5); ink(doc, INK);
        c.value.forEach((l, j) => doc.text(l, cx, gy + 6.1 + j * 3.5));
        doc.setFontSize(7); ink(doc, MUTED);
        c.note.forEach((l, j) => doc.text(l, cx, gy + 5.9 + c.value.length * 3.5 + j * 2.9));
      });
      gy += row.h;
    }

    y += item.h;
    stroke(doc, GRID_RULE); doc.setLineWidth(0.3);
    doc.line(margin, y, right, y);
  });

  // ── Totals, with the notes beside them ────────────────────
  if (y + totalsH > bottom) newPage(false);
  const boxW = 78;
  const boxX = right - boxW;
  const totalsTop = y + 8;
  y = totalsTop;
  for (const [l, v] of lines) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); ink(doc, INK);
    doc.text(l, boxX, y);
    doc.text(v, right, y, { align: "right" });
    y += 6;
  }
  fill(doc, NAVY); doc.rect(boxX, y - 1.5, boxW, 11, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); ink(doc, "#FFFFFF");
  doc.text("Total (ex. VAT)", boxX + 4, y + 5.6);
  doc.text(euro(cq.total), right - 4, y + 5.6, { align: "right" });

  const notesW = boxX - margin - 12;
  let ny = totalsTop - 1;
  heading("NOTES", margin, ny);
  ny += 5.2;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); ink(doc, BODY);
  const notes = [
    ...(cq.unpriced > 0
      ? [`${cq.unpriced} doorset${cq.unpriced === 1 ? " is" : "s are"} priced on application and not included in this total.`]
      : []),
    "Prices are in euro and exclude VAT.",
  ];
  for (const note of notes) {
    const wrapped = doc.splitTextToSize(note, notesW);
    wrapped.forEach((l, k) => doc.text(l, margin, ny + k * 4.2));
    ny += wrapped.length * 4.2 + 1.2;
  }

  // ── Footer ────────────────────────────────────────────────
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    stroke(doc, GRID_RULE); doc.setLineWidth(0.25);
    doc.line(0, pageH - 15, pageW, pageH - 15);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); ink(doc, MUTED);
    doc.text("MF Services · System technology for the door", margin, pageH - 8.5);
    doc.text(`Quotation ${cq.reference} · page ${p} of ${total}`, right, pageH - 8.5, { align: "right" });
  }
  return doc;
}

export async function generateCustomerQuotePDF(cq) {
  const doc = buildCustomerQuotePDF(cq);
  const project = cq.project.replace(/\s+/g, "-").toLowerCase() || "untitled";
  const filename = `quote_${project}_${cq.reference}.pdf`;
  doc.save(filename);
  return filename;
}
