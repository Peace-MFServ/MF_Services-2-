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
// One card per doorset: its name and description across the top, its
// specification as label and value rows on the left, and its price in
// a panel on the right. The totals close the quote in a box of their
// own. Renders a customer quote (lib/customerQuote.js) — selling
// prices only.

const CARD_EDGE = "#DDE3EA";
const PANEL = "#FBFCFD";

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

  // ── Title band ────────────────────────────────────────────
  fill(doc, NAVY); doc.rect(0, 0, pageW, 30, "F");
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); ink(doc, "#FFFFFF");
  doc.text("QUOTATION", margin, 11.5, { charSpace: 0.5 });
  doc.setFontSize(19);
  doc.text("Steel doorsets", margin, 22);
  fill(doc, "#FFFFFF"); doc.roundedRect(right - 46, 8, 46, 14, 1.4, 1.4, "F");
  doc.addImage(LOGO_DATA_URI, "JPEG", right - 41, 11.4, 36, 7.2);

  // ── Quote facts ───────────────────────────────────────────
  const facts = [
    ["QUOTE NO.", cq.reference], ["DATE", today()],
    ["PROJECT", cq.project || "—"], ["DOORSETS", String(cq.doorsetCount)],
  ];
  const factX = [margin, margin + 45, margin + 83, margin + 125];
  facts.forEach(([label, value], i) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); ink(doc, MUTED);
    doc.text(label, factX[i], 40, { charSpace: 0.35 });
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); ink(doc, INK);
    doc.text(doc.splitTextToSize(value, (factX[i + 1] ?? right) - factX[i] - 4)[0] ?? "", factX[i], 45.5);
  });
  stroke(doc, CARD_EDGE); doc.setLineWidth(0.25);
  doc.line(0, 51, pageW, 51);

  let y = 57;
  const newPage = () => { doc.addPage(); y = 18; };

  // ── One card per doorset ──────────────────────────────────
  const panelW = 48;
  const tableW = cW - panelW;
  const labelX = margin + 5;
  const valueX = margin + 52;
  const valueW = tableW - 52 - 4;
  const headH = 14;

  cq.doorsets.forEach((d, i) => {
    // Measure every row first, so the card is drawn at its height.
    doc.setFontSize(8.5);
    const rows = d.spec.map(r => {
      doc.setFontSize(8.5);
      const value = doc.splitTextToSize(r.value, valueW);
      doc.setFontSize(7);
      const note = r.note ? doc.splitTextToSize(r.note, valueW) : [];
      return { ...r, valueLines: value, noteLines: note, h: 2.6 + value.length * 3.7 + note.length * 3.1 + 1.6 };
    });
    const bodyH = Math.max(30, rows.reduce((sum, r) => sum + r.h, 0) + 2);
    const cardH = headH + bodyH;
    if (y + cardH > bottom) newPage();

    // Header strip, price panel, then the outline over both.
    fill(doc, SUNKEN); doc.rect(margin, y, cW, headH, "F");
    fill(doc, PANEL); doc.rect(margin + tableW, y + headH, panelW, bodyH, "F");
    stroke(doc, CARD_EDGE); doc.setLineWidth(0.25);
    doc.line(margin, y + headH, right, y + headH);
    doc.line(margin + tableW, y + headH, margin + tableW, y + cardH);

    fill(doc, NAVY); doc.circle(margin + 8, y + 7, 4.4, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); ink(doc, "#FFFFFF");
    doc.text(String(i + 1).padStart(2, "0"), margin + 8, y + 8.1, { align: "center" });
    doc.setFontSize(10.5); ink(doc, INK);
    doc.text(doc.splitTextToSize(d.name, cW - 22)[0] ?? "", margin + 15.5, y + 6.2);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); ink(doc, BODY);
    doc.text(doc.splitTextToSize(d.description, cW - 22)[0] ?? "", margin + 15.5, y + 10.6);

    // Specification rows
    let ry = y + headH + 1;
    rows.forEach((r, k) => {
      const base = ry + 4.2;
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); ink(doc, MUTED);
      doc.text(doc.splitTextToSize(r.label, valueX - labelX - 3)[0] ?? "", labelX, base);
      ink(doc, INK);
      r.valueLines.forEach((l, j) => doc.text(l, valueX, base + j * 3.7));
      doc.setFontSize(7); ink(doc, MUTED);
      r.noteLines.forEach((l, j) => doc.text(l, valueX, base + r.valueLines.length * 3.7 - 0.4 + j * 3.1));
      ry += r.h;
      if (k < rows.length - 1) {
        stroke(doc, "#EEF1F5"); doc.setLineWidth(0.2);
        doc.line(margin + 0.3, ry, margin + tableW, ry);
      }
    });

    // Price panel
    const px = right - 5;
    const label = (text, at) => {
      doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); ink(doc, MUTED);
      doc.text(text, px, at, { align: "right" });
    };
    if (d.each == null) {
      label("PRICE", y + headH + 7);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); ink(doc, WARN);
      doc.text("Price to follow", px, y + headH + 12.5, { align: "right" });
      label(`QTY ${d.qty || "—"}`, y + headH + 18.5);
    } else {
      label("PRICE EACH", y + headH + 7);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); ink(doc, INK);
      doc.text(euro(d.each), px, y + headH + 12.5, { align: "right" });
      label(`QTY ${d.qty} · TOTAL`, y + headH + 19);
      doc.setFontSize(13); ink(doc, NAVY); doc.setFont("helvetica", "bold");
      doc.text(euro(d.lineTotal), px, y + headH + 25, { align: "right" });
    }

    stroke(doc, CARD_EDGE); doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, cW, cardH, 1.5, 1.5, "S");
    y += cardH + 5;
  });

  // ── Totals, and the notes beside them ─────────────────────
  const lines = [["Doorsets", euro(cq.doorsetsTotal)]];
  if (cq.delivery > 0) lines.push(["Delivery and installation", euro(cq.delivery)]);
  if (cq.discountPct > 0) {
    lines.push(["Total before discount", euro(cq.beforeDiscount)]);
    lines.push([`Discount, ${cq.discountPct}%`, "-" + euro(cq.discountAmount)]);
  }
  const boxW = 78;
  const boxX = right - boxW;
  const boxH = 6 + lines.length * 6.2 + 13;
  if (y + boxH > bottom) newPage();
  const top = y + 1;
  let ty = top + 8;
  for (const [l, v] of lines) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); ink(doc, INK);
    doc.text(l, boxX + 6, ty);
    doc.text(v, right - 6, ty, { align: "right" });
    ty += 6.2;
  }
  stroke(doc, NAVY); doc.setLineWidth(0.6);
  doc.line(boxX + 6, ty - 2.6, right - 6, ty - 2.6);
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); ink(doc, NAVY);
  doc.text("Total (ex. VAT)", boxX + 6, ty + 4.4);
  doc.text(euro(cq.total), right - 6, ty + 4.4, { align: "right" });
  stroke(doc, CARD_EDGE); doc.setLineWidth(0.3);
  doc.roundedRect(boxX, top, boxW, boxH, 1.5, 1.5, "S");

  let ny = top + boxH - 7;
  doc.setFontSize(8.5);
  if (cq.unpriced > 0) {
    const lead = `${cq.unpriced} doorset${cq.unpriced === 1 ? " is" : "s are"} priced on application`;
    doc.setFont("helvetica", "bold"); ink(doc, WARN);
    doc.text(lead, margin, ny - 5);
    const w = doc.getTextWidth(lead);
    doc.setFont("helvetica", "normal"); ink(doc, BODY);
    doc.text(" and not included in this total.", margin + w, ny - 5);
  }
  doc.setFont("helvetica", "normal"); ink(doc, BODY);
  doc.text("Prices are in euro and exclude VAT.", margin, ny);

  // ── Footer ────────────────────────────────────────────────
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    stroke(doc, CARD_EDGE); doc.setLineWidth(0.25);
    doc.line(0, pageH - 15, pageW, pageH - 15);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); ink(doc, MUTED);
    doc.text(`MF Services · System technology for the door · ${CONTACT.phone}`, margin, pageH - 8.5);
    doc.text(`${cq.reference} · page ${p} of ${total}`, right, pageH - 8.5, { align: "right" });
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
