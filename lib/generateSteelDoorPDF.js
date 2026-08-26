import { jsPDF } from "jspdf";
import { LOGO_DATA_URI } from "./logo";
import { steelSpecRows, constructionFor, standardsFor, describeSteelDoor } from "./steelDoor";

// ─────────────────────────────────────────────────────────────────
// Steel doorset specification PDF
// ─────────────────────────────────────────────────────────────────
// The same sheet the riser doors produce — A4 portrait, one page,
// elevation on the left, specification table on the right, then
// construction and standards across the full width — drawn for a
// hinged doorset in a visible frame rather than a pivot-hung riser
// set. Keeping the two generators apart means the steel elevation can
// grow (vision panels, louvres, grills) without touching the sheet the
// team already signed off on.
//
// "Unbranded" strips every supplier identification so an architect can
// drop the sheet straight into their own tender document.
// ─────────────────────────────────────────────────────────────────

const NAVY   = "#00387B";
const INK    = "#101922";
const BODY   = "#2B3641";
const MUTED  = "#57646F";
const RULE   = "#C4CCD4";
const SUNKEN = "#F2F5F7";

const EDGE  = "#3C4956";
const FRAME = "#8895A3";
const LEAF  = "#CBD5DF";
const DEEP  = "#6D7A88";

const CONTACT = {
  phone: "021 434 8996",
  website: "www.mfservices.ie",
};

// Frame face widths on the drawing, by family. The real profiles
// differ in depth rather than face, but a visible difference is what
// makes the choice legible.
const FRAME_FACE = { c: 1.6, e: 2.3, b: 3.2 };

const HINGE_FRACTIONS = [0.12, 0.5, 0.88];

const fill   = (d, hex) => d.setFillColor(hex);
const stroke = (d, hex) => d.setDrawColor(hex);
const ink    = (d, hex) => d.setTextColor(hex);

function box(d, x, y, w, h, fillHex, strokeHex, lw = 0.25) {
  if (fillHex) fill(d, fillHex);
  if (strokeHex) { stroke(d, strokeHex); d.setLineWidth(lw); }
  d.rect(x, y, w, h, fillHex && strokeHex ? "FD" : fillHex ? "F" : "S");
}

/** Elevation of the configured doorset, scaled to the entered size. */
function drawElevation(doc, config, resolution, x, y, boxW, boxH) {
  const type = resolution?.type;
  const w = Number(config.width);
  const h = Number(config.height);
  const hasSize = Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0;
  const dw = hasSize ? w : 1000;
  const dh = hasSize ? h : 2100;
  const leaves = type?.leaves ?? 1;
  const face = FRAME_FACE[resolution?.frame?.class] ?? FRAME_FACE.c;

  // Room for the dimension annotations on two sides.
  const innerW = boxW - 16;
  const innerH = boxH - 18;
  const scale = Math.min(innerW / dw, innerH / dh);
  const drawW = dw * scale;
  const drawH = dh * scale;
  const x0 = x + 12 + (innerW - drawW) / 2;
  const y0 = y + (innerH - drawH) / 2;

  // Frame, drawn as a section around the opening.
  box(doc, x0, y0, drawW, drawH, FRAME, EDGE, 0.3);
  const inL = x0 + face;
  const inT = y0 + face;
  const inW = Math.max(drawW - 2 * face, 0.5);
  const inH = Math.max(drawH - face, 0.5);
  box(doc, inL, inT, inW, inH, "#FFFFFF", EDGE, 0.2);

  const rightHand = config.handing === "right";
  const leafW = inW / leaves;

  // Leaf size, written on the leaf itself — horizontal, shrunk to fit,
  // stacked onto two lines rather than turned on its side.
  const clear = resolution?.clear;
  const leafText = clear ? `${Math.round(clear.width / leaves)} × ${clear.height}` : null;
  let leafLabel = null;
  if (leafText) {
    doc.setFont("helvetica", "normal");
    const avail = leafW - 2.2;
    let size = 5.6;
    doc.setFontSize(size);
    while (size > 3.4 && doc.getTextWidth(leafText) > avail) {
      size -= 0.3;
      doc.setFontSize(size);
    }
    leafLabel = doc.getTextWidth(leafText) <= avail
      ? { size, lines: [leafText] }
      : { size, lines: [String(Math.round(clear.width / leaves)), `× ${clear.height}`] };
  }

  for (let i = 0; i < leaves; i++) {
    const lx = inL + i * leafW;
    box(doc, lx + 0.2, inT + 0.2, leafW - 0.4, inH - 0.4, LEAF, EDGE, 0.25);
    if (leafW < 7 || inH < 14) continue;

    // A pair meets in the middle and hangs on the outer jambs.
    const hingeLeft = leaves === 1 ? !rightHand : i === 0;
    const hx = hingeLeft ? lx - 0.4 : lx + leafW - 1.8;
    for (const f of HINGE_FRACTIONS) {
      box(doc, hx, inT + inH * f - 2, 2.2, 4, DEEP, EDGE, 0.15);
    }

    // The active leaf carries the lever and cylinder.
    const isActive = leaves === 1 || (rightHand ? i === leaves - 1 : i === 0);
    if (isActive) {
      const leadX = hingeLeft ? lx + leafW - 5 : lx + 1.6;
      box(doc, leadX, inT + inH / 2 - 0.5, 3.4, 1, DEEP, EDGE, 0.15);
      fill(doc, "#F4F6F8"); stroke(doc, EDGE); doc.setLineWidth(0.2);
      doc.circle(leadX + 1.7, inT + inH / 2 + 2.6, 0.8, "FD");
    }

    if (leafLabel) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(leafLabel.size); ink(doc, MUTED);
      const lineH = leafLabel.size * 0.36;
      leafLabel.lines.forEach((line, n) => {
        doc.text(line, lx + leafW / 2, inT + inH * 0.34 + n * lineH, { align: "center" });
      });
    }
  }

  stroke(doc, MUTED); doc.setLineWidth(0.2);
  // Width, below
  doc.line(x0, y0 + drawH + 3, x0, y0 + drawH + 7);
  doc.line(x0 + drawW, y0 + drawH + 3, x0 + drawW, y0 + drawH + 7);
  doc.line(x0, y0 + drawH + 5, x0 + drawW, y0 + drawH + 5);
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); ink(doc, hasSize ? INK : MUTED);
  doc.text(hasSize ? `${w} mm` : "—", x0 + drawW / 2, y0 + drawH + 11, { align: "center" });
  if (clear) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); ink(doc, MUTED);
    doc.text(`clear ${clear.width} × ${clear.height} mm`, x0 + drawW / 2, y0 + drawH + 15, { align: "center" });
  }

  // Height, left
  stroke(doc, MUTED);
  doc.line(x0 - 7, y0, x0 - 3, y0);
  doc.line(x0 - 7, y0 + drawH, x0 - 3, y0 + drawH);
  doc.line(x0 - 5, y0, x0 - 5, y0 + drawH);
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); ink(doc, hasSize ? INK : MUTED);
  doc.text(hasSize ? `${h} mm` : "—", x0 - 8, y0 + drawH / 2, { align: "center", angle: 90 });

  return y + boxH;
}

export async function generateSteelDoorPDF({ config, projectData = {}, specType, resolution }) {
  const branded = specType !== "unbranded";
  const type = resolution?.type;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const cW = pageW - margin * 2;

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric" });

  let y;

  // ══ Header ══════════════════════════════════════════════════
  const title = "Steel Doors — specification";
  if (branded) {
    fill(doc, NAVY); doc.rect(0, 0, pageW, 21, "F");
    doc.setFont("helvetica", "normal"); doc.setFontSize(15); ink(doc, "#FFFFFF");
    doc.text(title, margin, 13.5);
  } else {
    doc.setFont("helvetica", "normal"); doc.setFontSize(15); ink(doc, INK);
    doc.text(title, margin, 17);
    stroke(doc, INK); doc.setLineWidth(0.6);
    doc.line(margin, 21, pageW - margin, 21);
  }
  y = 27;

  // ══ Project strip, logo on the right ════════════════════════
  const meta = [
    ["Project", projectData.projectName],
    ["Architectural firm", projectData.architecturalFirm],
    ["Date", dateStr],
  ].filter(([, v]) => v?.trim());

  if (branded) {
    doc.addImage(LOGO_DATA_URI, "JPEG", pageW - margin - 26, y - 1.5, 26, 5.2);
  }

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

  // ══ What this doorset is, in one line ═══════════════════════
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); ink(doc, INK);
  doc.text(describeSteelDoor(type), margin, y);
  y += 7;

  // ══ Left: elevation · Right: specification table ════════════
  const leftW = 72;
  const rightX = margin + leftW + 10;
  const rightW = pageW - margin - rightX;
  const bodyTop = y;

  drawElevation(doc, config, resolution, margin, bodyTop, leftW, 90);
  const leftY = bodyTop + 90 + 5;

  let ry = bodyTop;
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); ink(doc, MUTED);
  doc.text("SPECIFICATION", rightX, ry);
  ry += 4.5;

  const rows = steelSpecRows(config, resolution);
  rows.forEach((r, i) => {
    // The value column is whatever the label leaves — measured, not
    // assumed, because frame names run long.
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
  const paras = constructionFor(type);
  if (paras.length) {
    if (y + 26 > pageH - 20) { doc.addPage(); y = margin; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); ink(doc, MUTED);
    doc.text("CONSTRUCTION", margin, y);
    y += 4.5;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); ink(doc, BODY);
    for (const para of paras) {
      const lines = doc.splitTextToSize(para, cW);
      if (y + lines.length * 3.7 > pageH - 20) { doc.addPage(); y = margin; }
      lines.forEach((l, i) => doc.text(l, margin, y + i * 3.7));
      y += lines.length * 3.7 + 2.6;
    }
    y += 3.4;
  }

  // ══ Standards ═══════════════════════════════════════════════
  const standards = standardsFor(type, resolution?.exposure);
  if (standards.length) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); ink(doc, MUTED);
    doc.text("STANDARDS", margin, y);
    y += 4.5;
    doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    const codeW = Math.max(...standards.map(st => doc.getTextWidth(st.code))) + 6;

    for (const st of standards) {
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
    "steel-doors",
    projectData.projectName?.trim().replace(/\s+/g, "-").toLowerCase() || "untitled",
    now.toISOString().slice(0, 10),
  ].join("_") + ".pdf";

  doc.save(filename);
  return filename;
}
