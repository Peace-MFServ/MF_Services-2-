import { jsPDF } from "jspdf";
import { LOGO_DATA_URI } from "./logo";
import { quoteFilename } from "./quote";
import { quoteReference, customerPart } from "./customerQuote";

// ─────────────────────────────────────────────────────────────────
// Quote PDFs — customer quote and internal breakdown
// ─────────────────────────────────────────────────────────────────
// Both are one design, a classic quotation: the logo and the title
// across the top with the quote's number, date and project; who it is
// from and who it is for; one numbered row per doorset; the totals
// with the total on a navy bar and the notes beside them.
//
// The customer quote renders the customer quote object only
// (lib/customerQuote.js) — selling prices and nothing else — with each
// doorset's specification as a two-column grid of labelled values and
// one amount per doorset.
//
// The internal breakdown renders the quote itself: every part with its
// cost, the cost per doorset, transport, labour and the margin. It is
// marked on every page — an orange bar across the top and an orange
// footer — and its filename starts INTERNAL_.
//
// Doorsets are laid out before anything is drawn, so a doorset moves
// whole to the next page, and the last one goes with the totals rather
// than leaving them on a page of their own.
// ─────────────────────────────────────────────────────────────────

const NAVY  = "#00387B";
const INK   = "#101922";
const BODY  = "#2B3641";
const MUTED = "#57646F";
const WARN  = "#B4470E";
const GRID_RULE = "#DDE3EA";

const CONTACT = { phone: "021 434 8996", website: "www.mfservices.ie" };

const fill   = (d, hex) => d.setFillColor(hex);
const stroke = (d, hex) => d.setDrawColor(hex);
const ink    = (d, hex) => d.setTextColor(hex);

const euro = n => "€" + n.toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const today = () => new Date().toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric" });

const MARGIN = 15;
const X_NO = MARGIN + 3;
const X_DESC = MARGIN + 11;

/** Text spaced out by `cs` mm per gap, ending at `right`. */
function spacedRight(doc, text, right, y, cs) {
  const w = doc.getTextWidth(text) + cs * (text.length - 1);
  doc.text(text, right - w, y, { charSpace: cs });
}

const dotted = (doc, x1, y, x2) => {
  stroke(doc, GRID_RULE); doc.setLineWidth(0.2); doc.setLineDashPattern([0.5, 0.6], 0);
  doc.line(x1, y, x2, y);
  doc.setLineDashPattern([], 0);
};

/** A doorset's name and description, and the height they take. */
function itemHead(doc, d, descW) {
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  const desc = doc.splitTextToSize(d.description, descW);
  return {
    h: 9.6 + (desc.length - 1) * 3.9,
    draw(y, i) {
      const top = y + 5;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); ink(doc, MUTED);
      doc.text(String(i + 1), X_NO, top);
      doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); ink(doc, INK);
      doc.text(doc.splitTextToSize(d.name, descW)[0] ?? "", X_DESC, top);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); ink(doc, BODY);
      desc.forEach((l, k) => doc.text(l, X_DESC, top + 4.6 + k * 3.9));
    },
  };
}

/**
 * The page frame both versions share: header, table, page breaks,
 * totals, notes and footer. Items arrive laid out — a height and a
 * draw — so this decides only where they go.
 */
function quotationSheet({
  title, internal, reference, project, customer, columns, layoutItems, totals, total, notes,
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const right = pageW - MARGIN;
  const cW = pageW - MARGIN * 2;
  const o = internal ? 9 : 0;                       // room for the internal bar
  const bottom = pageH - (internal ? 24 : 22);

  // Every page of the internal breakdown says what it is, top first.
  const warnBar = () => {
    if (!internal) return;
    fill(doc, WARN); doc.rect(0, 0, pageW, 9, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); ink(doc, "#FFFFFF");
    doc.text("INTERNAL — NOT FOR CUSTOMERS", MARGIN, 5.9, { charSpace: 0.3 });
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
    doc.text("Costs, margin and labour · send the customer quote instead", right, 5.9, { align: "right" });
  };

  // ── Logo, title and the quote's facts ─────────────────────
  warnBar();
  doc.addImage(LOGO_DATA_URI, "JPEG", MARGIN, 13 + o, 40, 8);
  doc.setFont("helvetica", "bold"); doc.setFontSize(22); ink(doc, NAVY);
  spacedRight(doc, title, right, 22 + o, 1.4);
  [["Quote no.", reference], ["Date", today()], ["Project", project || "—"]].forEach(([label, value], i) => {
    const fy = 30 + o + i * 5;
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
  heading("FROM", MARGIN, 46 + o);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); ink(doc, INK);
  doc.text("MF Services", MARGIN, 51 + o);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); ink(doc, BODY);
  doc.text("Door systems", MARGIN, 55.4 + o);
  doc.text(`${CONTACT.phone} · ${CONTACT.website}`, MARGIN, 59.8 + o);
  if (customer) {
    heading("PREPARED FOR", MARGIN + 83, 46 + o);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); ink(doc, INK);
    doc.splitTextToSize(customer, cW - 83).slice(0, 3)
      .forEach((l, i) => doc.text(l, MARGIN + 83, 51 + o + i * 4.4));
  }

  // ── The table ─────────────────────────────────────────────
  const items = layoutItems(doc);
  const totalsH = 8 + totals.reduce((s, t) => s + 6 + (t.ruleAbove ? 1.5 : 0), 0) + 12;

  let y = 68 + o;
  const tableHead = () => {
    fill(doc, NAVY); doc.rect(MARGIN, y, cW, 8, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); ink(doc, "#FFFFFF");
    doc.text("#", X_NO, y + 5.2);
    doc.text("DESCRIPTION", X_DESC, y + 5.2, { charSpace: 0.35 });
    for (const c of columns) doc.text(c.label, c.x, y + 5.2, { align: c.align });
    y += 8;
  };
  // A continuation page says what it continues.
  const newPage = withTable => {
    doc.addPage();
    warnBar();
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); ink(doc, MUTED);
    doc.text(`${title}  ${reference}`, MARGIN, 15 + o, { charSpace: 0.3 });
    doc.setFont("helvetica", "normal");
    doc.text("continued", right, 15 + o, { align: "right" });
    y = 20 + o;
    if (withTable) tableHead();
  };
  tableHead();
  let pageTop = y;

  items.forEach((item, i) => {
    const need = item.h + (i === items.length - 1 ? totalsH : 0);
    if (y + need > bottom && y > pageTop) { newPage(true); pageTop = y; }
    item.draw(y, i);
    y += item.h;
    stroke(doc, GRID_RULE); doc.setLineWidth(0.3);
    doc.line(MARGIN, y, right, y);
  });

  // ── Totals, with the notes beside them ────────────────────
  if (y + totalsH > bottom) newPage(false);
  const boxW = 78;
  const boxX = right - boxW;
  const totalsTop = y + 8;
  y = totalsTop;
  for (const t of totals) {
    if (t.ruleAbove) {
      stroke(doc, GRID_RULE); doc.setLineWidth(0.3);
      doc.line(boxX, y - 4.2, right, y - 4.2);
      y += 1.5;
    }
    doc.setFont("helvetica", t.bold ? "bold" : "normal"); doc.setFontSize(9.5); ink(doc, INK);
    doc.text(t.label, boxX, y);
    doc.text(t.value, right, y, { align: "right" });
    y += 6;
  }
  fill(doc, NAVY); doc.rect(boxX, y - 1.5, boxW, 11, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(12); ink(doc, "#FFFFFF");
  doc.text("Total (ex. VAT)", boxX + 4, y + 5.6);
  doc.text(euro(total), right - 4, y + 5.6, { align: "right" });

  const notesW = boxX - MARGIN - 12;
  let ny = totalsTop - 1;
  heading("NOTES", MARGIN, ny);
  ny += 5.2;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); ink(doc, BODY);
  for (const note of notes) {
    const wrapped = doc.splitTextToSize(note, notesW);
    wrapped.forEach((l, k) => doc.text(l, MARGIN, ny + k * 4.2));
    ny += wrapped.length * 4.2 + 1.2;
  }

  // ── Footer ────────────────────────────────────────────────
  const pages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    if (internal) {
      fill(doc, WARN); doc.rect(0, pageH - 14, pageW, 14, "F");
      fill(doc, "#FFFFFF"); doc.rect(MARGIN, pageH - 8.2, 2.4, 2.4, "F");
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); ink(doc, "#FFFFFF");
      doc.text("MF SERVICES  ·  INTERNAL — NOT FOR CUSTOMERS", MARGIN + 5.5, pageH - 6.2);
      doc.setFontSize(8);
      doc.text(`${reference} · page ${p} of ${pages}`, right, pageH - 6.2, { align: "right" });
    } else {
      stroke(doc, GRID_RULE); doc.setLineWidth(0.25);
      doc.line(0, pageH - 15, pageW, pageH - 15);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); ink(doc, MUTED);
      doc.text("MF Services · System technology for the door", MARGIN, pageH - 8.5);
      doc.text(`Quotation ${reference} · page ${p} of ${pages}`, right, pageH - 8.5, { align: "right" });
    }
  }
  return doc;
}

const unpricedNote = n =>
  `${n} doorset${n === 1 ? " is" : "s are"} priced on application and not included in this total.`;

// ══ The customer quote ═══════════════════════════════════════════

/** What the customer is sent: their doorsets, what is in them, and
 *  selling prices. Renders a customer quote (lib/customerQuote.js). */
export function buildCustomerQuotePDF(cq) {
  const right = 210 - MARGIN;
  const xQty = right - 40;
  const xAmount = right - 3;
  const descW = xQty - 9 - X_DESC;
  const colGap = 6;
  const cellW = (descW - colGap) / 2;

  const layoutItems = doc => cq.doorsets.map(d => {
    const head = itemHead(doc, d, descW);
    // The specification, two labelled values to a row.
    const cells = d.spec.map(r => {
      doc.setFontSize(8.5);
      const value = doc.splitTextToSize(r.value, cellW);
      doc.setFontSize(7);
      const note = r.note ? doc.splitTextToSize(r.note, cellW) : [];
      return { ...r, value, note, h: 2.8 + value.length * 3.5 + note.length * 2.9 + 1.5 };
    });
    const rows = [];
    for (let k = 0; k < cells.length; k += 2) {
      const pair = cells.slice(k, k + 2);
      rows.push({ cells: pair, h: Math.max(...pair.map(c => c.h)) });
    }
    return {
      h: head.h + 5 + rows.reduce((s, r) => s + r.h, 0),
      draw(y, i) {
        head.draw(y, i);
        const top = y + 5;
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
        let gy = y + head.h + 2.4;
        for (const row of rows) {
          row.cells.forEach((c, k) => {
            const cx = X_DESC + k * (cellW + colGap);
            dotted(doc, cx, gy, cx + cellW);
            doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); ink(doc, MUTED);
            doc.text(doc.splitTextToSize(c.label.toUpperCase(), cellW)[0] ?? "", cx, gy + 2.8, { charSpace: 0.2 });
            doc.setFontSize(8.5); ink(doc, INK);
            c.value.forEach((l, j) => doc.text(l, cx, gy + 6.1 + j * 3.5));
            doc.setFontSize(7); ink(doc, MUTED);
            c.note.forEach((l, j) => doc.text(l, cx, gy + 5.9 + c.value.length * 3.5 + j * 2.9));
          });
          gy += row.h;
        }
      },
    };
  });

  const totals = [{ label: "Doorsets", value: euro(cq.doorsetsTotal) }];
  if (cq.delivery > 0) totals.push({ label: "Delivery and installation", value: euro(cq.delivery) });
  if (cq.discountPct > 0) {
    totals.push({ label: "Total before discount", value: euro(cq.beforeDiscount) });
    totals.push({ label: `Discount, ${cq.discountPct}%`, value: "-" + euro(cq.discountAmount) });
  }

  return quotationSheet({
    title: "QUOTATION", internal: false,
    reference: cq.reference, project: cq.project, customer: cq.customer,
    columns: [{ label: "QTY", x: xQty, align: "center" }, { label: "AMOUNT", x: xAmount, align: "right" }],
    layoutItems, totals, total: cq.total,
    notes: [...(cq.unpriced > 0 ? [unpricedNote(cq.unpriced)] : []), "Prices are in euro and exclude VAT."],
  });
}

export async function generateCustomerQuotePDF(cq) {
  const doc = buildCustomerQuotePDF(cq);
  const project = cq.project.replace(/\s+/g, "-").toLowerCase() || "untitled";
  const filename = `quote_${project}_${cq.reference}.pdf`;
  doc.save(filename);
  return filename;
}

// ══ The internal breakdown ═══════════════════════════════════════

/** The internal breakdown — every part with its cost, the cost per
 *  doorset, transport, labour and the margin. Renders the quote. */
export function buildQuotePDF(quote) {
  const right = 210 - MARGIN;
  const xQty = right - 62;
  const xEach = right - 30;
  const xTotal = right - 3;
  const descW = xQty - 9 - X_DESC;
  const labelW = 40;
  const valueW = descW - labelW - 2;
  const reference = quoteReference(quote);

  const layoutItems = doc => quote.doorsets.map(d => {
    const head = itemHead(doc, d, descW);
    // One part to a row: what it is, what was picked, and its cost.
    const rows = d.components.map(c => {
      const part = customerPart(c);
      doc.setFontSize(8.5);
      const label = doc.splitTextToSize(part.label, labelW - 2);
      const value = doc.splitTextToSize(part.value, valueW);
      doc.setFontSize(7);
      const note = part.note ? doc.splitTextToSize(part.note, valueW) : [];
      const lines = Math.max(label.length, value.length);
      return { label, value, note, amount: c.amount, h: 1.4 + lines * 3.6 + note.length * 2.9 + 1.6 };
    });
    return {
      h: head.h + 5 + rows.reduce((s, r) => s + r.h, 0),
      draw(y, i) {
        head.draw(y, i);
        const top = y + 5;
        doc.setFont("helvetica", "normal"); doc.setFontSize(9); ink(doc, INK);
        doc.text(String(d.qty || "—"), xQty, top, { align: "center" });
        doc.setFont("helvetica", "bold");
        if (d.each == null) {
          ink(doc, WARN);
          doc.text("on application", xEach, top, { align: "right" });
        } else {
          doc.text(euro(d.each), xEach, top, { align: "right" });
          doc.setFontSize(10);
          doc.text(euro(d.lineTotal), xTotal, top, { align: "right" });
        }
        let ry = y + head.h + 2.4;
        for (const r of rows) {
          dotted(doc, X_DESC, ry, xEach);
          const base = ry + 4.4;
          doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); ink(doc, MUTED);
          r.label.forEach((l, j) => doc.text(l, X_DESC, base + j * 3.6));
          ink(doc, INK);
          r.value.forEach((l, j) => doc.text(l, X_DESC + labelW, base + j * 3.6));
          if (r.amount == null) {
            ink(doc, WARN);
            doc.text("t.b.a.", xEach, base, { align: "right" });
          } else {
            doc.text(euro(r.amount), xEach, base, { align: "right" });
          }
          doc.setFontSize(7); ink(doc, MUTED);
          r.note.forEach((l, j) => doc.text(l, X_DESC + labelW, base - 0.3 + r.value.length * 3.6 + j * 2.9));
          ry += r.h;
        }
      },
    };
  });

  const lab = quote.labour;
  const totals = [
    { label: "Doorsets (cost)", value: euro(quote.doorsetsCost) },
    { label: "Transport (cost)", value: euro(quote.transport) },
    {
      label: lab.total > 0 ? `Labour, ${lab.men} men × ${lab.days} day${lab.days === 1 ? "" : "s"}` : "Labour",
      value: euro(lab.total),
    },
    { label: "Subtotal (cost)", value: euro(quote.subtotal), bold: true, ruleAbove: true },
    { label: `Margin, ${quote.marginPct}% of sale`, value: euro(quote.marginAmount) },
    ...(quote.discountPct > 0
      ? [{ label: `Discount, ${quote.discountPct}%`, value: "-" + euro(quote.discountAmount) }]
      : []),
  ];

  return quotationSheet({
    title: "COST BREAKDOWN", internal: true,
    reference, project: quote.project, customer: quote.customer,
    columns: [
      { label: "QTY", x: xQty, align: "center" },
      { label: "EACH (COST)", x: xEach, align: "right" },
      { label: "TOTAL (COST)", x: xTotal, align: "right" },
    ],
    layoutItems, totals, total: quote.total,
    notes: [
      ...(quote.unpriced > 0 ? [unpricedNote(quote.unpriced)] : []),
      `Same total as customer quote ${reference}.`,
      "Prices are in euro and exclude VAT.",
    ],
  });
}

export async function generateQuotePDF(quote) {
  const doc = buildQuotePDF(quote);
  const filename = quoteFilename(quote, "pdf", { internal: true });
  doc.save(filename);
  return filename;
}
