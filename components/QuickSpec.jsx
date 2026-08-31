'use client'
import { useState, useCallback, useEffect } from "react";
import { generateHardwareSpecPDF } from "../lib/generateHardwareSpecPDF";
import BackArrow from "./BackArrow";
import { UI, FONT, fieldStyle, cardStyle } from "../lib/theme";
import { Field, Chips, Input } from "./SteelDoorsetFields";
import { QS, CardTitle, ICONS, groupSheetRows } from "./quickSpecUI";
import {
  SPEC_TYPES, CHRISTO, getProduct,
  buildInitialConfig, resolveProduct, validateSpec, specRows,
} from "../lib/hardwareSpec";

// ─────────────────────────────────────────────────────────────────
// Quick specification
// ─────────────────────────────────────────────────────────────────
// The same product, the same rules, for someone who specifies riser
// doors every week and does not need to be walked through it. Every
// choice on one screen: section cards down a centred page, with the
// sheet building in a sticky summary beside them. The elevation still
// goes on the PDF.
//
// State lives under the guided tool's own storage key, so switching
// between the two carries the configuration across.
// ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = "mf-hardware-spec-v2";

const mmDigits = value => value.replace(/\D/g, "").slice(0, 4);

// Which sheet rows belong under which summary heading. Anything not
// claimed lands in the last group rather than disappearing.
const SHEET_GROUPS = [
  { title: "Opening", icon: ICONS.opening, labels: ["Structural opening", "Clear opening", "Leaf size", "Number of leaves"] },
  { title: "Doorset", icon: ICONS.door, labels: ["Quantity", "Fire rating", "Handing", "Acoustic requirement", "Door restrictor"] },
  { title: "Being fixed into", icon: ICONS.wall, labels: ["Wall construction", "Frame", "Finish"] },
  { title: "Lock & key", icon: ICONS.key, labels: null },
];

/** Header action, styled to match the layout switch beside it. */
function HeaderButton({ onClick, children }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        padding: "8px 14px", fontSize: 12.5, fontFamily: FONT, fontWeight: 500,
        border: "1px solid #CBD5E1", background: UI.surface, color: UI.body,
        cursor: "pointer", whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

export default function QuickSpec({ productTypeId = "riser-doors", onChangeProduct, modeSwitch }) {
  const product = getProduct(productTypeId);

  const [config, setConfig] = useState(() => buildInitialConfig(product));
  const [specType, setSpecType] = useState("branded");
  const [projectData, setProjectData] = useState({
    email: "", phone: "",
    projectName: "", architecturalFirm: "",
  });
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState(null);
  // State, not a ref: saving must wait for a render in which the
  // restored configuration is present, or the first save writes the
  // empty initial state back over it.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.config) setConfig(c => ({ ...c, ...saved.config }));
        if (saved.specType) setSpecType(saved.specType);
        if (saved.projectData) setProjectData(pd => ({ ...pd, ...saved.projectData }));
      }
    } catch { /* corrupt or unavailable storage is not worth breaking the tool over */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      // Keep whatever the guided tool stored alongside this, so the two
      // views hand back and forth without losing anyone's place.
      let prev = {};
      try { prev = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || "{}"); } catch { /* ignore */ }
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...prev, productTypeId, config, specType, projectData,
      }));
    } catch { /* storage full or blocked — persistence is best-effort */ }
  }, [hydrated, productTypeId, config, specType, projectData]);

  const startOver = useCallback(() => {
    setConfig(buildInitialConfig(product));
    setSpecType("branded");
    setProjectData({
      email: "", phone: "",
      projectName: "", architecturalFirm: "",
    });
    setNotice(null);
    try { window.sessionStorage.removeItem(STORAGE_KEY); } catch { /* best-effort */ }
  }, [product]);

  const set = useCallback((key, value) => setConfig(c => ({ ...c, [key]: value })), []);
  const setPd = useCallback((key, value) => setProjectData(pd => ({ ...pd, [key]: value })), []);

  const validation = validateSpec(product, config, projectData);
  const resolution = validation.resolution ?? resolveProduct(product, config);
  const rows = specRows(product, config, resolution);
  const groups = groupSheetRows(rows, SHEET_GROUPS);

  const allowed = resolution?.allowedLeaves ?? [];
  const hasDims = resolution?.status !== "incomplete";
  const maxLeaves = product.statedLimits.maxLeaves ?? 6;

  // The measurements decide the leaf counts, exactly as in the guided
  // tool — snap when the entered opening stops approving the current one.
  const allowedKey = allowed.join(",");
  useEffect(() => {
    if (allowed.length > 0 && !allowed.includes(config.leaves)) {
      setConfig(c => ({ ...c, leaves: allowed[0] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedKey]);

  const opt = id => product.options.find(o => o.id === id);
  const chipsFor = id => (opt(id)?.choices ?? []).map(c => ({ value: c.id, label: c.label, title: c.note }));

  const handleGenerate = async () => {
    setGenerating(true); setNotice(null);
    try {
      await generateHardwareSpecPDF({ product, config, projectData, specType, resolution });
      setNotice({ text: "Specification downloaded." });
    } catch (err) {
      setNotice({ text: "Could not generate the specification. Please try again.", error: true });
    } finally {
      setGenerating(false);
    }
  };

  const finishChoice = opt("finish")?.choices.find(c => c.id === config.finish);
  const card = { ...cardStyle, marginBottom: 16 };

  return (
    <div className="mf-rounded" style={{
      background: QS.bg, borderTop: `1px solid ${UI.rule}`,
      minHeight: "calc(100vh - 136px)",
      fontFamily: FONT, color: UI.body,
    }}>
      <div className="qs-page">

        {/* ── Header ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 16, flexWrap: "wrap", marginBottom: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <BackArrow onClick={onChangeProduct} label="Change product" />
            <h2 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: "-0.015em", color: QS.ink }}>
              {product.label}
            </h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {modeSwitch}
            <HeaderButton onClick={onChangeProduct}>Change product</HeaderButton>
            <HeaderButton onClick={startOver}>Start over</HeaderButton>
          </div>
        </div>

        <div className="qs-grid">

          {/* ── The whole specification, one screen ── */}
          <div style={{ minWidth: 0 }}>

            <section style={card}>
              <CardTitle icon={ICONS.opening} hint={`Structural opening, ${product.statedLimits.width.min}–${product.statedLimits.width.absoluteMax} × ${product.statedLimits.height.min}–${product.statedLimits.height.absoluteMax} mm.`}>
                Opening
              </CardTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="qs-3col">
                  <Field label="Opening size (mm)">
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <input
                        id="qs-width" aria-label="Width (mm)" placeholder="1100"
                        value={config.width || ""} onChange={e => set("width", mmDigits(e.target.value))}
                        style={{ ...fieldStyle, flex: "1 1 0", minWidth: 82, padding: "10px 12px", fontSize: 13 }} className="mf-field"
                      />
                      <span aria-hidden="true" style={{ color: QS.muted, fontSize: 13 }}>×</span>
                      <input
                        id="qs-height" aria-label="Height (mm)" placeholder="2300"
                        value={config.height || ""} onChange={e => set("height", mmDigits(e.target.value))}
                        style={{ ...fieldStyle, flex: "1 1 0", minWidth: 82, padding: "10px 12px", fontSize: 13 }} className="mf-field"
                      />
                    </div>
                  </Field>
                  <Field label="Leaves">
                    <Chips segmented
                      name="Leaves"
                      value={config.leaves}
                      onChange={v => set("leaves", v)}
                      options={Array.from({ length: maxLeaves }, (_, i) => {
                        const n = i + 1;
                        return {
                          value: n, label: String(n),
                          disabled: !hasDims || (allowed.length > 0 && !allowed.includes(n)),
                          disabledReason: !hasDims ? "Enter the opening first" : "Not an approved size at this leaf count",
                        };
                      })}
                    />
                  </Field>
                </div>
                {resolution?.clear && (
                  <p style={{ margin: 0, fontSize: 12.5, color: QS.muted }}>
                    Clear opening <strong style={{ color: QS.ink }}>{resolution.clear.width} × {resolution.clear.height} mm</strong>
                    {resolution.leaf && <> · Leaf <strong style={{ color: QS.ink }}>{resolution.leaf.width} × {resolution.leaf.height} mm</strong></>}
                  </p>
                )}
              </div>
            </section>

            <section style={card}>
              <CardTitle icon={ICONS.door}>Doorset</CardTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="qs-3col">
                  <Field label="Fire rating">
                    <Chips segmented
                      name="Fire rating" value={config.fireRating} onChange={v => set("fireRating", v)}
                      options={product.fireRatings.map(f => ({ value: f.id, label: f.label }))}
                    />
                  </Field>
                  <Field label="Handing">
                    <Chips segmented name="Handing" value={config.handing} onChange={v => set("handing", v)} options={chipsFor("handing")} />
                  </Field>
                  <Field label="Door restrictor">
                    <Chips segmented name="Door restrictor" value={config.doorRestrictor} onChange={v => set("doorRestrictor", v)} options={chipsFor("doorRestrictor")} />
                  </Field>
                </div>
                <Field label="Acoustic">
                  <Chips name="Acoustic" value={config.acoustic} onChange={v => set("acoustic", v)} options={chipsFor("acoustic")} />
                </Field>
              </div>
            </section>

            <section style={card}>
              <CardTitle icon={ICONS.wall}>Being fixed into</CardTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <Field label="Wall construction">
                  <Chips
                    name="Wall construction" value={config.wallType} onChange={v => set("wallType", v)}
                    options={CHRISTO.walls.map(w => ({
                      value: w.id, label: w.label,
                      disabled: (config.leaves || 1) > w.maxLeaves,
                      disabledReason: `Approved to ${w.maxLeaves} leaves`,
                    }))}
                  />
                </Field>
                <Field label="Frame">
                  <Chips
                    name="Frame" value={config.frameStyle || "flush"} onChange={v => set("frameStyle", v)}
                    options={CHRISTO.frames.map(f => ({ value: f.id, label: f.label, title: f.summary }))}
                  />
                </Field>
                <Field label="Finish">
                  <div>
                    <Chips name="Finish" value={config.finish} onChange={v => set("finish", v)} options={chipsFor("finish")} />
                    {finishChoice?.requiresText && (
                      <div style={{ marginTop: 8, maxWidth: 260 }}>
                        <Input tall
                          id="qs-finishText" value={config.finishText}
                          onChange={v => set("finishText", v)}
                          placeholder={finishChoice.textPlaceholder || finishChoice.textLabel}
                        />
                      </div>
                    )}
                  </div>
                </Field>
              </div>
            </section>

            <section style={card}>
              <CardTitle icon={ICONS.key} hint={(config.leaves || 1) > 1 ? CHRISTO.passiveLeafLockNote : undefined}>
                Lock &amp; key
              </CardTitle>
              <Chips
                name="Lock" value={config.lockType} onChange={v => set("lockType", v)}
                options={CHRISTO.locks.map(l => ({ value: l.id, label: l.label, title: l.summary }))}
              />
            </section>

            <section style={cardStyle}>
              <CardTitle icon={ICONS.project}>Project</CardTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", gap: 22, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <Field label="Specification type & quantity" width={250}>
                    <Chips segmented
                      name="Specification type" value={specType} onChange={setSpecType}
                      options={SPEC_TYPES.map(sp => ({ value: sp.id, label: sp.label, title: sp.summary }))}
                    />
                  </Field>
                  <Field label="Quantity of doorsets" width={190}>
                    <input
                      id="qs-quantity" type="text" inputMode="numeric" value={config.quantity}
                      onChange={e => set("quantity", e.target.value.replace(/\D/g, "").slice(0, 3))}
                      style={{ ...fieldStyle, width: 76, height: 40, padding: "0 10px", fontSize: 13, textAlign: "center" }} className="mf-field"
                    />
                  </Field>
                </div>
                <div className="qs-3col" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                  <Field label="Email"><Input tall id="qs-email" type="email" value={projectData.email} onChange={v => setPd("email", v)} /></Field>
                  <Field label="Phone"><Input tall id="qs-phone" type="tel" value={projectData.phone} onChange={v => setPd("phone", v)} /></Field>
                  <Field label="Project name"><Input tall id="qs-project" value={projectData.projectName} onChange={v => setPd("projectName", v)} /></Field>
                  <Field label="Architectural firm"><Input tall id="qs-firm" value={projectData.architecturalFirm} onChange={v => setPd("architecturalFirm", v)} /></Field>
                </div>
              </div>
            </section>
          </div>

          {/* ── Live sheet, sticky beside the questions ── */}
          <aside className="qs-aside">
            <div style={{
              ...cardStyle, padding: 0, overflow: "hidden",
              display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 40px)",
            }}>
              <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 20 }}>
                <CardTitle icon={ICONS.sheet}>Specification</CardTitle>
                {groups.map((g, gi) => (
                  <div key={g.title} style={gi > 0 ? { marginTop: 14, paddingTop: 12, borderTop: "1px solid #E2E8F0" } : undefined}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 7, marginBottom: 2,
                      fontSize: 11, fontWeight: 700, letterSpacing: "0.07em",
                      textTransform: "uppercase", color: UI.accent,
                    }}>
                      <span aria-hidden="true" style={{ display: "inline-flex", transform: "scale(0.78)", transformOrigin: "left center" }}>
                        {g.icon}
                      </span>
                      {g.title}
                    </div>
                    {g.rows.map(r => (
                      <div key={r.label} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12,
                        padding: "7px 0", borderBottom: "1px solid #EEF2F6",
                      }}>
                        <span style={{ fontSize: 12.5, color: QS.muted }}>{r.label}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: QS.ink, textAlign: "right" }}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div style={{ borderTop: "1px solid #E2E8F0", padding: "16px 20px 20px", flexShrink: 0 }}>
                {validation.errors.length > 0 && (
                  <ul style={{ margin: "0 0 12px", padding: 0, listStyle: "none" }}>
                    {validation.errors.slice(0, 4).map((e, i) => (
                      <li key={`${e.field}-${i}`} style={{ display: "flex", gap: 8, marginBottom: 5 }}>
                        <span aria-hidden="true" style={{ width: 3, height: 15, background: UI.warn, flexShrink: 0, marginTop: 1 }} />
                        <span style={{ fontSize: 12.5, lineHeight: 1.4, color: UI.body }}>{e.message}</span>
                      </li>
                    ))}
                    {validation.errors.length > 4 && (
                      <li style={{ fontSize: 12.5, color: QS.muted, marginLeft: 11 }}>
                        and {validation.errors.length - 4} more
                      </li>
                    )}
                  </ul>
                )}
                <button
                  type="button" onClick={handleGenerate} disabled={generating || !validation.isValid}
                  className="qs-download"
                  style={{
                    width: "100%", height: 46, padding: "0 20px",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    border: `1px solid ${validation.isValid ? UI.accent : "#CBD5E1"}`,
                    fontSize: 14, fontWeight: 600, fontFamily: FONT,
                    background: validation.isValid ? UI.accent : UI.sunken,
                    color: validation.isValid ? "#FFFFFF" : UI.muted,
                    cursor: generating ? "progress" : validation.isValid ? "pointer" : "not-allowed",
                  }}
                >
                  {generating ? "Generating" : validation.isValid ? "Download specification (PDF)" : `${validation.errors.length} to fix`}
                  {!generating && validation.isValid && ICONS.download}
                </button>
                {notice && (
                  <p style={{ margin: "10px 0 0", fontSize: 12.5, textAlign: "center", color: notice.error ? UI.warn : UI.body }}>
                    {notice.text}
                  </p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
