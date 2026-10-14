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

/** A part as the customer reads it — the pick, never its price. The
 *  supplier is not named on anything a customer receives. */
export function customerPart({ label, detail, note }) {
  const text = [label, detail, note].filter(Boolean).join(" — ");
  return text.replace(/\s*\bDFM\b/g, "").replace(/\s{2,}/g, " ").trim();
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
  ]);
  let h = 0x811c9dc5;                               // FNV-1a
  for (let i = 0; i < basis.length; i++) {
    h ^= basis.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `Q-${ymd}-${h.toString(16).toUpperCase().padStart(8, "0").slice(0, 4)}`;
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
      parts: d.components.map(customerPart).filter(Boolean),
    };
  });

  let doorsetsTotal = round(doorsets.reduce((s, d) => s + (d.lineTotal ?? 0), 0));
  let delivery = 0;
  if (quote.transport + quote.labour.total > 0) {
    // The remainder of the internal selling figure — the delivery
    // cost marked up, give or take the cents of rounding the doorsets.
    delivery = round(quote.beforeDiscount - doorsetsTotal);
  } else {
    // No delivery line to take the cents: settle them on one doorset,
    // a single one where there is one, so "each" still reads true.
    const residual = round(quote.beforeDiscount - doorsetsTotal);
    const priced = doorsets.filter(d => d.lineTotal != null);
    if (residual !== 0 && priced.length) {
      const target = priced.find(d => d.qty === 1)
        ?? priced.reduce((a, b) => (b.lineTotal > a.lineTotal ? b : a));
      target.lineTotal = round(target.lineTotal + residual);
      if (target.qty === 1) target.each = target.lineTotal;
      doorsetsTotal = round(doorsetsTotal + residual);
    }
  }

  return {
    reference: quoteReference(quote, date),
    project: quote.project,
    currency: quote.currency,
    doorsets,
    doorsetsTotal,
    delivery,
    beforeDiscount: quote.beforeDiscount,
    discountPct: quote.discountPct,
    discountAmount: quote.discountAmount,
    total: quote.total,
    unpriced: quote.unpriced,
  };
}
