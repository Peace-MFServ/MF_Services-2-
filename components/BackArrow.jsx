'use client'
import { UI, FONT } from "../lib/theme";

// The way back, made visible: a bordered arrow at the top left of
// every configurator, beside the title, where the eye starts. The
// footer Back button remains for anyone already at the bottom.

export default function BackArrow({ onClick, label = "Back" }) {
  return (
    <button
      type="button" onClick={onClick} aria-label={label} title={label}
      style={{
        width: 34, height: 34, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        border: `1px solid ${UI.accent}`, background: UI.accent,
        cursor: "pointer", fontFamily: FONT, padding: 0,
      }}
    >
      <svg width="16" height="14" viewBox="0 0 16 14" aria-hidden="true">
        <path
          d="M7.5 1 L2 7 L7.5 13 M2.4 7 H15"
          fill="none" stroke="#FFFFFF" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
