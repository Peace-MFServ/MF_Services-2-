'use client'
import { useEffect, useRef, useCallback } from "react";
import { UI } from "../lib/theme";

// ─────────────────────────────────────────────────────────────────
// The modal behaviour both dialogs share
// ─────────────────────────────────────────────────────────────────
// A dialog must be leavable and reachable without a mouse: Escape
// closes it, focus moves into it on open and back to whatever opened
// it on close, and Tab cycles inside rather than escaping into the
// page behind. The close button is finger-sized.
// ─────────────────────────────────────────────────────────────────

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function DialogShell({ label, onClose, maxWidth, align = "center", children }) {
  const panelRef = useRef(null);

  // Focus in on open, and hand focus back on close.
  useEffect(() => {
    const opener = document.activeElement;
    const first = panelRef.current?.querySelector(FOCUSABLE);
    (first ?? panelRef.current)?.focus();
    return () => { if (opener instanceof HTMLElement) opener.focus(); };
  }, []);

  const onKeyDown = useCallback(e => {
    if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
    if (e.key !== "Tab") return;
    const nodes = panelRef.current?.querySelectorAll(FOCUSABLE);
    if (!nodes?.length) return;
    const list = Array.from(nodes);
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }, [onClose]);

  return (
    <div
      role="dialog" aria-modal="true" aria-label={label}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={onKeyDown}
      style={{
        position: "fixed", inset: 0, background: "rgba(16,25,34,0.55)",
        display: "flex", alignItems: align === "top" ? "flex-start" : "center", justifyContent: "center",
        zIndex: 100, padding: align === "top" ? "70px 20px 20px" : 20,
        overflowY: align === "top" ? "auto" : undefined,
      }}
    >
      <div
        ref={panelRef} tabIndex={-1}
        style={{
          background: UI.surface, padding: "28px 30px 30px", maxWidth, width: "100%",
          position: "relative", outline: "none",
        }}
      >
        <button
          type="button" onClick={onClose} aria-label="Close"
          style={{
            position: "absolute", top: 4, right: 4,
            width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center",
            background: "none", border: "none", fontSize: 22, lineHeight: 1,
            color: UI.muted, cursor: "pointer",
          }}
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}
