import { jsPDF } from "jspdf";
import { LOGO_DATA_URI } from "./logo";
import { specRows, isBespoke, needsEvidence } from "./hardwareSpec";

// ─────────────────────────────────────────────────────────────────
// Hardware specification PDF
// ─────────────────────────────────────────────────────────────────
// A4 portrait, one sheet: elevation and specification side by side,
// standards beneath.
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

const FRAME = "#8895A3";
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

  // Leave room for the dimension annotations.
  const innerW = boxW - 16;
  const innerH = boxH - 18;
  const scale = Math.min(innerW / dw, innerH / dh);
  const drawW = dw * scale;
  const drawH = dh * scale;
  const x0 = x + 12 + (innerW - drawW) / 2;
  const y0 = y + (innerH - drawH) / 2;

  const frameT = Math.max(1.2, Math.min(3.4, drawW * 0.022));

  box(doc, x0, y0, drawW, drawH, FRAME, EDGE, 0.3);

  // Handing mirrors the on-screen elevation: the active leaf carries
  // the lock on the handing side; each leaf hinges towards its jamb.
  const rightHand = config.handing === "right";
  const leafW = (drawW - frameT * 2) / leaves;
  const leafH = drawH - frameT * 2;
  for (let i = 0; i < leaves; i++) {
    const lx = x0 + frameT + i * leafW;
    box(doc, lx + 0.3, y0 + frameT + 0.3, leafW - 0.6, leafH - 0.6, LEAF, EDGE, 0.25);
    if (leafW > 7 && leafH > 12) {
      const hingesRight = leaves === 1 ? rightHand : i >= leaves / 2;
      const hingeX = hingesRight ? lx + leafW - 1.6 : lx + 0.2;
      for (const f of [0.16, 0.5, 0.84]) {
        box(doc, hingeX, y0 + frameT + leafH * f - 2, 1.4, 4, "#6D7A88", EDGE, 0.2);
      }
      const isActive = leaves === 1 || (rightHand ? i === leaves - 1 : i === 0);
      if (isActive) {
        const lockX = hingesRight ? lx + 1.6 : lx + leafW - 3;
        box(doc, lockX, y0 + frameT + leafH / 2 - 2, 1.4, 4, "#8E9BA8", EDGE, 0.2);
      }
    }
  }

  stroke(doc, MUTED); doc.setLineWidth(0.2);
  // Width, below
  doc.line(x0, y0 + drawH + 3, x0, y0 + drawH + 7);
  doc.line(x0 + drawW, y0 + drawH + 3, x0 + drawW, y0 + drawH + 7);
  doc.line(x0, y0 + drawH + 5, x0 + drawW, y0 + drawH + 5);
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); ink(doc, hasSize ? INK : MUTED);
  doc.text(hasSize ? `${w} mm` : "—", x0 + drawW / 2, y0 + drawH + 11, { align: "center" });
  if (hasSize && resolution?.clear) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); ink(doc, MUTED);
    doc.text(`clear ${resolution.clear.width} × ${resolution.clear.height} mm`, x0 + drawW / 2, y0 + drawH + 15, { align: "center" });
  }

  // Height, left
  stroke(doc, MUTED);
  doc.line(x0 - 7, y0, x0 - 3, y0);
  doc.line(x0 - 7, y0 + drawH, x0 - 3, y0 + drawH);
  doc.line(x0 - 5, y0, x0 - 5, y0 + drawH);
  doc.text(hasSize ? `${h} mm` : "—", x0 - 8, y0 + drawH / 2, { align: "center", angle: 90 });

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
    fill(doc, NAVY); doc.rect(0, 0, pageW, 28, "F");
    doc.setFont("helvetica", "normal"); doc.setFontSize(17); ink(doc, "#FFFFFF");
    doc.text(`${product.label} — specification`, margin, 18);
    doc.addImage(LOGO_DATA_URI, "JPEG", pageW - margin - 28, 32, 28, 9);
    y = 47;
  } else {
    doc.setFont("helvetica", "normal"); doc.setFontSize(17); ink(doc, INK);
    doc.text(`${product.label} — specification`, margin, 22);
    stroke(doc, INK); doc.setLineWidth(0.6);
    doc.line(margin, 27, pageW - margin, 27);
    y = 36;
  }

  // ══ Project strip ═══════════════════════════════════════════
  const meta = [
    ["Project", projectData.projectName],
    ["Architectural firm", projectData.architecturalFirm],
    ["Date", dateStr],
  ].filter(([, v]) => v?.trim());

  // Values wrap to two lines rather than being clipped — project names
  // routinely run past a third of the sheet width.
  const colW = cW / meta.length;
  let metaLines = 1;
  meta.forEach(([label, value], i) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); ink(doc, MUTED);
    doc.text(label.toUpperCase(), margin + i * colW, y);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); ink(doc, INK);
    const lines = doc.splitTextToSize(value.trim(), colW - 5).slice(0, 2);
    metaLines = Math.max(metaLines, lines.length);
    lines.forEach((l, li) => doc.text(l, margin + i * colW, y + 5.5 + li * 4.6));
  });
  y += 7 + metaLines * 4.6;
  stroke(doc, RULE); doc.setLineWidth(0.25);
  doc.line(margin, y, pageW - margin, y);
  y += 9;

  // ══ Elevation and specification, side by side ═══════════════
  const leftW = 72;
  const rightX = margin + leftW + 10;
  const rightW = pageW - margin - rightX;
  const bodyTop = y;

  drawElevation(doc, config, resolution, margin, bodyTop, leftW, 96);

  let ry = bodyTop;
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); ink(doc, MUTED);
  doc.text("SPECIFICATION", rightX, ry);
  ry += 5;

  const rows = specRows(product, config, resolution);
  rows.forEach((r, i) => {
    // The value column is whatever the label leaves. Measuring rather
    // than assuming a fixed split — option labels run long, and a
    // hardcoded offset silently overlaps them.
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    const labelW = doc.getTextWidth(r.label);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
    const valueLines = doc.splitTextToSize(r.value, Math.max(24, rightW - labelW - 10));
    const rowH = Math.max(9, valueLines.length * 4.2 + 4.8);

    box(doc, rightX, ry, rightW, rowH, i % 2 === 0 ? "#FFFFFF" : SUNKEN);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); ink(doc, BODY);
    doc.text(r.label, rightX + 2.5, ry + 5.8);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); ink(doc, INK);
    valueLines.forEach((l, li) => doc.text(l, rightX + rightW - 2.5, ry + 5.8 + li * 4.2, { align: "right" }));

    ry += rowH;
    stroke(doc, RULE); doc.setLineWidth(0.12);
    doc.line(rightX, ry, rightX + rightW, ry);
  });

  y = Math.max(bodyTop + 96, ry) + 12;

  // ══ Basis of the size ═══════════════════════════════════════
  // No catalogue code — the business specifies to requirement and
  // sources against it. What the sheet has to be straight about is
  // whether a test report actually covers the leaf being asked for, or
  // whether that is only a supplier's word. Those are not the same
  // claim and the sheet does not let them read as one.
  if (resolution?.status === "evidenced") {
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    const basis = doc.splitTextToSize(resolution.basis ?? "", cW - 12);
    const h = 16 + basis.length * 3.6;
    box(doc, margin, y, cW, h, SUNKEN);
    box(doc, margin, y, 1.6, h, NAVY);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); ink(doc, MUTED);
    doc.text("SPECIFICATION", margin + 5, y + 6);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); ink(doc, INK);
    doc.text(`${resolution.leaves} ${resolution.leaves === 1 ? "leaf" : "leaves"}`, margin + 5, y + 12);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); ink(doc, BODY);
    doc.text("Supplied and installed", pageW - margin - 5, y + 12, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); ink(doc, MUTED);
    basis.forEach((l, i) => doc.text(l, margin + 5, y + 17.5 + i * 3.6));
    y += h + 8;
  } else if (needsEvidence(resolution) || isBespoke(resolution)) {
    const lines = doc.splitTextToSize(resolution.reason, cW - 12);
    const h = 11 + lines.length * 4.2;
    box(doc, margin, y, cW, h, "#FBF3EC");
    box(doc, margin, y, 1.6, h, WARN);
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); ink(doc, WARN);
    doc.text(isBespoke(resolution) ? "BESPOKE ENQUIRY" : "TEST REPORT TO CONFIRM", margin + 5, y + 6);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); ink(doc, BODY);
    lines.forEach((l, i) => doc.text(l, margin + 5, y + 11.5 + i * 4.2));
    y += h + 8;
  }

  // ══ Construction ════════════════════════════════════════════
  // The matched doorset's construction, written vendor-neutral in the
  // data — this is the paragraph an architect lifts into a tender.
  const construction = resolution?.match?.best?.product?.construction ?? product.construction;
  if (construction) {
    if (y + 32 > pageH - 22) { doc.addPage(); y = margin; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); ink(doc, MUTED);
    doc.text("CONSTRUCTION", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); ink(doc, BODY);
    const conLines = doc.splitTextToSize(construction, cW);
    conLines.forEach((l, i) => doc.text(l, margin, y + i * 4));
    y += conLines.length * 4 + 7;
  }

  // ══ Standards ═══════════════════════════════════════════════
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); ink(doc, MUTED);
  doc.text("STANDARDS", margin, y);
  y += 5;
  // Designations vary a lot in length — BS 476-22:1987 against
  // EN 1634-1:2014+A1:2018 — so the column is sized to the widest one
  // rather than a fixed offset the long ones overrun.
  doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  const codeW = Math.max(...product.standards.map(st => doc.getTextWidth(st.code))) + 7;

  for (const st of product.standards) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    const descLines = doc.splitTextToSize(st.description, cW - codeW);
    const rowH = Math.max(1, descLines.length) * 4 + 3.5;
    if (y + rowH > pageH - 22) { doc.addPage(); y = margin; }

    doc.setFont("helvetica", "bold"); doc.setFontSize(9); ink(doc, INK);
    doc.text(st.code, margin, y + 4);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); ink(doc, BODY);
    descLines.forEach((l, i) => doc.text(l, margin + codeW, y + 4 + i * 4));

    y += rowH;
    stroke(doc, RULE); doc.setLineWidth(0.12);
    doc.line(margin, y, pageW - margin, y);
    y += 1.5;
  }

  // ══ Contact — branded sheets only ═══════════════════════════
  const enquiry = [
    projectData.businessName,
    projectData.contactName,
    projectData.email,
    projectData.phone,
  ].map(v => v?.trim()).filter(Boolean);

  if (branded && enquiry.length) {
    y += 6;
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); ink(doc, MUTED);
    doc.text("ENQUIRY FROM", margin, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); ink(doc, BODY);
    doc.splitTextToSize(enquiry.join("  ·  "), cW).slice(0, 2)
      .forEach((l, i) => doc.text(l, margin, y + 5.5 + i * 4.5));
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
