import { resolveSteelDoor, describeSteelDoor } from "./steelDoor";

// ─────────────────────────────────────────────────────────────────
// A quote, as data
// ─────────────────────────────────────────────────────────────────
// The PDF and the spreadsheet are two renderings of the same quote, so
// the quote itself is built once, here, from what the Pricer holds.
// Amounts of null mean "on application" — no published price yet — and
// both renderings must show that rather than a zero.
//
// The selling arithmetic, as the estimators work it:
//
//   doorsets + transport + labour            = cost subtotal
//   ÷ (1 − margin%)                          margin is 40% OF THE SALE
//   × (1 − discount%)                        discount capped at 5%
//   = total
//
// Margin on the sale is why the subtotal divides by 0.6 rather than
// multiplying by 1.4. Labour is men × days at €450 a man a day, and a
// job never sends fewer than two men.
// ─────────────────────────────────────────────────────────────────

export const LABOUR_RATE = 450;   // € per man per day
export const MIN_MEN = 2;
export const MAX_DISCOUNT = 5;    // %
export const DEFAULT_MARGIN = 40; // %

// Margin has to stay clear of 100% — the division runs away long
// before that. Nobody prices at 95% margin; the cap is a seatbelt.
const MAX_MARGIN = 95;

const num = v => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Labour as charged: none at all until days are entered, and never
 *  fewer than two men once they are. */
export function labourFor({ labourMen, labourDays }) {
  const days = Math.max(0, num(labourDays));
  const men = days > 0 ? Math.max(MIN_MEN, num(labourMen) || MIN_MEN) : 0;
  return { men, days, rate: LABOUR_RATE, total: round(men * days * LABOUR_RATE) };
}

export function buildQuote({ lines = [], margin, transport, labourMen, labourDays, discount, project = "" }) {
  const doorsets = lines.map(line => {
    const resolution = resolveSteelDoor(line.config);
    const qty = num(line.quantity);
    const priced = line.priced;
    const each = priced && !priced.onApplication ? priced.total : null;
    return {
      name: line.name,
      description: [
        resolution.type ? describeSteelDoor(resolution.type) : null,
        line.config.width && line.config.height ? `${line.config.width} × ${line.config.height} mm` : null,
        resolution.frame ? `${resolution.frame.label} frame` : null,
      ].filter(Boolean).join(" · "),
      qty,
      each,
      lineTotal: each == null ? null : round(each * qty),
      onApplication: !priced || priced.onApplication,
      components: (priced?.lines ?? []).map(c => ({
        label: c.label,
        detail: c.detail ?? "",
        amount: c.amount,
      })),
    };
  });

  const doorsetsCost = round(doorsets.reduce((sum, d) => sum + (d.lineTotal ?? 0), 0));
  const carriage = num(transport);
  const labour = labourFor({ labourMen, labourDays });

  const subtotal = round(doorsetsCost + carriage + labour.total);
  const marginPct = clamp(num(margin), 0, MAX_MARGIN);
  const beforeDiscount = round(subtotal / (1 - marginPct / 100));
  const discountPct = clamp(num(discount), 0, MAX_DISCOUNT);
  const discountAmount = round(beforeDiscount * discountPct / 100);

  return {
    project: project.trim(),
    currency: "EUR",
    doorsets,
    doorsetsCost,
    transport: carriage,
    labour,
    subtotal,
    marginPct,
    marginAmount: round(beforeDiscount - subtotal),
    beforeDiscount,
    discountPct,
    discountAmount,
    total: round(beforeDiscount - discountAmount),
    unpriced: doorsets.filter(d => d.onApplication).length,
  };
}

export function quoteFilename(quote, ext) {
  const project = quote.project.replace(/\s+/g, "-").toLowerCase() || "untitled";
  return `quote_${project}_${new Date().toISOString().slice(0, 10)}.${ext}`;
}

const round = n => Math.round(n * 100) / 100;
