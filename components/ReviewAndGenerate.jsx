'use client'
import { useState, useCallback } from "react";
import { generateCablePlanPDF } from "../lib/generateCablePlanPDF";
import {
  FONT_SANS, FONT_MONO, resolveCable, flattenComponents, isMandatoryForSystem,
} from "../lib/cablePlanSpec";

const T = {
  navy:    "#00387B",
  orange:  "#ED6E02",
  red:     "#A6382F",
  green:   "#5C8A2E",
  ink:     "#1B2430",
  body:    "#3D4753",
  muted:   "#6B7686",
  faint:   "#98A2AE",
  hair:    "#DDE2E8",
  hairSoft:"#EBEEF2",
  surface: "#FFFFFF",
  sunken:  "#F7F9FA",
};

// ─── Notifications ────────────────────────────────────────────────

function Notice({ notices, dismiss }) {
  if (notices.length === 0) return null;
  return (
    <div style={{
      position: "fixed", bottom: 20, right: 20, zIndex: 9999,
      display: "flex", flexDirection: "column", gap: 8, maxWidth: 380,
    }}>
      {notices.map(n => {
        const accent = n.type === "error" ? T.red : n.type === "warning" ? T.orange : T.green;
        return (
          <div key={n.id} role="status" style={{
            display: "flex", alignItems: "flex-start", gap: 11,
            background: T.surface, border: `1px solid ${T.hair}`, borderLeft: `3px solid ${accent}`,
            padding: "12px 14px", boxShadow: "0 6px 20px rgba(27,36,48,0.10)",
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 650, color: T.ink, fontFamily: FONT_SANS }}>{n.title}</div>
              {n.message && (
                <div style={{ fontSize: 11.5, color: T.muted, lineHeight: 1.5, marginTop: 3, fontFamily: FONT_SANS, wordBreak: "break-word" }}>
                  {n.message}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(n.id)}
              aria-label="Dismiss"
              style={{ background: "none", border: "none", padding: 2, cursor: "pointer", flexShrink: 0, lineHeight: 0 }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                <path d="M1 1L9 9M9 1L1 9" stroke={T.faint} strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}

function useNotices() {
  const [notices, setNotices] = useState([]);
  const dismiss = useCallback(id => setNotices(prev => prev.filter(n => n.id !== id)), []);
  const push = useCallback(({ type = "error", title, message, duration = 6000 }) => {
    const id = `${Date.now()}-${Math.random()}`;
    setNotices(prev => [...prev, { id, type, title, message }]);
    if (duration) setTimeout(() => dismiss(id), duration);
  }, [dismiss]);
  return { notices, push, dismiss };
}

// ─── Panel primitives ─────────────────────────────────────────────

function SectionHeading({ children, count }) {
  return (
    <div style={{
      display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8,
      padding: "0 0 8px", marginBottom: 10, borderBottom: `1px solid ${T.hairSoft}`,
    }}>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase",
        color: T.faint, fontFamily: FONT_SANS,
      }}>
        {children}
      </span>
      {count != null && (
        <span style={{ fontSize: 11, color: T.faint, fontFamily: FONT_MONO }}>{count}</span>
      )}
    </div>
  );
}

function SummaryRow({ label, value, accent }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12,
      padding: "7px 0", borderBottom: `1px solid ${T.hairSoft}`,
    }}>
      <span style={{ fontSize: 12, color: T.muted, fontFamily: FONT_SANS }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: accent || T.ink, fontFamily: FONT_MONO, textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────

export default function ReviewAndGenerate({ system, componentStates, projectData, validation, inclusion }) {
  const { notices, push, dismiss } = useNotices();
  const [generating, setGenerating] = useState(false);

  if (!system) return null;

  const flat = flattenComponents(system);
  const included = flat.filter(({ comp }) => inclusion[comp.id]);
  const { errors, warnings, isValid } = validation;

  const projectEntries = [
    ["Construction project", projectData.constructionProject],
    ["Door number", projectData.doorNumberOrNaming],
    ["Location", projectData.installationLocation],
    ["Position no.", projectData.positionNumberInSpec],
  ].filter(([, v]) => v?.trim());

  const handleGenerate = async () => {
    if (!isValid) {
      push({
        type: "error",
        title: `${errors.length} issue${errors.length === 1 ? "" : "s"} must be resolved`,
        message: "Return to Components and complete the highlighted positions.",
        duration: 8000,
      });
      return;
    }
    setGenerating(true);
    try {
      const filename = await generateCablePlanPDF({ system, componentStates, projectData });
      push({ type: "success", title: "Cable plan issued", message: filename, duration: 6000 });
    } catch (err) {
      push({ type: "error", title: "Could not generate the PDF", message: err?.message || "Unexpected error.", duration: 9000 });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <Notice notices={notices} dismiss={dismiss} />
      <div style={{ padding: 20, fontFamily: FONT_SANS }}>

        {/* Summary */}
        <div style={{ marginBottom: 22 }}>
          <SectionHeading>Plan</SectionHeading>
          <SummaryRow label="System" value={system.name} />
          <SummaryRow label="Leaf type" value={system.leafType} />
          <SummaryRow label="Fire door" value={system.isFireDoor ? "Yes" : "No"} accent={system.isFireDoor ? T.orange : undefined} />
          <SummaryRow label="Positions included" value={`${included.length} of ${flat.length}`} />
        </div>

        {/* Project */}
        <div style={{ marginBottom: 22 }}>
          <SectionHeading>Title block</SectionHeading>
          {projectEntries.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.55, color: T.faint }}>
              No project details recorded. The plan will be issued without a title block.
            </p>
          ) : (
            projectEntries.map(([label, value]) => <SummaryRow key={label} label={label} value={value} />)
          )}
        </div>

        {/* Checks */}
        <div style={{ marginBottom: 22 }}>
          <SectionHeading>Checks</SectionHeading>
          {isValid && warnings.length === 0 ? (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
              <span aria-hidden="true" style={{ width: 3, height: 15, background: T.green, flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 12, lineHeight: 1.5, color: T.body }}>
                All positions complete. Ready to issue.
              </span>
            </div>
          ) : (
            [...errors.map(e => ({ ...e, level: "error" })), ...warnings.map(w => ({ ...w, level: "warning" }))].map((item, i) => (
              <div key={`${item.id}-${i}`} style={{ display: "flex", alignItems: "flex-start", gap: 9, marginBottom: 7 }}>
                <span aria-hidden="true" style={{
                  width: 3, height: 15, marginTop: 1, flexShrink: 0,
                  background: item.level === "error" ? T.red : T.orange,
                }} />
                <span style={{ fontSize: 12, lineHeight: 1.5, color: T.body }}>
                  <strong style={{ fontFamily: FONT_MONO, fontWeight: 700, color: T.ink }}>{item.position}</strong>
                  {"  "}{item.label} — {item.reason}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Schedule */}
        <div style={{ marginBottom: 24 }}>
          <SectionHeading count={`${included.length}`}>Cable schedule</SectionHeading>
          {included.map(({ comp, depth }) => {
            const state = componentStates[comp.id];
            const cable = state.isOther ? (state.otherValue?.trim() || "Not specified") : state.selectedCable;
            const { color } = resolveCable(state);
            const mandatory = isMandatoryForSystem(comp, system);
            const failed = errors.some(e => e.id === comp.id);
            return (
              <div key={comp.id} style={{
                display: "flex", gap: 10, alignItems: "flex-start",
                padding: "8px 0", borderBottom: `1px solid ${T.hairSoft}`,
                paddingLeft: depth > 0 ? 16 : 0,
              }}>
                <span style={{
                  fontFamily: FONT_MONO, fontSize: 11.5, fontWeight: 700, minWidth: 24, flexShrink: 0,
                  color: failed ? T.red : mandatory ? T.orange : T.navy,
                }}>
                  {comp.position}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.4 }}>{comp.label}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 3 }}>
                    <span aria-hidden="true" style={{ width: 12, height: 2.5, background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontFamily: FONT_MONO, color: failed ? T.red : T.muted }}>{cable}</span>
                  </div>
                  {state.userRemarks?.trim() && (
                    <div style={{ fontSize: 11, color: T.faint, marginTop: 3, lineHeight: 1.45 }}>
                      {state.userRemarks}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Issue */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || !isValid}
          style={{
            width: "100%", padding: "13px 20px", border: "none",
            fontSize: 13, fontWeight: 650, fontFamily: FONT_SANS,
            background: !isValid ? T.hair : T.navy,
            color: !isValid ? T.faint : "#FFFFFF",
            cursor: generating ? "progress" : !isValid ? "not-allowed" : "pointer",
          }}
        >
          {generating
            ? "Generating…"
            : !isValid
              ? `Resolve ${errors.length} issue${errors.length === 1 ? "" : "s"}`
              : "Download cable plan (PDF)"}
        </button>
        {isValid && (
          <p style={{ margin: "10px 0 0", fontSize: 11, lineHeight: 1.5, color: T.faint, textAlign: "center" }}>
            Includes title block, elevation and cable schedule.
          </p>
        )}
      </div>
    </>
  );
}
