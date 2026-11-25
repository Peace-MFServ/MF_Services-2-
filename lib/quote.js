import { resolveSteelDoor, describeSteelDoor, steelSpecRows, HARDWARE_GROUPS } from "./steelDoor";

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

// VAT is picked per quote, and can differ between the doorsets and the
// delivery and installation — 23% on product with 13.5% on labour is a
// real case (Liam, November 2026).
export const VAT_RATES = [0, 13.5, 23];
export const DEFAULT_VAT = 23;
const vatRate = v => {
  const n = Number(v);
  return VAT_RATES.includes(n) && String(v ?? "").trim() !== "" ? n : DEFAULT_VAT;
};

// Who the quote is for and the job it belongs to — the header of the
// customer quote. Text only; anything left out prints as a dash.
const DETAIL_KEYS = [
  "orderNo", "address1", "address2", "address3",
  "site", "siteContact", "salesperson", "salespersonEmail",
];

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

// ─── Component notes ──────────────────────────────────────────────
// What a technical pick means, in plain words, carried on the same
// line as the pick and its price in the PDF and the workbook — the
// quote records what the choice means, not just its name.
export function componentNote({ label, detail = "" }, type) {
  if (label === "Doorset") {
    if (!type) return "";
    return type.minutes === 0
      ? "not fire rated — no fire resistance classification"
      : `${type.classification} — fire resisting for ${type.minutes} minutes, integrity and insulation (EN 13501-2)`;
  }
  if (label === "Frame" && /thermal/i.test(detail)) {
    return "thermally broken: an insulating core cuts heat transfer and condensation";
  }
  if (label === "Lock" && /panic/i.test(detail)) {
    return "escape-route locking: opens from the inside in one movement even when locked from outside";
  }
  if (label === "High Performance") {
    return "65 mm leaf, high-density mineral wool core, corrosion resistance to C5 Marine";
  }
  if (label === "Smoke protection") {
    return "smoke sealed: seals restrict the passage of smoke around the leaf";
  }
  return "";
}

// ─── Choices without a price ─────────────────────────────────────
// The price list covers only some of what is picked. Handing, exposure,
// the finish and any part that costs nothing are choices all the same,
// so they join the priced parts as "included" rows — the quote records
// everything ticked, in the order the specification reads. The rows
// the description line already states are left out.
const IN_DESCRIPTION = new Set(["Quantity", "Doorset", "Fire rating", "Performance", "Structural opening"]);

const PART_ORDER = [
  "Doorset", "Exposure", "Clear opening", "Leaf size", "Handing", "Frame",
  ...HARDWARE_GROUPS.map(g => g.label).filter(l => l !== "Smoke protection"),
  "High Performance", "Flush panel", "Smoke protection", "Finish",
];

function partsFor(line, resolution) {
  const priced = (line.priced?.lines ?? []).map(c => ({
    label: c.label,
    detail: c.detail ?? "",
    amount: c.amount,
    note: componentNote(c, resolution.type),
  }));
  const shown = new Set(priced.map(c => c.label));
  if (shown.has("Hinges")) shown.add("Hinges per leaf");   // the priced row says how many

  const included = steelSpecRows(line.config, resolution)
    .filter(r => !IN_DESCRIPTION.has(r.label) && !shown.has(r.label) && r.value !== "—")
    .map(r => ({
      label: r.label,
      detail: r.value,
      amount: 0,
      included: true,
      note: componentNote({ label: r.label, detail: r.value }, resolution.type),
    }));

  const rank = label => {
    const i = PART_ORDER.indexOf(label);
    return i === -1 ? PART_ORDER.length : i;
  };
  return [...priced, ...included]
    .map((part, i) => ({ part, i }))
    .sort((a, b) => rank(a.part.label) - rank(b.part.label) || a.i - b.i)
    .map(({ part }) => part);
}

export function buildQuote({
  lines = [], margin, transport, labourMen, labourDays, discount, project = "", customer = "",
  details = {}, vatDoorsets, vatDelivery,
}) {
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
      // For the customer quote, which states these on their own rows.
      fireRating: resolution.type
        ? { minutes: resolution.type.minutes, classification: resolution.type.classification }
        : null,
      size: line.config.width && line.config.height ? `${line.config.width} × ${line.config.height} mm` : null,
      components: partsFor(line, resolution),
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
  const header = Object.fromEntries(DETAIL_KEYS.map(k => [k, String(details?.[k] ?? "").trim()]));
  header.site ||= project.trim();          // the site is usually the project

  return {
    project: project.trim(),
    customer: customer.trim(),
    details: header,
    vatRates: { doorsets: vatRate(vatDoorsets), delivery: vatRate(vatDelivery) },
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

/** The internal breakdown says so in its name, so it is hard to
 *  attach to a customer email by mistake. */
export function quoteFilename(quote, ext, { internal = false } = {}) {
  const project = quote.project.replace(/\s+/g, "-").toLowerCase() || "untitled";
  return `${internal ? "INTERNAL_" : ""}quote_${project}_${new Date().toISOString().slice(0, 10)}.${ext}`;
}

const round = n => Math.round(n * 100) / 100;
