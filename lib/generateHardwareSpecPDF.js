import { jsPDF } from "jspdf";
import { LOGO_DATA_URI } from "./logo";
import { specRows, CHRISTO } from "./hardwareSpec";

// ─────────────────────────────────────────────────────────────────
// Hardware specification PDF
// ─────────────────────────────────────────────────────────────────
// A4 portrait, ONE sheet by design: elevation with the evidence-status
// box beneath it on the left, the specification table on the right,
// then construction and standards across the full width. Every block
// is sized so a fully-loaded configuration (four leaves, every option,
// long finish text, all enquiry details) still lands on one page; the
// page-break fallbacks remain only for pathological inputs.
//
// "Unbranded" strips every supplier identification — no logo, no navy
// bands, no tagline — so an architect can drop the sheet straight into
// their own tender document. "Branded" carries the full identity.
// ─────────────────────────────────────────────────────────────────

const NAVY   = "#00387B";
const INK    = "#101922";
const BODY   = "#2B3641";
const MUTED  = "#57646F";
const RULE   = "#C4CCD4";
const SUNKEN = "#F2F5F7";
const WARN   = "#B4470E";

const BAND  = "#D8DFE7";
const EDGE  = "#3C4956";
const LEAF  = "#CBD5DF";

const CONTACT = {
  phone: "021 434 8996",
  email: "contact@mfservices.ie",
  website: "www.mfservices.ie",
};

const fill   = (d, hex) => d.setFillColor(hex);
const stroke = (d, hex) => d.setDrawColor(hex);
const ink    = (d, hex) => d.setTextColor(hex);

function box(d, x, y, w, h, fillHex, strokeHex, lw = 0.25) {
  if (fillHex) fill(d, fillHex);
  if (strokeHex) { stroke(d, strokeHex); d.setLineWidth(lw); }
  d.rect(x, y, w, h, fillHex && strokeHex ? "FD" : fillHex ? "F" : "S");
}

/** Doorset elevation, scaled to the entered dimensions. */
function drawElevation(doc, config, resolution, x, y, boxW, boxH) {
  const w = Number(config.width);
  const h = Number(config.height);
  const hasSize = Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0;
  const dw = hasSize ? w : 900;
  const dh = hasSize ? h : 2100;
  const leaves = config.leaves || 1;

  // Flush is the standard: no frame, no surround — just the leaves.
  // A chosen frame style draws its real architrave and nothing else.
  const flush = !config.frameStyle || config.frameStyle === "flush";
  const bandW = flush ? 0 : 2.6;

  // Leave room for the dimension annotations and the architrave.
  const innerW = boxW - 16 - 2 * bandW;
  const innerH = boxH - 18 - 2 * bandW;
  const scale = Math.min(innerW / dw, innerH / dh);
  const drawW = dw * scale;
  const drawH = dh * scale;
  const x0 = x + 12 + bandW + (innerW - drawW) / 2;
  const y0 = y + bandW + (innerH - drawH) / 2;

  // Architrave — one coherent band: picture = flat; raised picture
  // adds the 8 mm raised return; FrameSmart adds the liner joint.
  if (!flush) {
    box(doc, x0 - bandW, y0 - bandW, drawW + 2 * bandW, drawH + 2 * bandW, BAND, EDGE, 0.3);
    if (config.frameStyle === "raised-picture") {
      stroke(doc, EDGE); doc.setLineWidth(0.2);
      doc.rect(x0 - bandW * 0.6, y0 - bandW * 0.6, drawW + 2 * bandW * 0.6, drawH + 2 * bandW * 0.6, "S");
    }
    if (config.frameStyle === "framesmart") {
      stroke(doc, EDGE); doc.setLineWidth(0.15);
      doc.setLineDashPattern([1.2, 1], 0);
      doc.rect(x0 - bandW * 0.5, y0 - bandW * 0.5, drawW + bandW, drawH + bandW, "S");
      doc.setLineDashPattern([], 0);
    }
  }

  // Christo doors are pivot-hung — pivot pins, not hinges. The active
  // leaf carries the lock on the handing side; each leaf pivots
  // towards its nearer jamb.
  const rightHand = config.handing === "right";
  const leafW = drawW / leaves;
  for (let i = 0; i < leaves; i++) {
    const lx = x0 + i * leafW;
    box(doc, lx + 0.3, y0 + 0.3, leafW - 0.6, drawH - 0.6, LEAF, EDGE, 0.25);
    if (leafW > 7 && drawH > 12) {
      const pivotsRight = leaves === 1 ? rightHand : i >= leaves / 2;
      const pivotX = pivotsRight ? lx + leafW - 2.6 : lx + 0.9;
      for (const py of [y0 + 1.1, y0 + drawH - 2.9]) {
        box(doc, pivotX, py, 1.8, 1.8, "#6D7A88", EDGE, 0.2);
      }
      const isActive = leaves === 1 || (rightHand ? i === leaves - 1 : i === 0);
      if (isActive) {
        const lockX = pivotsRight ? lx + 1.9 : lx + leafW - 3.3;
        box(doc, lockX, y0 + drawH / 2 - 2, 1.4, 4, null, EDGE, 0.25);
      }
    }
  }

  stroke(doc, MUTED); doc.setLineWidth(0.2);
  // Width, below
  doc.line(x0, y0 + drawH + bandW + 3, x0, y0 + drawH + bandW + 7);
  doc.line(x0 + drawW, y0 + drawH + bandW + 3, x0 + drawW, y0 + drawH + bandW + 7);
  doc.line(x0, y0 + drawH + bandW + 5, x0 + drawW, y0 + drawH + bandW + 5);
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); ink(doc, hasSize ? INK : MUTED);
  doc.text(hasSize ? `${w} mm` : "—", x0 + drawW / 2, y0 + drawH + bandW + 11, { align: "center" });
  if (hasSize && resolution?.clear) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); ink(doc, MUTED);
    doc.text(`clear ${resolution.clear.width} × ${resolution.clear.height} mm`, x0 + drawW / 2, y0 + drawH + bandW + 15, { align: "center" });
  }

  // Height, left
  stroke(doc, MUTED);
  doc.line(x0 - bandW - 7, y0, x0 - bandW - 3, y0);
  doc.line(x0 - bandW - 7, y0 + drawH, x0 - bandW - 3, y0 + drawH);
  doc.line(x0 - bandW - 5, y0, x0 - bandW - 5, y0 + drawH);
  doc.text(hasSize ? `${h} mm` : "—", x0 - bandW - 8, y0 + drawH / 2, { align: "center", angle: 90 });

  return y + boxH;
}

export async function generateHardwareSpecPDF({ product, config, projectData, specType, resolution }) {
  const branded = specType !== "unbranded";
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const cW = pageW - margin * 2;

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric" });

  let y;

  // ══ Header ══════════════════════════════════════════════════
  if (branded) {
    fill(doc, NAVY); doc.rect(0, 0, pageW, 21, "F");
    doc.setFont("helvetica", "normal"); doc.setFontSize(15); ink(doc, "#FFFFFF");
    doc.text(`${product.label} — specification`, margin, 13.5);
    y = 27;
  } else {
    doc.setFont("helvetica", "normal"); doc.setFontSize(15); ink(doc, INK);
    doc.text(`${product.label} — specification`, margin, 17);
    stroke(doc, INK); doc.setLineWidth(0.6);
    doc.line(margin, 21, pageW - margin, 21);
    y = 27;
  }

  // ══ Project strip, logo on the right ════════════════════════
  const meta = [
    ["Project", projectData.projectName],
    ["Architectural firm", projectData.architecturalFirm],
    ["Date", dateStr],
  ].filter(([, v]) => v?.trim());

  if (branded) {
    // Native aspect ratio (the mark is ~5:1) — stretching it reads as
    // carelessness on the one sheet meant to sell precision.
    doc.addImage(LOGO_DATA_URI, "JPEG", pageW - margin - 26, y - 1.5, 26, 5.2);
  }

  // Values wrap to two lines rather than being clipped — project names
  // routinely run past a third of the sheet width.
  const metaW = cW - (branded ? 30 : 0);
  const colW = metaW / meta.length;
  let metaLines = 1;
  meta.forEach(([label, value], i) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); ink(doc, MUTED);
    doc.text(label.toUpperCase(), margin + i * colW, y);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); ink(doc, INK);
    const lines = doc.splitTextToSize(value.trim(), colW - 5).slice(0, 2);
    metaLines = Math.max(metaLines, lines.length);
    lines.forEach((l, li) => doc.text(l, margin + i * colW, y + 5 + li * 4.2));
  });
  y += 6 + metaLines * 4.2;
  stroke(doc, RULE); doc.setLineWidth(0.25);
  doc.line(margin, y, pageW - margin, y);
  y += 7;

  // ══ Left: elevation + evidence status · Right: spec table ═══
  const leftW = 72;
  const rightX = margin + leftW + 10;
  const rightW = pageW - margin - rightX;
  const bodyTop = y;

  // The evidence status and its reasons deliberately do NOT print —
  // the sheet states the specification and the sales team talks
  // sourcing and evidence through with the customer in person. The
  // resolution still travels internally for that conversation.
  drawElevation(doc, config, resolution, margin, bodyTop, leftW, 90);
  const leftY = bodyTop + 90 + 5;

  let ry = bodyTop;
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); ink(doc, MUTED);
  doc.text("SPECIFICATION", rightX, ry);
  ry += 4.5;

  const rows = specRows(product, config, resolution);
  rows.forEach((r, i) => {
    // The value column is whatever the label leaves. Measuring rather
    // than assuming a fixed split — option labels run long, and a
    // hardcoded offset silently overlaps them.
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    const labelW = doc.getTextWidth(r.label);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    const valueLines = doc.splitTextToSize(r.value, Math.max(24, rightW - labelW - 10));
    const rowH = Math.max(7, valueLines.length * 3.8 + 3.4);

    box(doc, rightX, ry, rightW, rowH, i % 2 === 0 ? "#FFFFFF" : SUNKEN);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); ink(doc, BODY);
    doc.text(r.label, rightX + 2.5, ry + 4.9);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); ink(doc, INK);
    valueLines.forEach((l, li) => doc.text(l, rightX + rightW - 2.5, ry + 4.9 + li * 3.8, { align: "right" }));

    ry += rowH;
    stroke(doc, RULE); doc.setLineWidth(0.12);
    doc.line(rightX, ry, rightX + rightW, ry);
  });

  y = Math.max(leftY, ry) + 8;

  // ══ Construction ════════════════════════════════════════════
  // The doorset's construction, written vendor-neutral in the data —
  // this is the paragraph an architect lifts into a tender.
  const construction = CHRISTO.construction;
  if (construction) {
    if (y + 26 > pageH - 20) { doc.addPage(); y = margin; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); ink(doc, MUTED);
    doc.text("CONSTRUCTION", margin, y);
    y += 4.5;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); ink(doc, BODY);
    const conLines = doc.splitTextToSize(construction, cW);
    conLines.forEach((l, i) => doc.text(l, margin, y + i * 3.7));
    y += conLines.length * 3.7 + 6;
  }

  // ══ Standards ═══════════════════════════════════════════════
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); ink(doc, MUTED);
  doc.text("STANDARDS", margin, y);
  y += 4.5;
  // Designations vary a lot in length — BS 476-22:1987 against
  // EN 1634-1:2014+A1:2018 — so the column is sized to the widest one
  // rather than a fixed offset the long ones overrun.
  doc.setFont("helvetica", "bold"); doc.setFontSize(8);
  const codeW = Math.max(...CHRISTO.standards.map(st => doc.getTextWidth(st.code))) + 6;

  for (const st of CHRISTO.standards) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    const descLines = doc.splitTextToSize(st.description, cW - codeW);
    const rowH = Math.max(1, descLines.length) * 3.7 + 2.4;
    if (y + rowH > pageH - 20) { doc.addPage(); y = margin; }

    doc.setFont("helvetica", "bold"); doc.setFontSize(8); ink(doc, INK);
    doc.text(st.code, margin, y + 3.4);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); ink(doc, BODY);
    descLines.forEach((l, i) => doc.text(l, margin + codeW, y + 3.4 + i * 3.7));

    y += rowH;
    stroke(doc, RULE); doc.setLineWidth(0.12);
    doc.line(margin, y, pageW - margin, y);
    y += 1.2;
  }

  // ══ Contact — branded sheets only ═══════════════════════════
  const enquiry = [
    projectData.businessName,
    projectData.contactName,
    projectData.email,
    projectData.phone,
  ].map(v => v?.trim()).filter(Boolean);

  if (branded && enquiry.length) {
    y += 4;
    if (y + 10 > pageH - 20) { doc.addPage(); y = margin; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); ink(doc, MUTED);
    doc.text("ENQUIRY FROM", margin, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); ink(doc, BODY);
    doc.splitTextToSize(enquiry.join("  ·  "), cW).slice(0, 2)
      .forEach((l, i) => doc.text(l, margin, y + 4.8 + i * 4));
  }

  // ══ Footer ══════════════════════════════════════════════════
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    if (branded) {
      fill(doc, NAVY); doc.rect(0, pageH - 14, pageW, 14, "F");
      fill(doc, "#FFFFFF"); doc.rect(margin, pageH - 8.2, 2.4, 2.4, "F");
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); ink(doc, "#FFFFFF");
      doc.text(`MF SERVICES  ·  ${CONTACT.phone}  ·  ${CONTACT.website}`, margin + 5.5, pageH - 6.2);
      doc.setFontSize(8);
      doc.text(`${p} / ${total}`, pageW - margin, pageH - 6.2, { align: "right" });
    } else {
      stroke(doc, RULE); doc.setLineWidth(0.25);
      doc.line(margin, pageH - 13, pageW - margin, pageH - 13);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); ink(doc, MUTED);
      doc.text(dateStr, margin, pageH - 8);
      doc.text(`${p} / ${total}`, pageW - margin, pageH - 8, { align: "right" });
    }
  }

  const filename = [
    "specification",
    product.id,
    projectData.projectName?.trim().replace(/\s+/g, "-").toLowerCase() || "untitled",
    now.toISOString().slice(0, 10),
  ].join("_") + ".pdf";

  doc.save(filename);
  return filename;
}
