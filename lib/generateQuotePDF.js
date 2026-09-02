import { jsPDF } from "jspdf";
import { LOGO_DATA_URI } from "./logo";
import { quoteFilename } from "./quote";

// ─────────────────────────────────────────────────────────────────
// Quote PDF — MF Services internal
// ─────────────────────────────────────────────────────────────────
// The same house sheet as the specifications: navy band, project
// strip, navy footer. One block per doorset — the set line in bold,
// its components beneath — then margin, transport and the total.
// This sheet carries the cost breakdown, so it is an internal
// document; it says so in the footer.
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

export async function generateQuotePDF(quote) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const cW = pageW - margin * 2;
  const bottom = pageH - 20;

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric" });

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

  // ══ Header ══════════════════════════════════════════════════
  fill(doc, NAVY); doc.rect(0, 0, pageW, 21, "F");
  doc.setFont("helvetica", "normal"); doc.setFontSize(15); ink(doc, "#FFFFFF");
  doc.text("Steel doorsets — quote", margin, 13.5);
  y = 27;

  // ══ Project strip, logo right ═══════════════════════════════
  doc.addImage(LOGO_DATA_URI, "JPEG", pageW - margin - 26, y - 1.5, 26, 5.2);
  const meta = [["Project", quote.project || "—"], ["Date", dateStr]];
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
  y += 7;

  // ══ Column headings ═════════════════════════════════════════
  const headings = () => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); ink(doc, MUTED);
    doc.text("DOORSET", margin, y);
    doc.text("QTY", xQty, y, { align: "right" });
    doc.text("EACH", xEach, y, { align: "right" });
    doc.text("TOTAL", xTotal, y, { align: "right" });
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

    // Its parts
    doc.setFontSize(8);
    for (const c of d.components) {
      breakIfNeeded(4.6);
      ink(doc, BODY);
      const text = c.detail ? `${c.label} — ${c.detail}` : c.label;
      doc.text(doc.splitTextToSize(text, cW - 50)[0], margin + 6, y);
      if (c.amount == null) {
        ink(doc, WARN);
        doc.text("t.b.a.", xEach, y, { align: "right" });
      } else {
        ink(doc, INK);
        doc.text(euro(c.amount), xEach, y, { align: "right" });
      }
      y += 4.2;
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
    ["Doorsets", euro(quote.doorsetsCost)],
    ["Transport", euro(quote.transport)],
    [
      lab.total > 0
        ? `Labour, ${lab.men} men × ${lab.days} day${lab.days === 1 ? "" : "s"} @ ${euro(lab.rate)}`
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
  totalsRow("Subtotal", euro(quote.subtotal), true);
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

  // ══ Specification notes ═════════════════════════════════════
  // What the technical picks mean, in plain words — only the terms
  // this quote actually uses.
  if (quote.specNotes?.length) {
    breakIfNeeded(14);
    y += 3;
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); ink(doc, NAVY);
    doc.text("SPECIFICATION NOTES", margin, y);
    y += 5.4;
    for (const n of quote.specNotes) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); ink(doc, INK);
      const termW = doc.getTextWidth(`${n.term} — `) + 1;
      const bodyLines = doc.splitTextToSize(n.text, cW - termW);
      breakIfNeeded(bodyLines.length * 3.8 + 2);
      doc.text(`${n.term} — `, margin, y);
      doc.setFont("helvetica", "normal"); ink(doc, "#3D4C5E");
      bodyLines.forEach((l, i) => doc.text(l, margin + termW, y + i * 3.8));
      y += bodyLines.length * 3.8 + 1.6;
    }
  }

  // ══ Footer ══════════════════════════════════════════════════
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    fill(doc, NAVY); doc.rect(0, pageH - 14, pageW, 14, "F");
    fill(doc, "#FFFFFF"); doc.rect(margin, pageH - 8.2, 2.4, 2.4, "F");
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); ink(doc, "#FFFFFF");
    doc.text(`MF SERVICES  ·  INTERNAL — carries cost breakdown  ·  ${CONTACT.phone}`, margin + 5.5, pageH - 6.2);
    doc.setFontSize(8);
    doc.text(`${p} / ${total}`, pageW - margin, pageH - 6.2, { align: "right" });
  }

  const filename = quoteFilename(quote, "pdf");
  doc.save(filename);
  return filename;
}
