import { jsPDF } from "jspdf";
import { QUOTE_LOGO } from "./quoteLogo";
import { quoteFilename } from "./quote";
import { buildCustomerQuote, customerPart } from "./customerQuote";
import { COMPANY, footerLine, SERVICE_HEADING } from "./company";

// ─────────────────────────────────────────────────────────────────
// Quote PDFs — customer quote and internal breakdown
// ─────────────────────────────────────────────────────────────────
// Both follow the MF Services quote template Liam approved (V4,
// November 2026): the label and "Quote No." with the logo beside it,
// a strip of the quote's facts (licence, order, validity, date), the
// customer and the site in two shaded boxes, the service heading, the
// navy-headed table, the totals ending on a navy "Total inc VAT", and
// the orange, navy, blue and green stripes in the bottom corner.
//
// The customer quote renders the customer quote object only
// (lib/customerQuote.js) — selling prices and nothing else — with each
// doorset's specification as a grid of labelled values beneath it, the
// delivery and any discount as lines of their own, and a second page
// of payment methods.
//
// The internal breakdown renders the quote itself: every part with its
// cost, transport, labour and the margin, then the same VAT and total
// as the customer's. It is marked on every page — an orange bar across
// the top and an orange footer — and its filename starts INTERNAL_.
//
// Items are laid out before anything is drawn, so an item moves whole
// to the next page, and the last one goes with the totals rather than
// leaving them on a page of their own.
// ─────────────────────────────────────────────────────────────────

const NAVY   = "#00387B";
const ORANGE = "#ED6E02";
const BLUE   = "#1470B1";
const GREEN  = "#B1C638";
const PANEL  = "#F7F8FA";
const RULE   = "#E2E8EE";
const INK    = "#333333";
const MUTED  = "#7A8594";
const WARN   = "#B4470E";

const L = 21;                 // the template's margins
const R = 189;
const W = R - L;
const X_NO = L + 3;
const X_ITEM = L + 9;
const BOTTOM = 268;           // clear of the corner stripes and footer

const fill   = (d, hex) => d.setFillColor(hex);
const stroke = (d, hex) => d.setDrawColor(hex);
const ink    = (d, hex) => d.setTextColor(hex);
const font   = (d, style, size) => { d.setFont("helvetica", style); d.setFontSize(size); };

const euro = n => (n < 0 ? "-" : "") + "€" + Math.abs(n).toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percent = n => `${n}%`;
const day = date => date.toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric" });

const rule = (doc, x1, y, x2, colour = RULE, width = 0.3) => {
  stroke(doc, colour); doc.setLineWidth(width); doc.line(x1, y, x2, y);
};

/** The four brand stripes rising from the bottom right corner. */
function cornerStripes(doc) {
  const step = 11.35;
  [ORANGE, NAVY, BLUE, GREEN].forEach((colour, i) => {
    const x = 164.6 + i * step;
    const y = 251.5 + i * step;
    fill(doc, colour);
    if (i < 3) {
      doc.triangle(x, 297, 210, y, 210, y + step, "F");
      doc.triangle(x, 297, x + step, 297, 210, y + step, "F");
    } else {
      doc.triangle(x, 297, 210, y, 210, 297, "F");
    }
  });
}

/**
 * The page frame both versions share: header, facts, boxes, table,
 * page breaks, totals and footer. Items arrive laid out — a height and
 * a draw — so this decides only where they go.
 */
function quotationSheet({
  label, internal, cq, columns, layoutItems, totals, notes, paymentPage = false,
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const o = internal ? 9 : 0;                         // room for the internal bar
  const details = cq.details ?? {};
  const dash = v => (v ? v : "—");

  // ── Every page: the label, the quote number and the logo ──
  const pageHeader = text => {
    if (internal) {
      fill(doc, WARN); doc.rect(0, 0, 210, 9, "F");
      font(doc, "bold", 8.5); ink(doc, "#FFFFFF");
      doc.text("INTERNAL — NOT FOR CUSTOMERS", L, 5.9, { charSpace: 0.3 });
      font(doc, "normal", 7.5);
      doc.text("Costs, margin and labour · send the customer quote instead", R, 5.9, { align: "right" });
    }
    font(doc, "bold", 7.5); ink(doc, NAVY);
    doc.text(text, L, 25 + o);
    stroke(doc, ORANGE); doc.setLineWidth(0.5);
    doc.line(L, 27.5 + o, L + Math.max(32, doc.getTextWidth(text) + 4), 27.5 + o);
    font(doc, "bold", 21); ink(doc, NAVY);
    doc.text(`Quote No. ${cq.reference}`, L, 40 + o);
    doc.addImage(QUOTE_LOGO, "PNG", 141, 21 + o, 56, 13.7);
  };

  // ── First page: facts, customer and site, service ─────────
  pageHeader(label);
  fill(doc, PANEL); doc.rect(L, 50 + o, W, 17, "F");
  fill(doc, NAVY); doc.rect(L, 50 + o, W, 0.7, "F");
  [
    ["Licence No.", COMPANY.licenceNo], ["Order No.", dash(details.orderNo)],
    ["Validity", COMPANY.validity], ["Date", day(cq.date)],
  ].forEach(([k, v], i) => {
    const x = L + 4 + i * (W / 4);
    font(doc, "normal", 6.5); ink(doc, MUTED); doc.text(k.toUpperCase(), x, 56 + o);
    font(doc, "bold", 8.5); ink(doc, NAVY); doc.text(doc.splitTextToSize(v, W / 4 - 6)[0] ?? "", x, 62 + o);
  });

  const boxY = 72 + o;
  const boxH = 33;
  const half = (W - 4) / 2;
  const box = (x, title) => {
    fill(doc, PANEL); doc.rect(x, boxY, half, boxH, "F");
    fill(doc, NAVY); doc.rect(x, boxY, 1.2, boxH, "F");
    font(doc, "bold", 7.5); ink(doc, NAVY); doc.text(title, x + 5, boxY + 7);
  };
  box(L, "CUSTOMER");
  box(L + half + 4, "SITE & CONTACT");

  font(doc, "bold", 10); ink(doc, NAVY);
  const name = doc.splitTextToSize(dash(cq.customer), half - 9).slice(0, 2);
  name.forEach((l, i) => doc.text(l, L + 5, boxY + 13.5 + i * 4.6));
  font(doc, "normal", 8.5); ink(doc, INK);
  [details.address1, details.address2, details.address3].filter(Boolean)
    .forEach((l, i) => doc.text(doc.splitTextToSize(l, half - 9)[0], L + 5, boxY + 14 + name.length * 4.6 + i * 4.4));

  const sx = L + half + 9;
  const siteRows = [
    ...(cq.project && cq.project !== details.site ? [["Project", cq.project]] : []),
    ["Site", details.site], ["Site Contact", details.siteContact], ["Salesperson", details.salesperson],
  ];
  siteRows.forEach(([k, v], i) => {
    const y = boxY + 13.5 + i * (siteRows.length > 3 ? 5.6 : 7);
    font(doc, "normal", 7.5); ink(doc, MUTED); doc.text(k, sx, y);
    font(doc, "bold", 8.5); ink(doc, NAVY);
    doc.text(doc.splitTextToSize(dash(v), half - 33)[0] ?? "", sx + 22, y);
  });

  font(doc, "bold", 7.5); ink(doc, NAVY); doc.text("SERVICE DESCRIPTION", L, 114 + o);
  stroke(doc, ORANGE); doc.setLineWidth(0.5); doc.line(L, 116.5 + o, L + 52, 116.5 + o);
  font(doc, "bold", 13); ink(doc, NAVY); doc.text(SERVICE_HEADING, L, 124.5 + o);

  // ── The table ─────────────────────────────────────────────
  const items = layoutItems(doc);
  const totalsH = 6 + totals.reduce((s, t) => s + (t.grand ? 12 : 7.5), 0);

  let y = 130 + o;
  const tableHead = () => {
    fill(doc, NAVY); doc.rect(L, y, W, 8, "F");
    font(doc, "bold", 7.5); ink(doc, "#FFFFFF");
    doc.text("ITEM", L + 3, y + 5.2);
    for (const c of columns) doc.text(c.label, c.x, y + 5.2, { align: c.align });
    y += 8;
  };
  const newPage = withTable => {
    doc.addPage();
    pageHeader(`${label}  ·  CONTINUED`);
    y = 50 + o;
    if (withTable) tableHead();
  };
  tableHead();
  let pageTop = y;

  items.forEach((item, i) => {
    const need = item.h + (i === items.length - 1 ? totalsH : 0);
    if (y + need > BOTTOM && y > pageTop) { newPage(true); pageTop = y; }
    item.draw(y, i);
    y += item.h;
    rule(doc, L, y, R);
  });

  // ── Totals, with any notes beside them ────────────────────
  if (y + totalsH > BOTTOM) newPage(false);
  const tx = 111;
  const totalsTop = y + 9;
  y = totalsTop;
  for (const t of totals) {
    if (t.grand) {
      fill(doc, NAVY); doc.rect(tx, y - 3, R - tx, 10, "F");
      font(doc, "bold", 10.5); ink(doc, "#FFFFFF");
      doc.text(t.label, tx + 4, y + 3.3);
      doc.text(t.value, R - 3, y + 3.3, { align: "right" });
      y += 12;
      continue;
    }
    font(doc, t.bold ? "bold" : "normal", 8.5); ink(doc, INK);
    doc.text(t.label, tx + 3, y);
    font(doc, "bold", 9); ink(doc, t.colour ?? NAVY);
    doc.text(t.value, R - 3, y, { align: "right" });
    rule(doc, tx, y + 2.5, R, t.bold ? NAVY : RULE, t.bold ? 0.4 : 0.3);
    y += 7.5;
  }

  if (notes.length) {
    const notesW = tx - L - 10;
    let ny = totalsTop - 1;
    font(doc, "bold", 7); ink(doc, MUTED); doc.text("NOTES", L, ny, { charSpace: 0.4 });
    ny += 5;
    for (const n of notes) {
      font(doc, "normal", 8); ink(doc, n.warn ? WARN : INK);
      const wrapped = doc.splitTextToSize(n.text, notesW);
      wrapped.forEach((l, k) => doc.text(l, L, ny + k * 4));
      ny += wrapped.length * 4 + 1.2;
    }
  }

  // ── The customer's second page: how to pay ────────────────
  if (paymentPage) {
    doc.addPage();
    pageHeader("QUOTATION  ·  PAYMENT METHODS");
    const pw = (W - 8) / 3;
    ["MAIL", "DIRECT DEPOSIT", "CREDIT CARD"].forEach((h, i) => {
      const x = L + i * (pw + 4);
      fill(doc, NAVY); doc.rect(x, 58, pw, 9, "F");
      fill(doc, PANEL); doc.rect(x, 67, pw, 50, "F");
      font(doc, "bold", 7.5); ink(doc, "#FFFFFF"); doc.text(h, x + pw / 2, 63.5, { align: "center" });
    });
    const small = (t, x, yy) => { font(doc, "normal", 6.5); ink(doc, MUTED); doc.text(t, x, yy); };

    let x = L + 4;
    small("MAIL CHEQUE TO:", x, 74);
    font(doc, "bold", 9); ink(doc, NAVY); doc.text(COMPANY.name, x, 80);
    font(doc, "normal", 7.5); ink(doc, INK); doc.text([COMPANY.addressLine, COMPANY.town], x, 85);

    x = L + pw + 8;
    small("BANK", x, 74); font(doc, "bold", 8.5); ink(doc, NAVY); doc.text(COMPANY.bank.name, x, 78.5);
    small("ACC NAME", x, 84); font(doc, "bold", 8); ink(doc, NAVY); doc.text(COMPANY.bank.accountName, x, 88.5);
    small("IBAN", x, 99); font(doc, "bold", 8); ink(doc, NAVY); doc.text(COMPANY.bank.iban, x, 103.5);

    x = L + 2 * (pw + 4) + 4;
    font(doc, "normal", 8); ink(doc, INK); doc.text("Please call", x, 74);
    font(doc, "bold", 12); ink(doc, NAVY); doc.text(COMPANY.phone, x, 81);
    font(doc, "normal", 8); ink(doc, INK); doc.text("to pay over the phone.", x, 87);

    font(doc, "normal", 9); ink(doc, INK);
    doc.text("Please contact us if you have any queries regarding this quote.", L, 132);
    font(doc, "bold", 9.5); ink(doc, NAVY); doc.text(details.salesperson || COMPANY.name, L, 139);
    font(doc, "normal", 8); ink(doc, MUTED); doc.text(details.salespersonEmail || COMPANY.email, L, 144);
  }

  // ── Footer and corner, every page ─────────────────────────
  const pages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    cornerStripes(doc);
    if (internal) {
      // The orange footer runs into the orange stripe.
      fill(doc, WARN); doc.rect(0, 285, 164.6, 12, "F");
      doc.triangle(164.6, 285, 176.6, 285, 164.6, 297, "F");
      fill(doc, "#FFFFFF"); doc.rect(L, 289.6, 2.4, 2.4, "F");
      font(doc, "normal", 8.5); ink(doc, "#FFFFFF");
      doc.text("MF SERVICES  ·  INTERNAL — NOT FOR CUSTOMERS", L + 5, 291.6);
      font(doc, "normal", 7.5);
      doc.text(`${cq.reference} · page ${p} of ${pages}`, 158, 291.6, { align: "right" });
    } else {
      font(doc, "normal", 6.5); ink(doc, MUTED);
      doc.text(footerLine(), L, 287);
      doc.text(`Page ${p} of ${pages}`, L, 291);
    }
  }
  return doc;
}

const unpricedNote = n =>
  `${n} doorset${n === 1 ? " is" : "s are"} priced on application and not included in this total.`;

/** A doorset's name and description beside its figures, and the
 *  height they take. */
function itemHead(doc, d, descW) {
  font(doc, "normal", 7.8);
  const desc = doc.splitTextToSize(d.description, descW);
  return {
    h: 8.6 + (desc.length - 1) * 3.5,
    draw(y, i) {
      const top = y + 5;
      font(doc, "normal", 8.5); ink(doc, MUTED); doc.text(String(i + 1), X_NO, top);
      font(doc, "bold", 9.5); ink(doc, NAVY); doc.text(doc.splitTextToSize(d.name, descW)[0] ?? "", X_ITEM, top);
      font(doc, "normal", 7.8); ink(doc, INK);
      desc.forEach((l, k) => doc.text(l, X_ITEM, top + 4.3 + k * 3.5));
    },
  };
}

/** A one-line item: the delivery, or a discount. */
function simpleItem(doc, text, draw) {
  return {
    h: 9,
    draw(y, i) {
      const top = y + 5.6;
      font(doc, "normal", 8.5); ink(doc, MUTED); doc.text(String(i + 1), X_NO, top);
      font(doc, "bold", 9.5); ink(doc, NAVY); doc.text(text, X_ITEM, top);
      draw(top);
    },
  };
}

// ══ The customer quote ═══════════════════════════════════════════

/** What the customer is sent: their doorsets, what is in them, and
 *  selling prices. Renders a customer quote (lib/customerQuote.js). */
export function buildCustomerQuotePDF(cq) {
  const xQty = 117;
  const xUnit = 147;
  const xVat = 161;
  const xTotal = R - 3;
  const descW = xQty - 10 - X_ITEM;
  const cols = 3;
  const cellW = (R - 2 - X_ITEM) / cols;
  const rates = cq.vat?.rates ?? { doorsets: 23, delivery: 23 };

  const figures = (doc, top, { qty, unit, rate, total, warn }) => {
    font(doc, "normal", 8.5); ink(doc, INK);
    if (qty != null) doc.text(String(qty), xQty, top, { align: "center" });
    if (warn) {
      font(doc, "bold", 8.5); ink(doc, WARN);
      doc.text("Price to follow", xTotal, top, { align: "right" });
      return;
    }
    if (unit != null) doc.text(euro(unit), xUnit, top, { align: "right" });
    if (rate != null) doc.text(percent(rate), xVat, top, { align: "center" });
    font(doc, "bold", 9); ink(doc, NAVY);
    doc.text(euro(total), xTotal, top, { align: "right" });
  };

  const layoutItems = doc => {
    const items = cq.doorsets.map(d => {
      const head = itemHead(doc, d, descW);
      // The specification beneath, three labelled values to a row.
      const cells = d.spec.map(r => {
        font(doc, "normal", 7.5);
        const value = doc.splitTextToSize(r.value, cellW - 3);
        font(doc, "normal", 6.5);
        const note = r.note ? doc.splitTextToSize(r.note, cellW - 3) : [];
        return { ...r, value, note, h: 3 + value.length * 3.2 + note.length * 2.7 + 2 };
      });
      const rows = [];
      for (let k = 0; k < cells.length; k += cols) {
        const group = cells.slice(k, k + cols);
        rows.push({ cells: group, h: Math.max(...group.map(c => c.h)) });
      }
      return {
        h: head.h + 1.5 + rows.reduce((s, r) => s + r.h, 0) + 1.5,
        draw(y, i) {
          head.draw(y, i);
          figures(doc, y + 5, {
            qty: d.qty || "—", unit: d.each, rate: rates.doorsets, total: d.lineTotal,
            warn: d.lineTotal == null,
          });
          let gy = y + head.h + 1.5;
          for (const row of rows) {
            row.cells.forEach((c, k) => {
              const cx = X_ITEM + k * cellW;
              rule(doc, cx, gy, cx + cellW - 4, RULE, 0.2);
              font(doc, "normal", 5.8); ink(doc, MUTED);
              doc.text(doc.splitTextToSize(c.label.toUpperCase(), cellW - 3)[0] ?? "", cx, gy + 2.8, { charSpace: 0.15 });
              font(doc, "normal", 7.5); ink(doc, INK);
              c.value.forEach((l, j) => doc.text(l, cx, gy + 6 + j * 3.2));
              font(doc, "normal", 6.5); ink(doc, MUTED);
              c.note.forEach((l, j) => doc.text(l, cx, gy + 5.8 + c.value.length * 3.2 + j * 2.7));
            });
            gy += row.h;
          }
        },
      };
    });
    if (cq.delivery > 0) {
      items.push(simpleItem(doc, "Delivery and installation", top =>
        figures(doc, top, { qty: 1, unit: cq.delivery, rate: rates.delivery, total: cq.delivery })));
    }
    // A discount shows only when one is given (Liam: a "0%" line invites
    // the question).
    if (cq.discountPct > 0) {
      items.push(simpleItem(doc, `Discount, ${cq.discountPct}%`, top =>
        figures(doc, top, { total: -cq.discountAmount })));
    }
    return items;
  };

  const totals = [
    { label: "Sub Total ex VAT", value: euro(cq.total), bold: true },
    ...cq.vat.lines.map(l => ({ label: l.label, value: euro(l.amount) })),
    { label: "Total inc VAT", value: euro(cq.totalIncVat), grand: true },
  ];

  return quotationSheet({
    label: "QUOTATION", internal: false, cq,
    columns: [
      { label: "QUANTITY", x: xQty, align: "center" },
      { label: "UNIT PRICE", x: xUnit, align: "right" },
      { label: "VAT", x: xVat, align: "center" },
      { label: "TOTAL", x: xTotal, align: "right" },
    ],
    layoutItems, totals,
    notes: cq.unpriced > 0 ? [{ text: unpricedNote(cq.unpriced), warn: true }] : [],
    paymentPage: true,
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
 *  doorset, transport, labour and the margin, then the customer's VAT
 *  and total. Renders the quote. */
export function buildQuotePDF(quote) {
  const cq = buildCustomerQuote(quote);
  const xQty = 128;
  const xEach = 158;
  const xTotal = R - 3;
  const descW = xQty - 10 - X_ITEM;
  const labelW = 42;
  const valueW = xEach - 24 - X_ITEM - labelW;

  const layoutItems = doc => quote.doorsets.map(d => {
    const head = itemHead(doc, d, descW);
    // One part to a row: what it is, what was picked, and its cost.
    const rows = d.components.map(c => {
      const part = customerPart(c);
      font(doc, "normal", 8);
      const label = doc.splitTextToSize(part.label, labelW - 2);
      const value = doc.splitTextToSize(part.value, valueW);
      font(doc, "normal", 6.5);
      const note = part.note ? doc.splitTextToSize(part.note, valueW) : [];
      const lines = Math.max(label.length, value.length);
      return { label, value, note, amount: c.amount, included: c.included, h: 1.4 + lines * 3.4 + note.length * 2.7 + 1.6 };
    });
    return {
      h: head.h + 2 + rows.reduce((s, r) => s + r.h, 0),
      draw(y, i) {
        head.draw(y, i);
        const top = y + 5;
        font(doc, "normal", 8.5); ink(doc, INK);
        doc.text(String(d.qty || "—"), xQty, top, { align: "center" });
        font(doc, "bold", 9);
        if (d.each == null) {
          ink(doc, WARN);
          doc.text("on application", xEach, top, { align: "right" });
        } else {
          ink(doc, INK); doc.text(euro(d.each), xEach, top, { align: "right" });
          ink(doc, NAVY); doc.text(euro(d.lineTotal), xTotal, top, { align: "right" });
        }
        let ry = y + head.h + 1;
        for (const r of rows) {
          rule(doc, X_ITEM, ry, xEach, RULE, 0.2);
          const base = ry + 4.2;
          font(doc, "normal", 8); ink(doc, MUTED);
          r.label.forEach((l, j) => doc.text(l, X_ITEM, base + j * 3.4));
          ink(doc, INK);
          r.value.forEach((l, j) => doc.text(l, X_ITEM + labelW, base + j * 3.4));
          if (r.amount == null) {
            ink(doc, WARN); doc.text("t.b.a.", xEach, base, { align: "right" });
          } else if (r.included) {
            ink(doc, MUTED); doc.text("Included", xEach, base, { align: "right" });
          } else {
            doc.text(euro(r.amount), xEach, base, { align: "right" });
          }
          font(doc, "normal", 6.5); ink(doc, MUTED);
          r.note.forEach((l, j) => doc.text(l, X_ITEM + labelW, base - 0.3 + r.value.length * 3.4 + j * 2.7));
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
    { label: "Subtotal (cost)", value: euro(quote.subtotal), bold: true },
    { label: `Margin, ${quote.marginPct}% of sale`, value: euro(quote.marginAmount) },
    ...(quote.discountPct > 0
      ? [{ label: `Discount, ${quote.discountPct}%`, value: euro(-quote.discountAmount) }]
      : []),
    { label: "Sub Total ex VAT", value: euro(quote.total), bold: true },
    ...cq.vat.lines.map(l => ({ label: l.label, value: euro(l.amount) })),
    { label: "Total inc VAT", value: euro(cq.totalIncVat), grand: true },
  ];

  return quotationSheet({
    label: "COST BREAKDOWN", internal: true, cq,
    columns: [
      { label: "QTY", x: xQty, align: "center" },
      { label: "EACH (COST)", x: xEach, align: "right" },
      { label: "TOTAL (COST)", x: xTotal, align: "right" },
    ],
    layoutItems, totals,
    notes: [
      ...(quote.unpriced > 0 ? [{ text: unpricedNote(quote.unpriced), warn: true }] : []),
      { text: `Same total as customer quote ${cq.reference}.` },
    ],
  });
}

export async function generateQuotePDF(quote) {
  const doc = buildQuotePDF(quote);
  const filename = quoteFilename(quote, "pdf", { internal: true });
  doc.save(filename);
  return filename;
}
