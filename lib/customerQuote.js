// ─────────────────────────────────────────────────────────────────
// The customer's quote
// ─────────────────────────────────────────────────────────────────
// What a customer is sent: what they are getting and what it sells
// for. It is built FROM the internal quote rather than by hiding parts
// of it, so the costs are never in this object to leak — no supplier
// prices, no cost per doorset, no transport or labour breakdown, no
// margin. The customer PDF and Excel render only this.
//
// Every price is a selling price: a doorset's cost ÷ (1 − margin), the
// same division the internal quote applies to the whole subtotal.
// Transport and labour travel as one "Delivery and installation" line,
// and that line takes up the cents of rounding, so the customer's
// figures add up to exactly the internal total.
// ─────────────────────────────────────────────────────────────────

const round = n => Math.round(n * 100) / 100;

const capital = s => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** The supplier is not named on anything a customer receives. */
const unbranded = s => String(s ?? "").replace(/\s*\bDFM\b/g, "").replace(/\s{2,}/g, " ").trim();

/** A part as the customer reads it — what it is, what was picked, and
 *  what that means where it matters. Never its price. */
export function customerPart({ label, detail, note }) {
  return {
    label: label.replace(/ — /g, ", "),
    value: capital(unbranded(detail).replace(/ · /g, ", ")) || "Included",
    note: capital(unbranded(note)),
  };
}

/** A doorset's specification rows: its rating and size first, then
 *  every part on the quote. */
export function customerSpec(d) {
  const rows = [];
  if (d.fireRating) {
    rows.push(d.fireRating.minutes === 0
      ? { label: "Fire rating", value: "Not fire rated", note: "" }
      : {
        label: "Fire rating", value: d.fireRating.classification,
        note: `Fire resisting for ${d.fireRating.minutes} minutes, integrity and insulation (EN 13501-2)`,
      });
  }
  if (d.size) rows.push({ label: "Size", value: d.size, note: "" });
  for (const c of d.components) {
    if (c.label !== "Doorset") rows.push(customerPart(c));
  }
  return rows;
}

/**
 * A short reference both versions of the same quote carry, so the
 * internal breakdown can be matched to what the customer was sent.
 * It is worked from the quote itself: the same quote on the same day
 * gives the same reference, whichever file is downloaded first.
 */
export function quoteReference(quote, date = new Date()) {
  const basis = JSON.stringify([
    quote.project,
    quote.doorsets.map(d => [d.name, d.qty, d.each, d.components.map(c => [c.label, c.detail])]),
    quote.transport, quote.labour.total, quote.marginPct, quote.discountPct,
    quote.vatRates?.doorsets, quote.vatRates?.delivery,
  ]);
  let h = 0x811c9dc5;                               // FNV-1a
  for (let i = 0; i < basis.length; i++) {
    h ^= basis.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `Q-${ymd}-${h.toString(16).toUpperCase().padStart(8, "0").slice(0, 4)}`;
}

/**
 * VAT on top of the total, which stays ex VAT. The doorsets and the
 * delivery and installation can carry different rates, so each takes
 * its own share of the discount and is taxed on its own; lines at the
 * same rate print as one. Every file shows these figures, the internal
 * ones included, so the VAT never differs by a cent between them.
 */
export function vatFor({ total, delivery, discountPct, vatRates }) {
  const rates = vatRates ?? { doorsets: 23, delivery: 23 };
  const deliveryNet = round(delivery * (1 - discountPct / 100));
  const parts = [
    { on: "doorsets", rate: rates.doorsets, base: round(total - deliveryNet) },
    ...(deliveryNet !== 0 ? [{ on: "delivery and installation", rate: rates.delivery, base: deliveryNet }] : []),
  ].map(p => ({ ...p, amount: round(p.base * p.rate / 100) }));

  const byRate = new Map();
  for (const p of parts) {
    const at = byRate.get(p.rate);
    byRate.set(p.rate, at
      ? { ...at, base: round(at.base + p.base), amount: round(at.amount + p.amount), on: null }
      : p);
  }
  const lines = [...byRate.values()]
    .sort((a, b) => b.rate - a.rate)
    .map(l => ({
      rate: l.rate, base: l.base, amount: l.amount,
      label: `VAT @ ${l.rate}%${byRate.size > 1 && l.on ? ` on ${l.on}` : ""}`,
    }));
  const amount = round(lines.reduce((s, l) => s + l.amount, 0));
  return { lines, parts, amount, totalIncVat: round(total + amount), rates };
}

export function buildCustomerQuote(quote, date = new Date()) {
  const factor = 1 / (1 - quote.marginPct / 100);

  const doorsets = quote.doorsets.map(d => {
    const each = d.each == null ? null : round(d.each * factor);
    return {
      name: d.name,
      description: d.description,
      qty: d.qty,
      each,
      lineTotal: each == null ? null : round(each * d.qty),
      onApplication: d.onApplication,
      spec: customerSpec(d),
    };
  });

  // Delivery is the delivery cost marked up, to the cent. Rounding
  // each doorset's price can leave the lines a cent or two off the
  // internal total; that settles on a doorset bought singly, where it
  // cannot show, before it touches delivery — "€8,000.01" for
  // delivery would read as a mistake.
  let delivery = round((quote.transport + quote.labour.total) * factor);
  let doorsetsTotal = round(doorsets.reduce((s, d) => s + (d.lineTotal ?? 0), 0));
  const residual = round(quote.beforeDiscount - doorsetsTotal - delivery);
  if (residual !== 0) {
    const priced = doorsets.filter(d => d.lineTotal != null);
    const single = priced.find(d => d.qty === 1);
    if (single) {
      single.each = single.lineTotal = round(single.lineTotal + residual);
      doorsetsTotal = round(doorsetsTotal + residual);
    } else if (delivery > 0 || !priced.length) {
      delivery = round(delivery + residual);
    } else {
      const largest = priced.reduce((a, b) => (b.lineTotal > a.lineTotal ? b : a));
      largest.lineTotal = round(largest.lineTotal + residual);
      doorsetsTotal = round(doorsetsTotal + residual);
    }
  }

  const vat = vatFor({ total: quote.total, delivery, discountPct: quote.discountPct, vatRates: quote.vatRates });

  return {
    reference: quoteReference(quote, date),
    date,
    project: quote.project,
    customer: quote.customer ?? "",
    details: quote.details ?? {},
    vat,
    totalIncVat: vat.totalIncVat,
    currency: quote.currency,
    doorsets,
    doorsetCount: doorsets.reduce((s, d) => s + (d.qty || 0), 0),
    doorsetsTotal,
    delivery,
    beforeDiscount: quote.beforeDiscount,
    discountPct: quote.discountPct,
    discountAmount: quote.discountAmount,
    total: quote.total,
    unpriced: quote.unpriced,
  };
}
