'use client'
import { useState, useCallback } from "react";
import { generateCablePlanPDF } from "../lib/generateCablePlanPDF";
import { UI, FONT, resolveCable, flattenComponents, isMandatoryForSystem } from "../lib/cablePlanSpec";

// ─── Notifications ────────────────────────────────────────────────

function Notice({ notices, dismiss }) {
  if (notices.length === 0) return null;
  return (
    <div style={{
      position: "fixed", bottom: 20, right: 20, zIndex: 9999,
      display: "flex", flexDirection: "column", gap: 8, maxWidth: 400,
    }}>
      {notices.map(n => (
        <div key={n.id} role={n.type === "error" ? "alert" : "status"} style={{
          display: "flex", alignItems: "flex-start", gap: 12,
          background: UI.surface, border: `1px solid ${UI.ruleStrong}`,
          borderLeft: `3px solid ${n.type === "error" ? UI.warn : UI.accent}`,
          padding: "13px 15px",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: UI.ink, fontFamily: FONT }}>{n.title}</div>
            {n.message && (
              <div style={{ fontSize: 13, color: UI.body, lineHeight: 1.5, marginTop: 4, fontFamily: FONT, wordBreak: "break-word" }}>
                {n.message}
              </div>
            )}
          </div>
          <button type="button" onClick={() => dismiss(n.id)} aria-label="Dismiss"
            style={{ background: "none", border: "none", padding: 3, cursor: "pointer", flexShrink: 0, lineHeight: 0 }}>
            <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
              <path d="M1 1L10 10M10 1L1 10" stroke={UI.muted} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ))}
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

// ─── Primitives ───────────────────────────────────────────────────

function Heading({ children }) {
  return (
    <div style={{
      fontSize: 11.5, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase",
      color: UI.muted, fontFamily: FONT, paddingBottom: 9, marginBottom: 12,
      borderBottom: `1px solid ${UI.ruleStrong}`,
    }}>
      {children}
    </div>
  );
}

function Row({ label, value, accent }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 14,
      padding: "9px 0", borderBottom: `1px solid ${UI.rule}`,
    }}>
      <span style={{ fontSize: 13.5, color: UI.body, fontFamily: FONT }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: accent || UI.ink, fontFamily: FONT, textAlign: "right" }}>
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

  const titleBlock = [
    ["Construction project", projectData.constructionProject],
    ["Door number", projectData.doorNumberOrNaming],
    ["Location", projectData.installationLocation],
    ["Position no.", projectData.positionNumberInSpec],
  ].filter(([, v]) => v?.trim());

  const handleGenerate = async () => {
    if (!isValid) return;
    setGenerating(true);
    try {
      const filename = await generateCablePlanPDF({ system, componentStates, projectData });
      push({ type: "success", title: "PDF saved", message: filename, duration: 6000 });
    } catch (err) {
      push({ type: "error", title: "PDF failed", message: err?.message || "Unexpected error.", duration: 9000 });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <Notice notices={notices} dismiss={dismiss} />
      <div style={{ padding: "20px 22px", fontFamily: FONT }}>

        <div style={{ marginBottom: 26 }}>
          <Heading>Plan</Heading>
          <Row label="System" value={system.name} />
          <Row label="Leaf type" value={system.leafType} />
          <Row label="Fire door" value={system.isFireDoor ? "Yes" : "No"} accent={system.isFireDoor ? UI.warn : undefined} />
          <Row label="Positions" value={`${included.length} of ${flat.length}`} />
        </div>

        <div style={{ marginBottom: 26 }}>
          <Heading>Title block</Heading>
          {titleBlock.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: UI.body }}>
              Empty. The PDF will have no title block.
            </p>
          ) : titleBlock.map(([label, value]) => <Row key={label} label={label} value={value} />)}
        </div>

        <div style={{ marginBottom: 26 }}>
          <Heading>Checks</Heading>
          {isValid && warnings.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: UI.body }}>
              All positions complete.
            </p>
          ) : (
            [...errors.map(e => ({ ...e, level: "error" })), ...warnings.map(w => ({ ...w, level: "warning" }))].map((item, i) => (
              <div key={`${item.id}-${i}`} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 9 }}>
                <span aria-hidden="true" style={{
                  width: 3, height: 17, marginTop: 1, flexShrink: 0,
                  background: item.level === "error" ? UI.warn : UI.ruleStrong,
                }} />
                <span style={{ fontSize: 13, lineHeight: 1.5, color: UI.body }}>
                  <strong style={{ fontWeight: 700, color: UI.ink }}>{item.position}</strong>{" "}
                  {item.label} — {item.reason}
                </span>
              </div>
            ))
          )}
        </div>

        <div style={{ marginBottom: 28 }}>
          <Heading>Cable schedule</Heading>
          {included.map(({ comp, depth }) => {
            const state = componentStates[comp.id];
            const cable = state.isOther ? (state.otherValue?.trim() || "Not specified") : state.selectedCable;
            const { color } = resolveCable(state);
            const mandatory = isMandatoryForSystem(comp, system);
            const failed = errors.some(e => e.id === comp.id);
            return (
              <div key={comp.id} style={{
                display: "flex", gap: 12, alignItems: "flex-start",
                padding: "10px 0", borderBottom: `1px solid ${UI.rule}`,
                paddingLeft: depth > 0 ? 18 : 0,
              }}>
                <span style={{
                  fontSize: 13.5, fontWeight: 700, minWidth: 26, flexShrink: 0,
                  color: failed ? UI.warn : mandatory ? UI.warn : UI.accent,
                }}>
                  {comp.position}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, color: UI.ink, lineHeight: 1.45 }}>{comp.label}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 5 }}>
                    <span aria-hidden="true" style={{ width: 16, height: 3, background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: failed ? UI.warn : UI.body }}>{cable}</span>
                  </div>
                  {state.userRemarks?.trim() && (
                    <div style={{ fontSize: 13, color: UI.muted, marginTop: 5, lineHeight: 1.5 }}>
                      {state.userRemarks}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button" onClick={handleGenerate} disabled={generating || !isValid}
          style={{
            width: "100%", padding: "14px 20px",
            border: `1px solid ${isValid ? UI.accent : UI.ruleStrong}`,
            fontSize: 14, fontWeight: 600, fontFamily: FONT,
            background: isValid ? UI.accent : UI.sunken,
            color: isValid ? "#FFFFFF" : UI.muted,
            cursor: generating ? "progress" : isValid ? "pointer" : "not-allowed",
          }}
        >
          {generating ? "Generating" : isValid ? "Download PDF" : `${errors.length} to fix`}
        </button>
      </div>
    </>
  );
}
