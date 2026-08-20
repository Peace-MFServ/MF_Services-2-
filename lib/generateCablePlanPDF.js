import { jsPDF } from "jspdf";
import { LOGO_DATA_URI } from "./logo";
import {
  DRAW,
  resolveCable, activeCableLegend,
  flattenComponents, buildInclusionMap, isMandatoryForSystem, getRemarksOverride, validateConfiguration,
} from "./cablePlanSpec";

// ─────────────────────────────────────────────────────────────────
// Cable plan PDF
// ─────────────────────────────────────────────────────────────────
// A single A4 landscape sheet: navy title band, project strip, then
// the elevation and cable key on the left with the schedule on the
// right, over a navy footer band.
//
// Reading the plan means matching a position number on the drawing to
// its cable in the table, so both have to be in view at once. Split
// across portrait pages it meant flipping back and forth.
//
// The elevation is drawn from the same geometry the screen uses
// (lib/cablePlanSpec.js), scaled from the SVG viewBox into millimetres,
// so the issued sheet and the configurator cannot diverge.
// ─────────────────────────────────────────────────────────────────

const NAVY   = "#00387B";
const INK    = "#101922";
const BODY   = "#2B3641";
const MUTED  = "#57646F";
const RULE   = "#C4CCD4";
const SUNKEN = "#F2F5F7";
const WARN   = "#B4470E";

const PT_PER_MM = 2.8346;

const TYPE_LABELS = {
  power_supply: "Power supply", e_opener: "Electric opener", bolt_switch: "Bolt switch",
  cable_transition: "Cable transition", sensor_strip: "Sensor", flip_switch: "Flip switch",
  radar_sensor: "Radar sensor", program_switch: "Program switch",
  manual_release_button: "Release button", smoke_detector: "Smoke detector",
  sequence_controller: "Closing sequence",
};

// ─── jsPDF helpers ───────────────────────────────────────────────
const fill    = (d, hex) => d.setFillColor(hex);
const stroke  = (d, hex) => d.setDrawColor(hex);
const ink     = (d, hex) => d.setTextColor(hex);
const solid   = d => d.setLineDashPattern([], 0);
const dashed  = (d, a, b) => d.setLineDashPattern([a, b], 0);

function band(d, y, h, w, hex) { fill(d, hex); d.rect(0, y, w, h, "F"); }

function box(d, x, y, w, h, fillHex, strokeHex, lw = 0.25) {
  if (fillHex) fill(d, fillHex);
  if (strokeHex) { stroke(d, strokeHex); d.setLineWidth(lw); }
  d.rect(x, y, w, h, fillHex && strokeHex ? "FD" : fillHex ? "F" : "S");
}

// ─── Elevation renderer ──────────────────────────────────────────
/**
 * Draw the door elevation into the PDF.
 * Maps the SVG viewBox used on screen into millimetres at `scale`.
 */
function drawElevation(doc, system, componentStates, ox, oy, scale) {
  const { view, geo, controller, anchors } = system.drawing;
  const X = v => ox + (v - view.x) * scale;
  const Y = v => oy + (v - view.y) * scale;
  const S = v => v * scale;
  const fs = svgSize => Math.max(3.2, svgSize * scale * PT_PER_MM);

  const flat = flattenComponents(system);
  const inclusion = buildInclusionMap(system, componentStates);

  const opL = geo.leaves[0].l;
  const opR = geo.leaves[geo.leaves.length - 1].r;
  const activeLeaf = geo.leaves.find(lf => lf.active) ?? geo.leaves[0];
  const leadingX = activeLeaf.hinge === "left" ? activeLeaf.r : activeLeaf.l;
  const leadDir = activeLeaf.hinge === "left" ? -1 : 1;

  doc.setFont("helvetica", "normal");
  solid(doc);

  // ── Frame ──────────────────────────────────────────────────
  // The assembly floats on white; no wall or ceiling fill.
  box(doc, X(geo.openL), Y(geo.headY), S(geo.openR - geo.openL), S(geo.jambW), DRAW.frame, DRAW.frameEdge, 0.3);
  box(doc, X(geo.openL), Y(geo.headY), S(geo.jambW), S(geo.floorY - geo.headY), DRAW.frame, DRAW.frameEdge, 0.3);
  box(doc, X(geo.openR - geo.jambW), Y(geo.headY), S(geo.jambW), S(geo.floorY - geo.headY), DRAW.frame, DRAW.frameEdge, 0.3);
  box(doc, X(geo.openL), Y(geo.floorY - 7), S(geo.openR - geo.openL), S(7), DRAW.frame, DRAW.frameEdge, 0.3);

  // Concealed route through the frame
  dashed(doc, 1.4, 1);
  stroke(doc, "#2E9E4F"); doc.setLineWidth(0.25);
  doc.rect(X(geo.openL + 5), Y(geo.headY + 5), S(geo.openR - geo.openL - 10), S(geo.floorY - geo.headY - 10), "S");
  solid(doc);

  // ── Operator, spanning the leaves ──────────────────────────
  box(doc, X(opL), Y(geo.opTop), S(opR - opL), S(geo.opBot - geo.opTop), "#FFFFFF", DRAW.frameEdge, 0.3);
  doc.setFont("helvetica", "bold"); doc.setFontSize(fs(11)); ink(doc, INK);
  doc.text(system.systemVariant || system.name, X(opL + 10), Y(geo.opTop + 14));

  // ── Leaves ─────────────────────────────────────────────────
  for (const leaf of geo.leaves) {
    box(doc, X(leaf.l), Y(geo.leafTop), S(leaf.r - leaf.l), S(geo.leafBot - geo.leafTop), DRAW.leaf, DRAW.leafEdge, 0.3);
    stroke(doc, DRAW.leafEdge); doc.setLineWidth(0.15);
    doc.rect(X(leaf.l + 14), Y(geo.leafTop + 14), S(leaf.r - leaf.l - 28), S(geo.leafBot - geo.leafTop - 28), "S");

    for (const f of [0.13, 0.49, 0.86]) {
      const hy = geo.leafTop + (geo.leafBot - geo.leafTop) * f;
      const hx = leaf.hinge === "left" ? leaf.l - 5 : leaf.r - 5;
      box(doc, X(hx), Y(hy), S(10), S(30), DRAW.hardware, DRAW.frameEdge, 0.22);
    }
  }

  if (system.isFireDoor) {
    const stripX = leadDir === -1 ? leadingX - 4 : leadingX + 1;
    box(doc, X(stripX), Y(geo.leafTop + 4), S(3), S(geo.leafBot - geo.leafTop - 8), WARN);
  }

  // Handle and cylinder on the active leaf
  fill(doc, DRAW.hardware); stroke(doc, DRAW.frameEdge); doc.setLineWidth(0.25);
  doc.circle(X(leadingX + leadDir * 26), Y(368), S(6.5), "FD");
  box(doc, X(leadDir === -1 ? leadingX - 72 : leadingX + 28), Y(365), S(44), S(6), DRAW.hardware, DRAW.frameEdge, 0.25);
  box(doc, X(leadingX + leadDir * 26 - 5), Y(392), S(10), S(16), DRAW.hardware, DRAW.frameEdge, 0.22);

  if (geo.leaves.length > 1) {
    const gfX = (activeLeaf.l + activeLeaf.r) / 2;
    stroke(doc, DRAW.leafEdge); doc.setLineWidth(0.3);
    doc.circle(X(gfX), Y(300), S(20), "S");
    doc.setFont("helvetica", "normal"); doc.setFontSize(fs(15)); ink(doc, INK);
    doc.text("GF", X(gfX), Y(306), { align: "center" });
  }

  fill(doc, DRAW.outline);
  doc.circle(X(controller.x), Y(controller.y), S(2.6), "F");

  // ── Cable runs ─────────────────────────────────────────────
  for (const { comp } of flat) {
    const a = anchors[comp.id];
    if (!a) continue;
    const included = inclusion[comp.id];
    const { color } = resolveCable(componentStates[comp.id]);
    stroke(doc, included ? color : DRAW.ghost);
    doc.setLineWidth(included ? 0.4 : 0.25);
    if (included) solid(doc); else dashed(doc, 1.2, 1);
    for (let i = 0; i < a.route.length - 1; i++) {
      const [x1, y1] = a.route[i];
      const [x2, y2] = a.route[i + 1];
      doc.line(X(x1), Y(y1), X(x2), Y(y2));
    }
  }
  solid(doc);

  // ── Devices and callouts ───────────────────────────────────
  for (const { comp, depth } of flat) {
    const a = anchors[comp.id];
    if (!a) continue;
    const included = inclusion[comp.id];
    const mandatory = isMandatoryForSystem(comp, system);
    const line = included ? DRAW.outline : DRAW.ghost;
    const face = included ? "#FFFFFF" : DRAW.wall;
    // A position that repeats on each leaf carries a devices array;
    // the leader points at the first one.
    const devices = a.devices ?? [a.device];

    for (const d of devices) {
      stroke(doc, line); doc.setLineWidth(included ? 0.3 : 0.2); fill(doc, face);

      switch (d.kind) {
        case "disc":
          doc.circle(X(d.x), Y(d.y), S(8.5), "FD");
          fill(doc, line);
          doc.circle(X(d.x), Y(d.y), S(3), "F");
          break;
        case "sensor":
          doc.rect(X(d.x - 12), Y(d.y - 7), S(24), S(13), "FD");
          doc.setLineWidth(0.2);
          doc.line(X(d.x - 8), Y(d.y + 6), X(d.x - 13), Y(d.y + 16));
          doc.line(X(d.x),     Y(d.y + 6), X(d.x),      Y(d.y + 18));
          doc.line(X(d.x + 8), Y(d.y + 6), X(d.x + 13), Y(d.y + 16));
          break;
        case "strip":
          // Sensor strips read as the black profile they are on site.
          fill(doc, line);
          doc.rect(X(d.x), Y(d.y), S(d.w), S(d.h), "FD");
          fill(doc, face);
          break;
        case "flatscan":
          // Laser scanner under the head — housing with a curved face.
          doc.lines(
            [
              [S(d.w), 0],
              [0, S(d.h * 0.4)],
              [-S(d.w * 0.25), S(d.h * 1.2), -S(d.w * 0.75), S(d.h * 1.2), -S(d.w), 0],
            ],
            X(d.x), Y(d.y), [1, 1], "FD", true
          );
          break;
        case "bar":
        default:
          doc.rect(X(d.x), Y(d.y), S(d.w), S(d.h), "FD");
          break;
      }
    }

    // Leader
    const d = devices[0];
    const cx = d.w ? d.x + d.w / 2 : d.x;
    const cy = d.h ? d.y + d.h / 2 : d.y;
    let tipX = cx, tipY = cy;
    if (d.kind === "flatscan") {
      tipX = cx; tipY = d.y + d.h + 6;
    } else if (d.w && d.h) {
      if (Math.abs(a.bubble.x - cx) > Math.abs(a.bubble.y - cy)) {
        tipX = a.bubble.x > cx ? d.x + d.w : d.x; tipY = cy;
      } else {
        tipX = cx; tipY = a.bubble.y > cy ? d.y + d.h : d.y;
      }
    }
    stroke(doc, line); doc.setLineWidth(0.18);
    doc.line(X(a.bubble.x), Y(a.bubble.y), X(tipX), Y(tipY));

    // Callout
    const r = depth > 0 ? 9.5 : 11;
    fill(doc, "#FFFFFF");
    stroke(doc, mandatory && included ? WARN : line);
    doc.setLineWidth(mandatory && included ? 0.38 : 0.25);
    doc.circle(X(a.bubble.x), Y(a.bubble.y), S(r), "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fs(depth > 0 ? 9 : 10.5));
    ink(doc, included ? INK : MUTED);
    doc.text(String(comp.position), X(a.bubble.x), Y(a.bubble.y + (depth > 0 ? 3.4 : 3.8)), { align: "center" });
  }
}

// ─── Cable key ───────────────────────────────────────────────────
function drawKey(doc, system, componentStates, x, y, w) {
  const flat = flattenComponents(system);
  const inclusion = buildInclusionMap(system, componentStates);
  const legend = activeCableLegend(
    flat.map(f => f.comp),
    Object.fromEntries(flat.map(f => [f.comp.id, inclusion[f.comp.id] ? componentStates[f.comp.id] : null])),
  );

  const colW = w / 2;
  const rowH = 5.2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  solid(doc);

  legend.forEach((item, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const lx = x + col * colW, ly = y + row * rowH;
    stroke(doc, item.color); doc.setLineWidth(0.8);
    doc.line(lx, ly, lx + 11, ly);
    ink(doc, BODY);
    doc.text(item.label, lx + 14, ly + 1);
  });

  return y + Math.ceil(legend.length / 2) * rowH;
}

// ─── Footer band ─────────────────────────────────────────────────
function footerBand(doc, pageW, pageH, margin, pageNo, pageCount) {
  const h = 13;
  band(doc, pageH - h, h, pageW, NAVY);
  fill(doc, "#FFFFFF");
  doc.rect(margin, pageH - h / 2 - 1.2, 2.4, 2.4, "F");
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); ink(doc, "#FFFFFF");
  doc.text("MF SERVICES  ·  SYSTEM TECHNOLOGY FOR THE DOOR", margin + 5.5, pageH - h / 2 + 1.1);
  doc.setFontSize(8);
  doc.text(`${pageNo} / ${pageCount}`, pageW - margin, pageH - h / 2 + 1.1, { align: "right" });
}

// The authoritative rules live in lib/cablePlanSpec.js so the
// on-screen checks and the pre-issue checks cannot disagree.
export function runComplianceCheck(system, componentStates) {
  return validateConfiguration(system, componentStates).errors;
}

// ─── Document ────────────────────────────────────────────────────
// One A4 landscape sheet: drawing on the left, cable schedule on the
// right. Reading the plan means matching a position number on the
// drawing to its cable in the table, so the two have to be in view at
// once — split across portrait pages it meant constant flipping.
export async function generateCablePlanPDF({ system, componentStates, projectData }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();   // 297
  const pageH = doc.internal.pageSize.getHeight();  // 210
  const margin = 12;

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric" });

  const headH = 22;
  const stripH = 11;
  const footH = 13;
  const bodyTop = headH + stripH + 7;
  const bodyBot = pageH - footH - 6;

  // Left column takes the larger share — the drawing has to stay
  // legible, and the schedule only lists positions actually in the job.
  const leftW = 148;
  const gutter = 9;
  const rightX = margin + leftW + gutter;
  const rightW = pageW - margin - rightX;

  // ══ Title band ══════════════════════════════════════════════
  band(doc, 0, headH, pageW, NAVY);
  doc.setFont("helvetica", "normal"); doc.setFontSize(16); ink(doc, "#FFFFFF");
  doc.text(`Cable diagram – ${system.name} ${system.leafType}`, margin, 14.5);
  if (system.isFireDoor) {
    doc.setFontSize(8); doc.text("FIRE DOOR", pageW - margin, 14.5, { align: "right" });
  }

  // ══ Project strip ═══════════════════════════════════════════
  const meta = [
    projectData.constructionProject,
    projectData.doorNumberOrNaming,
    projectData.installationLocation,
    projectData.positionNumberInSpec,
  ].map(v => v?.trim()).filter(Boolean);

  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); ink(doc, BODY);
  doc.text(
    meta.length ? `${meta.join("   ·   ")}   ·   ${dateStr}` : dateStr,
    margin, headH + 7,
  );
  doc.addImage(LOGO_DATA_URI, "JPEG", pageW - margin - 26, headH + 1, 26, 8.5);
  stroke(doc, RULE); doc.setLineWidth(0.25); solid(doc);
  doc.line(margin, headH + stripH, pageW - margin, headH + stripH);

  // ══ Left column — elevation and cable key ═══════════════════
  const inclusion = buildInclusionMap(system, componentStates);
  const flat = flattenComponents(system);
  const legendCount = activeCableLegend(
    flat.map(f => f.comp),
    Object.fromEntries(flat.map(f => [f.comp.id, inclusion[f.comp.id] ? componentStates[f.comp.id] : null])),
  ).length;
  const keyH = Math.ceil(legendCount / 2) * 5.2;

  const scale = leftW / system.drawing.view.w;
  const drawH = system.drawing.view.h * scale;
  const keyTop = bodyBot - keyH;
  const drawTop = bodyTop + Math.max(0, (keyTop - 8 - bodyTop - drawH) / 2);

  drawElevation(doc, system, componentStates, margin, drawTop, scale);
  stroke(doc, RULE); doc.setLineWidth(0.25); solid(doc);
  doc.line(margin, keyTop - 5, margin + leftW, keyTop - 5);
  drawKey(doc, system, componentStates, margin, keyTop, leftW);

  // Column divider
  stroke(doc, RULE); doc.setLineWidth(0.25);
  doc.line(rightX - gutter / 2, bodyTop - 3, rightX - gutter / 2, bodyBot);

  // ══ Right column — cable schedule ═══════════════════════════
  const cols = {
    pos:     { x: rightX,           w: 8 },
    label:   { x: rightX + 8,       w: 44 },
    cable:   { x: rightX + 52,      w: 30 },
    remarks: { x: rightX + 82,      w: rightW - 82 },
  };

  let y = bodyTop;
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); ink(doc, MUTED);
  doc.text("CABLE SCHEDULE", rightX, y);
  y += 4;

  const header = () => {
    box(doc, rightX, y, rightW, 6, NAVY);
    doc.setFont("helvetica", "bold"); doc.setFontSize(6.5); ink(doc, "#FFFFFF");
    doc.text("POS.", cols.pos.x + 1.5, y + 4);
    doc.text("COMPONENT", cols.label.x + 2, y + 4);
    doc.text("CABLE", cols.cable.x + 2, y + 4);
    doc.text("REMARKS", cols.remarks.x + 2, y + 4);
    y += 6;
  };
  header();

  let idx = 0;
  let overflow = false;

  for (const { comp, depth } of flat) {
    if (!inclusion[comp.id]) continue;
    const state = componentStates[comp.id];
    const mandatory = isMandatoryForSystem(comp, system);
    const cable = state.isOther ? (state.otherValue?.trim() || "Not specified") : (state.selectedCable || comp.cable.defaultCable);
    // Conditional remarks replace the standard text — on a fire door
    // that is the DIGt approval requirement, which must reach the sheet.
    const standing = getRemarksOverride(comp, system) || comp.remarks;
    const remarks = [standing, state.userRemarks].filter(v => v?.trim()).join(" — ");

    doc.setFontSize(7);
    const lL = doc.splitTextToSize(comp.label, cols.label.w - 4);
    const cL = doc.splitTextToSize(cable, cols.cable.w - 4);
    const rL = doc.splitTextToSize(remarks || "—", cols.remarks.w - 4);
    const rowH = Math.max(lL.length, cL.length, rL.length) * 3.1 + 2.8;

    if (y + rowH > bodyBot) {
      // Only a configuration with almost every position switched on can
      // reach this; the sheet stays single-page for a normal job.
      doc.addPage(); overflow = true; y = margin; idx = 0;
      doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); ink(doc, MUTED);
      doc.text("CABLE SCHEDULE (CONTINUED)", rightX, y); y += 4;
      header();
    }

    box(doc, rightX, y, rightW, rowH, idx % 2 === 0 ? "#FFFFFF" : SUNKEN);
    const { color } = resolveCable(state);
    box(doc, rightX, y, 1.3, rowH, color);

    const tY = y + 4;
    doc.setFont("helvetica", "bold"); doc.setFontSize(7);
    ink(doc, mandatory ? WARN : NAVY);
    doc.text(String(comp.position), cols.pos.x + 2.5, tY);

    doc.setFont("helvetica", depth > 0 ? "italic" : "normal"); doc.setFontSize(7); ink(doc, INK);
    lL.forEach((l, i) => doc.text(l, cols.label.x + 2 + depth * 2, tY + i * 3.1));

    doc.setFont("helvetica", "bold"); doc.setFontSize(6.8); ink(doc, BODY);
    cL.forEach((l, i) => doc.text(l, cols.cable.x + 2, tY + i * 3.1));

    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); ink(doc, MUTED);
    rL.forEach((l, i) => doc.text(l, cols.remarks.x + 2, tY + i * 3.1));

    y += rowH;
    stroke(doc, RULE); doc.setLineWidth(0.12); solid(doc);
    doc.line(rightX, y, rightX + rightW, y);
    idx++;
  }

  // ══ Footers ═════════════════════════════════════════════════
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    footerBand(doc, pageW, pageH, margin, p, total);
  }

  const filename = [
    "cable-plan",
    system.name.replace(/\s+/g, "-").toLowerCase(),
    projectData.doorNumberOrNaming?.trim().replace(/\s+/g, "-") || "unnamed",
    now.toISOString().slice(0, 10),
  ].join("_") + ".pdf";

  doc.save(filename);
  return filename;
}
