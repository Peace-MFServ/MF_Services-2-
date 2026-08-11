import { jsPDF } from "jspdf";
import { LOGO_DATA_URI } from "./logo";
import {
  VIEW, GEO, CONTROLLER, ANCHORS, DRAW,
  resolveCable, activeCableLegend,
  flattenComponents, buildInclusionMap, isMandatoryForSystem, getRemarksOverride, validateConfiguration,
} from "./cablePlanSpec";

// ─────────────────────────────────────────────────────────────────
// Cable plan PDF
// ─────────────────────────────────────────────────────────────────
// Sheet 1 is the drawing: navy title band, the elevation at full
// width, the cable key at the foot, navy footer band. Sheet 2 carries
// the title block and cable schedule.
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
  const X = v => ox + (v - VIEW.x) * scale;
  const Y = v => oy + (v - VIEW.y) * scale;
  const S = v => v * scale;
  const fs = svgSize => Math.max(3.2, svgSize * scale * PT_PER_MM);

  const flat = flattenComponents(system);
  const inclusion = buildInclusionMap(system, componentStates);

  doc.setFont("helvetica", "normal");
  solid(doc);

  // ── Frame ──────────────────────────────────────────────────
  // The assembly floats on white; no wall or ceiling fill.
  box(doc, X(GEO.openL), Y(GEO.headY), S(GEO.openR - GEO.openL), S(GEO.jambW), DRAW.frame, DRAW.frameEdge, 0.3);
  box(doc, X(GEO.openL), Y(GEO.headY), S(GEO.jambW), S(GEO.floorY - GEO.headY), DRAW.frame, DRAW.frameEdge, 0.3);
  box(doc, X(GEO.openR - GEO.jambW), Y(GEO.headY), S(GEO.jambW), S(GEO.floorY - GEO.headY), DRAW.frame, DRAW.frameEdge, 0.3);
  box(doc, X(GEO.openL), Y(GEO.floorY - 7), S(GEO.openR - GEO.openL), S(7), DRAW.frame, DRAW.frameEdge, 0.3);

  // Concealed route through the frame
  dashed(doc, 1.4, 1);
  stroke(doc, "#2E9E4F"); doc.setLineWidth(0.25);
  doc.rect(X(GEO.openL + 5), Y(GEO.headY + 5), S(GEO.openR - GEO.openL - 10), S(GEO.floorY - GEO.headY - 10), "S");
  solid(doc);

  // ── Operator ───────────────────────────────────────────────
  box(doc, X(GEO.leafL), Y(GEO.opTop), S(GEO.leafR - GEO.leafL), S(GEO.opBot - GEO.opTop), "#FFFFFF", DRAW.frameEdge, 0.3);
  doc.setFont("helvetica", "bold"); doc.setFontSize(fs(11)); ink(doc, INK);
  doc.text(system.systemVariant || system.name, X(GEO.leafL + 10), Y(GEO.opTop + 14));

  // ── Leaf ───────────────────────────────────────────────────
  box(doc, X(GEO.leafL), Y(GEO.leafTop), S(GEO.leafR - GEO.leafL), S(GEO.leafBot - GEO.leafTop), DRAW.leaf, DRAW.leafEdge, 0.3);
  stroke(doc, DRAW.leafEdge); doc.setLineWidth(0.15);
  doc.rect(X(GEO.leafL + 14), Y(GEO.leafTop + 14), S(GEO.leafR - GEO.leafL - 28), S(GEO.leafBot - GEO.leafTop - 28), "S");

  for (const hy of [212, 360, 508]) {
    box(doc, X(GEO.leafL - 5), Y(hy), S(10), S(30), DRAW.hardware, DRAW.frameEdge, 0.22);
  }

  if (system.isFireDoor) {
    box(doc, X(GEO.leafR - 4), Y(GEO.leafTop + 4), S(3), S(GEO.leafBot - GEO.leafTop - 8), WARN);
  }

  // Handle and cylinder
  fill(doc, DRAW.hardware); stroke(doc, DRAW.frameEdge); doc.setLineWidth(0.25);
  doc.circle(X(GEO.leafR - 26), Y(368), S(6.5), "FD");
  box(doc, X(GEO.leafR - 72), Y(365), S(44), S(6), DRAW.hardware, DRAW.frameEdge, 0.25);
  box(doc, X(GEO.leafR - 31), Y(392), S(10), S(16), DRAW.hardware, DRAW.frameEdge, 0.22);

  if (system.leafType === "double-leaf") {
    stroke(doc, DRAW.leafEdge); doc.setLineWidth(0.3);
    doc.circle(X(450), Y(300), S(20), "S");
    doc.setFont("helvetica", "normal"); doc.setFontSize(fs(15)); ink(doc, INK);
    doc.text("GF", X(450), Y(306), { align: "center" });
  }

  fill(doc, DRAW.outline);
  doc.circle(X(CONTROLLER.x), Y(CONTROLLER.y), S(2.6), "F");

  // ── Cable runs ─────────────────────────────────────────────
  for (const { comp } of flat) {
    const a = ANCHORS[comp.id];
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
    const a = ANCHORS[comp.id];
    if (!a) continue;
    const included = inclusion[comp.id];
    const mandatory = isMandatoryForSystem(comp, system);
    const line = included ? DRAW.outline : DRAW.ghost;
    const face = included ? "#FFFFFF" : DRAW.wall;
    const d = a.device;

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
      case "bar":
      default:
        doc.rect(X(d.x), Y(d.y), S(d.w), S(d.h), "FD");
        break;
    }

    // Leader
    const cx = d.w ? d.x + d.w / 2 : d.x;
    const cy = d.h ? d.y + d.h / 2 : d.y;
    let tipX = cx, tipY = cy;
    if (d.w && d.h) {
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
  const rowH = 6.4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  solid(doc);

  legend.forEach((item, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const lx = x + col * colW, ly = y + row * rowH;
    stroke(doc, item.color); doc.setLineWidth(0.8);
    doc.line(lx, ly, lx + 13, ly);
    ink(doc, BODY);
    doc.text(item.label, lx + 17, ly + 1.1);
  });

  return y + Math.ceil(legend.length / 2) * rowH;
}

// ─── Footer band ─────────────────────────────────────────────────
function footerBand(doc, pageW, pageH, pageNo, pageCount) {
  const h = 16;
  band(doc, pageH - h, h, pageW, NAVY);
  fill(doc, "#FFFFFF");
  doc.rect(15, pageH - h / 2 - 1.4, 2.8, 2.8, "F");
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); ink(doc, "#FFFFFF");
  doc.text("MF SERVICES  ·  SYSTEM TECHNOLOGY FOR THE DOOR", 21.5, pageH - h / 2 + 1.2);
  doc.setFontSize(8.5);
  doc.text(`${pageNo} / ${pageCount}`, pageW - 15, pageH - h / 2 + 1.2, { align: "right" });
}

// The authoritative rules live in lib/cablePlanSpec.js so the
// on-screen checks and the pre-issue checks cannot disagree.
export function runComplianceCheck(system, componentStates) {
  return validateConfiguration(system, componentStates).errors;
}

// ─── Document ────────────────────────────────────────────────────
export async function generateCablePlanPDF({ system, componentStates, projectData }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const cW = pageW - margin * 2;

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric" });

  // ══ Sheet 1 — the drawing ═══════════════════════════════════
  const headH = 30;
  band(doc, 0, headH, pageW, NAVY);
  doc.setFont("helvetica", "normal"); doc.setFontSize(19); ink(doc, "#FFFFFF");
  doc.text(`Cable diagram – ${system.name} ${system.leafType}`, margin, 19.5);

  if (system.isFireDoor) {
    doc.setFontSize(8.5); ink(doc, "#FFFFFF");
    doc.text("FIRE DOOR", pageW - margin, 19.5, { align: "right" });
  }

  // The key sits just above the footer band; the elevation is centred
  // in the space that leaves, so the sheet reads as one composition
  // rather than everything crowding the top.
  const footerH = 16;
  const keyRows = Math.ceil(activeCableLegend(
    flattenComponents(system).map(f => f.comp),
    Object.fromEntries(flattenComponents(system).map(f => {
      const inc = buildInclusionMap(system, componentStates);
      return [f.comp.id, inc[f.comp.id] ? componentStates[f.comp.id] : null];
    })),
  ).length / 2);
  const keyH = keyRows * 6.4;
  const keyTop = pageH - footerH - keyH - 14;

  const scale = cW / VIEW.w;
  const drawH = VIEW.h * scale;
  const availTop = headH + 10;
  const availBot = keyTop - 12;
  const drawTop = availTop + Math.max(0, (availBot - availTop - drawH) / 2);
  drawElevation(doc, system, componentStates, margin, drawTop, scale);

  stroke(doc, RULE); doc.setLineWidth(0.25); solid(doc);
  doc.line(margin, keyTop - 9, pageW - margin, keyTop - 9);
  drawKey(doc, system, componentStates, margin, keyTop, cW);

  // ══ Sheet 2 — title block and schedule ══════════════════════
  doc.addPage();
  let y = margin;

  doc.addImage(LOGO_DATA_URI, "JPEG", margin, y, 34, 11);
  doc.setFont("helvetica", "bold"); doc.setFontSize(15); ink(doc, INK);
  doc.text("Cable schedule", pageW - margin, y + 6, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); ink(doc, MUTED);
  doc.text(`${system.name} ${system.leafType}  ·  ${dateStr}`, pageW - margin, y + 11.5, { align: "right" });

  y += 20;
  stroke(doc, INK); doc.setLineWidth(0.5); solid(doc);
  doc.line(margin, y, pageW - margin, y);
  y += 10;

  // ── Title block ────────────────────────────────────────────
  const meta = [
    ["Construction project", projectData.constructionProject],
    ["Door number", projectData.doorNumberOrNaming],
    ["Installation location", projectData.installationLocation],
    ["Position no. in specification", projectData.positionNumberInSpec],
    ["Function description", projectData.functionDescription],
    ["Notes", projectData.miscellaneous],
  ].filter(([, v]) => v?.trim());

  doc.setFont("helvetica", "bold"); doc.setFontSize(8); ink(doc, MUTED);
  doc.text("TITLE BLOCK", margin, y);
  y += 5;

  if (meta.length === 0) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); ink(doc, MUTED);
    doc.text("No project details recorded.", margin, y + 3);
    y += 10;
  } else {
    const colW = cW / 2;
    meta.forEach(([label, value], i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const fx = margin + col * colW, fy = y + row * 13;
      if (col === 0) box(doc, margin, fy, cW, 12, row % 2 === 0 ? "#FFFFFF" : SUNKEN);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); ink(doc, MUTED);
      doc.text(label.toUpperCase(), fx + 3, fy + 4.6);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); ink(doc, INK);
      doc.text(doc.splitTextToSize(value, colW - 6)[0], fx + 3, fy + 10);
    });
    y += Math.ceil(meta.length / 2) * 12 + 8;
  }

  // ── Schedule table ─────────────────────────────────────────
  // Widths tuned so the common remark strings sit on one or two lines
  // — narrower columns wrapped nearly every row and pushed the
  // schedule onto a third, near-empty sheet.
  const cols = {
    pos:     { x: margin,       w: 11 },
    label:   { x: margin + 11,  w: 55 },
    type:    { x: margin + 66,  w: 25 },
    cable:   { x: margin + 91,  w: 37 },
    remarks: { x: margin + 128, w: cW - 128 },
  };

  const header = () => {
    box(doc, margin, y, cW, 8, NAVY);
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); ink(doc, "#FFFFFF");
    doc.text("POS.", cols.pos.x + 2.5, y + 5.3);
    doc.text("COMPONENT", cols.label.x + 2.5, y + 5.3);
    doc.text("TYPE", cols.type.x + 2.5, y + 5.3);
    doc.text("CABLE", cols.cable.x + 2.5, y + 5.3);
    doc.text("REMARKS", cols.remarks.x + 2.5, y + 5.3);
    y += 8;
  };
  header();

  const inclusion = buildInclusionMap(system, componentStates);
  let idx = 0;

  for (const { comp, depth } of flattenComponents(system)) {
    if (!inclusion[comp.id]) continue;
    const state = componentStates[comp.id];
    const mandatory = isMandatoryForSystem(comp, system);
    const cable = state.isOther ? (state.otherValue?.trim() || "Not specified") : (state.selectedCable || comp.cable.defaultCable);
    // Use the conditional remark where one applies — for a fire door
    // that is the DIGt approval requirement, which must reach the
    // issued sheet rather than the generic text it replaces.
    const standing = getRemarksOverride(comp, system) || comp.remarks;
    const remarks = [standing, state.userRemarks].filter(v => v?.trim()).join(" — ");

    doc.setFontSize(8);
    const rL = doc.splitTextToSize(remarks || "—", cols.remarks.w - 5);
    const lL = doc.splitTextToSize(comp.label, cols.label.w - 5);
    const cL = doc.splitTextToSize(cable, cols.cable.w - 5);
    const rowH = Math.max(rL.length, lL.length, cL.length) * 3.9 + 5;

    if (y + rowH > pageH - 26) { doc.addPage(); y = margin; header(); idx = 0; }

    box(doc, margin, y, cW, rowH, idx % 2 === 0 ? "#FFFFFF" : SUNKEN);
    const { color } = resolveCable(state);
    box(doc, margin, y, 1.6, rowH, color);

    const tY = y + 5;
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
    ink(doc, mandatory ? WARN : NAVY);
    doc.text(String(comp.position), cols.pos.x + 4, tY);

    doc.setFont("helvetica", depth > 0 ? "italic" : "normal"); doc.setFontSize(8.5); ink(doc, INK);
    lL.forEach((l, i) => doc.text(l, cols.label.x + 2.5 + depth * 3, tY + i * 4));

    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); ink(doc, MUTED);
    doc.text(TYPE_LABELS[comp.type] || comp.type, cols.type.x + 2.5, tY);

    doc.setFont("helvetica", "bold"); doc.setFontSize(8); ink(doc, BODY);
    cL.forEach((l, i) => doc.text(l, cols.cable.x + 2.5, tY + i * 4));

    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); ink(doc, MUTED);
    rL.forEach((l, i) => doc.text(l, cols.remarks.x + 2.5, tY + i * 4));

    y += rowH;
    stroke(doc, RULE); doc.setLineWidth(0.15); solid(doc);
    doc.line(margin, y, pageW - margin, y);
    idx++;
  }

  // ── Footers ────────────────────────────────────────────────
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    footerBand(doc, pageW, pageH, p, total);
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
