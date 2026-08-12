// ─────────────────────────────────────────────────────────────────
// Shared interface language
// ─────────────────────────────────────────────────────────────────
// Flat, high contrast, navy as the single accent. Orange appears only
// where it carries meaning — a requirement, a limit exceeded, a failed
// check — never as decoration. One font family throughout.
// ─────────────────────────────────────────────────────────────────

export const FONT = 'Inter, "Helvetica Neue", Helvetica, Arial, sans-serif'

export const UI = {
  accent:      "#00387B",  // the one accent
  accentDark:  "#002855",
  warn:        "#B4470E",  // functional only
  ink:         "#101922",  // primary text
  body:        "#2B3641",  // secondary text
  muted:       "#57646F",  // labels, meta
  rule:        "#C4CCD4",  // visible hairlines
  ruleStrong:  "#9AA5B1",  // field borders
  surface:     "#FFFFFF",
  sunken:      "#F2F5F7",
  canvas:      "#E8ECEF",
}

// Field styling shared by every input in the toolbox.
export const fieldStyle = {
  width: "100%", boxSizing: "border-box",
  border: `1px solid ${UI.ruleStrong}`, background: UI.surface,
  padding: "10px 12px", fontSize: 13.5, lineHeight: 1.5,
  fontFamily: FONT, color: UI.ink, outline: "none",
}

export const focusField = e => {
  e.target.style.borderColor = UI.accent
  e.target.style.boxShadow = `inset 0 0 0 1px ${UI.accent}`
}

export const blurField = e => {
  e.target.style.borderColor = UI.ruleStrong
  e.target.style.boxShadow = "none"
}
