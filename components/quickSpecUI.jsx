'use client'
import { UI, FONT } from "../lib/theme";

// ─────────────────────────────────────────────────────────────────
// Quick specification — interface language
// ─────────────────────────────────────────────────────────────────
// The quick screens use a softer, card-based look than the rest of
// the toolbox: a light canvas, white cards with a whisper of shadow,
// prominent section titles with a small line icon, and a sticky
// summary. The navy stays MF navy; only the greys soften.
//
// The responsive grid classes (.qs-page, .qs-grid, .qs-3col,
// .qs-frames) live in globals.css — media queries need CSS.
// ─────────────────────────────────────────────────────────────────

export const QS = {
  bg: "#F6F8FB",       // page canvas
  ink: "#13233B",      // headings
  muted: "#64748B",    // secondary text
  tint: "#EDF2F8",     // icon squares
  tintOn: "#DCE7F5",   // icon squares on a selected tile
  selected: "#F5F8FD", // selected tile background
};

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" };

// Small line icons for the section titles and summary groups.
export const ICONS = {
  door: (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <rect {...stroke} x="6" y="3" width="12" height="18" rx="1" />
      <circle cx="14.6" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  ),
  opening: (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path {...stroke} d="M4 21 V4 H21" />
      <path {...stroke} d="M9 21 V9 H21" />
    </svg>
  ),
  hardware: (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path {...stroke} d="M14.7 6.3a4.6 4.6 0 0 0-6.1 6.1L3.4 17.6a2 2 0 0 0 2.8 2.8l5.2-5.2a4.6 4.6 0 0 0 6.1-6.1l-3 3-2.8-2.8 3-3z" />
    </svg>
  ),
  project: (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <circle {...stroke} cx="12" cy="8" r="3.5" />
      <path {...stroke} d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  ),
  sheet: (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <rect {...stroke} x="5" y="3" width="14" height="18" rx="1.5" />
      <path {...stroke} d="M9 8h6 M9 12h6 M9 16h4" />
    </svg>
  ),
  wall: (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <rect {...stroke} x="3.5" y="5" width="17" height="14" />
      <path {...stroke} d="M3.5 12h17 M12 5v7 M8 12v7 M16 12v7" />
    </svg>
  ),
  key: (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <circle {...stroke} cx="8" cy="8" r="4" />
      <path {...stroke} d="M11 11 L20 20 M17 17l2.4-2.4 M14 14l2.2-2.2" />
    </svg>
  ),
  download: (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path {...stroke} d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3" />
    </svg>
  ),
  check: (
    <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
    </svg>
  ),
};

/** Prominent card heading: tinted icon square, 20px title, muted hint. */
export function CardTitle({ icon, children, hint }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {icon && (
          <span aria-hidden="true" style={{
            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
            display: "grid", placeItems: "center",
            background: QS.tint, color: UI.accent,
          }}>
            {icon}
          </span>
        )}
        <h2 style={{
          margin: 0, fontSize: 20, fontWeight: 650, letterSpacing: "-0.01em",
          color: QS.ink, fontFamily: FONT,
        }}>
          {children}
        </h2>
      </div>
      {hint && (
        <p style={{ margin: "5px 0 0", fontSize: 13, lineHeight: 1.5, color: QS.muted }}>{hint}</p>
      )}
    </div>
  );
}

/**
 * Split a flat run of spec-sheet rows into titled groups by label.
 * A group with labels: null takes everything the others did not claim,
 * and any unmatched row still lands there — nothing is ever dropped.
 */
export function groupSheetRows(rows, groups) {
  const claimed = new Set(groups.flatMap(g => g.labels ?? []));
  return groups
    .map(g => ({
      ...g,
      rows: g.labels
        ? rows.filter(r => g.labels.includes(r.label))
        : rows.filter(r => !claimed.has(r.label)),
    }))
    .filter(g => g.rows.length > 0);
}
