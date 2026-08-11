'use client'
import { useState, useEffect, useCallback } from "react";
import { generateCablePlanPDF as _generateCablePlanPDF, runComplianceCheck } from "../lib/generateCablePlanPDF";

const THEME = {
  navy: "#00387B",
  border: "#D2D7DC",
  surface: "#FFFFFF",
  surfaceAlt: "#F8FAFC",
  panel: "#F4F7E0",
  panelText: "#8A9B2A",
  orange: "#ED6E02",
  textPrimary: "#0F172A",
  textMuted: "#475569",
  textFaint: "#64748B",
  error: "#DC2626",
  warning: "#B45309",
  success: "#166534",
};

function Toast({ toasts, dismiss }) {
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, display: "flex", flexDirection: "column", gap: 10, zIndex: 9999, maxWidth: 400 }}>
      {toasts.map((t) => {
        const toastStyle = t.type === "error"
          ? { background: "#FEF3F2", border: "1px solid #FECACA", title: "#B91C1C", text: "#92400E", icon: "#DC2626" }
          : t.type === "warning"
            ? { background: "#FFF7ED", border: "1px solid #FCD9A2", title: "#B45309", text: "#92400E", icon: "#EA580C" }
            : { background: "#ECFDF5", border: "1px solid #86EFAC", title: "#166534", text: "#166534", icon: "#16A34A" };
        return (
          <div key={t.id} style={{ background: toastStyle.background, border: toastStyle.border, borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 12, boxShadow: "0 8px 24px rgba(16,24,40,0.08)" }}>
            <span style={{ fontSize: 16, flexShrink: 0, paddingTop: 1, color: toastStyle.icon }}>{t.type === "error" ? "✕" : t.type === "warning" ? "⚠" : "✓"}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: toastStyle.title, marginBottom: 3 }}>{t.title}</div>
              {t.message && <div style={{ fontSize: 11, color: toastStyle.text, lineHeight: 1.5 }}>{t.message}</div>}
            </div>
            <button onClick={() => dismiss(t.id)} style={{ background: "none", border: "none", color: THEME.textMuted, cursor: "pointer", fontSize: 12, padding: 0, flexShrink: 0 }}>✕</button>
          </div>
        );
      })}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState([]);
  const dismiss = useCallback((id) => { setToasts((prev) => prev.filter((t) => t.id !== id)); }, []);
  const push = useCallback(({ type="error", title, message, duration=6000 }) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, title, message }]);
    if (duration) setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);
  return { toasts, push, dismiss };
}


export default function ReviewAndGenerate({ system, componentStates, projectData }) {
  const { toasts, push, dismiss } = useToast();
  const [generating, setGenerating] = useState(false);
  const [failures, setFailures] = useState([]);

  useEffect(() => {
    if (!system) return;
    setFailures(runComplianceCheck(system, componentStates));
  }, [system, componentStates]);

  const handleGeneratePDF = async () => {
    const currentFailures = runComplianceCheck(system, componentStates);
    setFailures(currentFailures);
    if (currentFailures.length > 0) {
      if (currentFailures.length <= 3) {
        currentFailures.forEach((f) => { push({ type:"warning", title:`Component ${f.position}: ${f.label}`, message:f.reason, duration:8000 }); });
      } else {
        push({ type:"error", title:`${currentFailures.length} compliance issues found`, message:"Please fix all highlighted components before generating.", duration:10000 });
      }
      return;
    }
    setGenerating(true);
    try {
      const filename = await _generateCablePlanPDF({ system, componentStates, projectData });
      push({ type:"success", title:"PDF Generated Successfully", message:`Saved as: ${filename}`, duration:5000 });
    } catch (err) {
      push({ type:"error", title:"PDF Generation Failed", message:err.message||"An unexpected error occurred.", duration:8000 });
    } finally {
      setGenerating(false);
    }
  };

  if (!system) return null;

  const allComps = [];
  system.components.forEach(comp => {
    allComps.push(comp);
    if (comp.subComponents) comp.subComponents.forEach(sub => allComps.push(sub));
  });

  const includedCount = allComps.filter(c => componentStates[c.id]?.included).length;

  return (
    <>
      <Toast toasts={toasts} dismiss={dismiss} />
      <div style={{ fontFamily: "DM Sans, sans-serif", color: THEME.textPrimary, background: THEME.surface, padding: 24 }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <h2 style={{ fontFamily: "DM Sans, sans-serif", fontSize: 22, fontWeight: 700, color: THEME.textPrimary, marginBottom: 8 }}>Review & Generate</h2>
          <p style={{ color: THEME.textMuted, fontSize: 14, marginBottom: 24 }}>Final compliance check before PDF generation.</p>

          <div style={{ display: "flex", gap: 0, background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 24 }}>
            <div style={{ flex: 1, padding: "16px 20px", borderRight: `1px solid ${THEME.border}` }}>
              <div style={{ fontSize: 10, color: THEME.textMuted, textTransform: "uppercase", marginBottom: 4 }}>System</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: THEME.navy }}>{system.name}</div>
            </div>
            <div style={{ flex: 1, padding: "16px 20px", borderRight: `1px solid ${THEME.border}` }}>
              <div style={{ fontSize: 10, color: THEME.textMuted, textTransform: "uppercase", marginBottom: 4 }}>Leaf Type</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: THEME.navy }}>{system.leafType}</div>
            </div>
            <div style={{ flex: 1, padding: "16px 20px", borderRight: `1px solid ${THEME.border}` }}>
              <div style={{ fontSize: 10, color: THEME.textMuted, textTransform: "uppercase", marginBottom: 4 }}>Fire Door</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: system.isFireDoor ? THEME.orange : THEME.panelText }}>{system.isFireDoor ? "YES" : "No"}</div>
            </div>
            <div style={{ flex: 1, padding: "16px 20px" }}>
              <div style={{ fontSize: 10, color: THEME.textMuted, textTransform: "uppercase", marginBottom: 4 }}>Components</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: THEME.navy }}>{includedCount} included</div>
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: THEME.navy, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12, fontWeight: 700 }}>Compliance Check</div>
            {failures.length === 0 ? (
              <div style={{ background: THEME.panel, border: `1px solid ${THEME.border}`, borderRadius: 10, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ fontSize: 24, color: THEME.panelText }}>✓</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: THEME.panelText, marginBottom: 3 }}>Compliance Check Passed</div>
                  <div style={{ fontSize: 12, color: THEME.textMuted }}>All mandatory fields completed. Ready to generate PDF.</div>
                </div>
              </div>
            ) : (
              <div style={{ background: THEME.surface, border: `1px solid ${THEME.border}`, borderRadius: 10, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: 14, borderBottom: `1px solid ${THEME.border}` }}>
                  <span style={{ fontSize: 24, color: THEME.orange }}>⚠</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: THEME.orange, marginBottom: 3 }}>Compliance Check Failed</div>
                    <div style={{ fontSize: 12, color: THEME.warning }}>{failures.length} issue{failures.length > 1 ? "s" : ""} must be resolved</div>
                  </div>
                </div>
                <div style={{ padding: "12px 20px" }}>
                  {failures.map((f, i) => (
                    <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10, borderBottom: i < failures.length - 1 ? `1px solid ${THEME.border}` : "none", paddingBottom: i < failures.length - 1 ? 10 : 0 }}>
                      <span style={{ background: "#FFF1E6", color: THEME.orange, borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{f.position}</span>
                      <div>
                        <div style={{ fontSize: 13, color: THEME.orange, marginBottom: 2 }}>{f.label}</div>
                        <div style={{ fontSize: 11, color: THEME.warning }}>{f.reason}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: THEME.navy, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12, fontWeight: 700 }}>Selected Components</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {allComps.map(comp => {
                const state = componentStates[comp.id];
                if (!state?.included) return null;
                const cable = state.isOther ? `Other: ${state.otherValue || "(unspecified)"}` : state.selectedCable;
                const hasFail = failures.some(f => f.id === comp.id);
                const isMandatory = comp.mandatory || (comp.conditions?.some(c => system[c.if?.property] === c.if?.equals && c.then?.mandatory) ?? false);
                return (
                  <div key={comp.id} style={{ background: THEME.surface, borderRadius: 8, padding: "12px 16px", border: `1px solid ${THEME.border}`, borderLeft: `3px solid ${hasFail ? THEME.orange : isMandatory ? THEME.navy : THEME.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ display: "flex", gap: 12 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: hasFail ? THEME.orange : isMandatory ? THEME.navy : THEME.textPrimary }}>{comp.position}</span>
                        <div>
                          <div style={{ fontSize: 14, color: THEME.textPrimary, marginBottom: 3 }}>{comp.label}</div>
                          <div style={{ fontSize: 11, color: THEME.navy, fontFamily: "monospace" }}>{cable}</div>
                          {state.userRemarks && <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 3 }}>Note: {state.userRemarks}</div>}
                          {hasFail && <div style={{ fontSize: 11, color: THEME.orange, marginTop: 4 }}>⚠ {failures.find(f => f.id === comp.id)?.reason}</div>}
                        </div>
                      </div>
                      {isMandatory && <span style={{ background: "#FFF4E6", color: THEME.orange, borderRadius: 4, padding: "2px 6px", fontSize: 9, fontWeight: 700 }}>REQUIRED</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ paddingTop: 24, borderTop: `1px solid ${THEME.border}` }}>
            <button
              onClick={handleGeneratePDF}
              disabled={generating}
              style={{ width: "100%", padding: "18px 24px", border: "none", borderRadius: 10, fontSize: 16, fontWeight: 700, color: "#fff", fontFamily: "DM Sans, sans-serif", cursor: generating ? "wait" : "pointer", background: failures.length > 0 ? THEME.border : generating ? THEME.navy : THEME.navy, boxShadow: failures.length > 0 ? "none" : "0 10px 30px rgba(0,56,123,0.18)" }}>
              {generating ? "Generating PDF..." : failures.length > 0 ? `Fix ${failures.length} issue${failures.length > 1 ? "s" : ""} to unlock PDF` : "Download Cable Plan PDF"}
            </button>
            {failures.length === 0 && !generating && <p style={{ textAlign: "center", color: THEME.textFaint, fontSize: 12, marginTop: 12 }}>PDF will include project metadata, cable diagram, and component table.</p>}
          </div>
        </div>
      </div>
    </>
  );
}
