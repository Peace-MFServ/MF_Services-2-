import { resolveSteelDoor, describeSteelDoor } from "./steelDoor";

// ─────────────────────────────────────────────────────────────────
// A quote, as data
// ─────────────────────────────────────────────────────────────────
// The PDF and the spreadsheet are two renderings of the same quote, so
// the quote itself is built once, here, from what the Pricer holds.
// Amounts of null mean "on application" — no published price yet — and
// both renderings must show that rather than a zero.
// ─────────────────────────────────────────────────────────────────

const num = v => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function buildQuote({ lines = [], markup, transport, project = "" }) {
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

  const subtotal = round(doorsets.reduce((sum, d) => sum + (d.lineTotal ?? 0), 0));
  const markupPct = num(markup);
  const margin = round(subtotal * markupPct / 100);
  const carriage = num(transport);

  return {
    project: project.trim(),
    currency: "EUR",
    doorsets,
    subtotal,
    markupPct,
    margin,
    transport: carriage,
    total: round(subtotal + margin + carriage),
    unpriced: doorsets.filter(d => d.onApplication).length,
  };
}

export function quoteFilename(quote, ext) {
  const project = quote.project.replace(/\s+/g, "-").toLowerCase() || "untitled";
  return `quote_${project}_${new Date().toISOString().slice(0, 10)}.${ext}`;
}

const round = n => Math.round(n * 100) / 100;
