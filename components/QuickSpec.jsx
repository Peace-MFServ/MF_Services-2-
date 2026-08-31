'use client'
import { useState, useCallback, useEffect } from "react";
import { generateHardwareSpecPDF } from "../lib/generateHardwareSpecPDF";
import BackArrow from "./BackArrow";
import { UI, FONT, fieldStyle, cardStyle } from "../lib/theme";
import {
  SPEC_TYPES, CHRISTO, getProduct,
  buildInitialConfig, resolveProduct, validateSpec, specRows,
} from "../lib/hardwareSpec";

// ─────────────────────────────────────────────────────────────────
// Quick specification
// ─────────────────────────────────────────────────────────────────
// The same product, the same rules, for someone who specifies riser
// doors every week and does not need to be walked through it. Every
// choice on one screen, no drawing, no steps — pick down the page and
// the sheet is ready. The elevation still goes on the PDF.
//
// State lives under the guided tool's own storage key, so switching
// between the two carries the configuration across.
// ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = "mf-hardware-spec-v2";

const mmDigits = value => value.replace(/\D/g, "").slice(0, 4);

function SectionTitle({ children, hint }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h2 style={{
        margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em",
        textTransform: "uppercase", color: UI.ink, fontFamily: FONT,
      }}>
        {children}
      </h2>
      {hint && (
        <p style={{ margin: "5px 0 0", fontSize: 12.5, lineHeight: 1.45, color: UI.muted }}>{hint}</p>
      )}
    </div>
  );
}

function Field({ label, children, width }) {
  return (
    <div style={{ minWidth: 0, flex: width ? `0 0 ${width}px` : "1 1 0" }}>
      <div style={{
        fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
        color: UI.muted, marginBottom: 6,
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

/** Compact pick-one row. The whole interface is built from these. */
function Chips({ options, value, onChange, name }) {
  return (
    <div role="radiogroup" aria-label={name} style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map(opt => {
        const on = value === opt.value;
        const disabled = !!opt.disabled;
        return (
          <button
            key={opt.value} type="button" role="radio" aria-checked={on}
            disabled={disabled}
            title={disabled ? opt.disabledReason : opt.title}
            onClick={disabled ? undefined : () => onChange(opt.value)}
            style={{
              padding: "7px 12px", fontSize: 13, fontWeight: on ? 600 : 500, fontFamily: FONT,
              border: `1px solid ${on ? UI.accent : UI.ruleStrong}`,
              background: on ? UI.accent : disabled ? UI.sunken : UI.surface,
              color: on ? "#FFFFFF" : disabled ? UI.muted : UI.ink,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.5 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {opt.label}
            {disabled && opt.disabledReason ? <span className="vh"> — {opt.disabledReason}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Header action, styled to match the layout switch beside it. */
function HeaderButton({ onClick, children }) {
  return (
    <button
      type="button" onClick={onClick}
      style={{
        padding: "7px 14px", fontSize: 12.5, fontFamily: FONT, fontWeight: 400,
        border: `1px solid ${UI.ruleStrong}`, background: UI.surface, color: UI.body,
        cursor: "pointer", whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

function Input({ id, value, onChange, placeholder, type = "text" }) {
  return (
    <input
      id={id} type={type} value={value || ""} placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      style={{ ...fieldStyle, padding: "8px 10px", fontSize: 13 }} className="mf-field"
    />
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

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "calc(100vh - 136px)", minHeight: 620,
      borderTop: `1px solid ${UI.rule}`, background: UI.surface,
      fontFamily: FONT, color: UI.body, overflow: "hidden",
    }}>

      {/* ── Header ── */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
        padding: "14px 26px", borderBottom: `1px solid ${UI.ruleStrong}`, flexShrink: 0,
      }}>
        {/* The layout switch sits on the left in both views, so it does
            not move when you change between them. */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 16, width: 452, flexShrink: 0, minWidth: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <BackArrow onClick={onChangeProduct} label="Change product" />
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", color: UI.ink }}>
              {product.label}
            </h2>
          </div>
          {modeSwitch}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <HeaderButton onClick={onChangeProduct}>Change product</HeaderButton>
          <HeaderButton onClick={startOver}>Start over</HeaderButton>
        </div>
      </header>

      {/* The questions and the sheet sit centred on a sunken canvas —
          a wall-to-wall form on a wide monitor reads worse, not better. */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", justifyContent: "center", overflow: "hidden", background: UI.sunken }}>

        {/* ── The whole specification, one screen ── */}
        <div style={{ flex: "0 1 852px", minWidth: 0, overflowY: "auto", padding: "22px 26px 40px" }}>

          <section style={{ ...cardStyle, marginBottom: 18 }}>
            <SectionTitle hint={`Structural opening, ${product.statedLimits.width.min}–${product.statedLimits.width.absoluteMax} × ${product.statedLimits.height.min}–${product.statedLimits.height.absoluteMax} mm.`}>
              Opening
            </SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Field label="Opening size (mm)">
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    id="qs-width" aria-label="Width (mm)" placeholder="1100"
                    value={config.width || ""} onChange={e => set("width", mmDigits(e.target.value))}
                    style={{ ...fieldStyle, width: 120, padding: "8px 10px", fontSize: 13 }} className="mf-field"
                  />
                  <span aria-hidden="true" style={{ color: UI.muted, fontSize: 13 }}>×</span>
                  <input
                    id="qs-height" aria-label="Height (mm)" placeholder="2300"
                    value={config.height || ""} onChange={e => set("height", mmDigits(e.target.value))}
                    style={{ ...fieldStyle, width: 120, padding: "8px 10px", fontSize: 13 }} className="mf-field"
                  />
                  <span style={{ color: UI.muted, fontSize: 12.5 }}>width × height</span>
                </div>
              </Field>
              <Field label="Leaves">
                <Chips
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
              <p style={{ margin: "12px 0 0", fontSize: 12.5, color: UI.muted }}>
                Clear opening <strong style={{ color: UI.ink }}>{resolution.clear.width} × {resolution.clear.height} mm</strong>
                {resolution.leaf && <> · Leaf <strong style={{ color: UI.ink }}>{resolution.leaf.width} × {resolution.leaf.height} mm</strong></>}
              </p>
            )}
          </section>

          <section style={{ ...cardStyle, marginBottom: 18 }}>
            <SectionTitle>Doorset</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Field label="Fire rating">
                <Chips
                  name="Fire rating" value={config.fireRating} onChange={v => set("fireRating", v)}
                  options={product.fireRatings.map(f => ({ value: f.id, label: f.label }))}
                />
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(170px, 230px) 1fr", gap: "16px 26px", alignItems: "start" }}>
                <Field label="Handing">
                  <Chips name="Handing" value={config.handing} onChange={v => set("handing", v)} options={chipsFor("handing")} />
                </Field>
                <Field label="Door restrictor">
                  <Chips name="Door restrictor" value={config.doorRestrictor} onChange={v => set("doorRestrictor", v)} options={chipsFor("doorRestrictor")} />
                </Field>
              </div>
              <Field label="Acoustic">
                <Chips name="Acoustic" value={config.acoustic} onChange={v => set("acoustic", v)} options={chipsFor("acoustic")} />
              </Field>
            </div>
          </section>

          <section style={{ ...cardStyle, marginBottom: 18 }}>
            <SectionTitle>Being fixed into</SectionTitle>
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
                      <Input
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

          <section style={{ ...cardStyle, marginBottom: 18 }}>
            <SectionTitle hint={(config.leaves || 1) > 1 ? CHRISTO.passiveLeafLockNote : undefined}>
              Lock &amp; key
            </SectionTitle>
            <Chips
              name="Lock" value={config.lockType} onChange={v => set("lockType", v)}
              options={CHRISTO.locks.map(l => ({ value: l.id, label: l.label, title: l.summary }))}
            />
          </section>

          <section style={cardStyle}>
            <SectionTitle>Project</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", gap: 22, flexWrap: "wrap", alignItems: "flex-end" }}>
                <Field label="Specification type & quantity" width={250}>
                  <Chips
                    name="Specification type" value={specType} onChange={setSpecType}
                    options={SPEC_TYPES.map(sp => ({ value: sp.id, label: sp.label, title: sp.summary }))}
                  />
                </Field>
                <Field label="Quantity of doorsets" width={190}>
                  <input
                    id="qs-quantity" type="text" inputMode="numeric" value={config.quantity}
                    onChange={e => set("quantity", e.target.value.replace(/\D/g, "").slice(0, 3))}
                    style={{ ...fieldStyle, width: 76, height: 31, padding: "0 10px", fontSize: 13, textAlign: "center" }} className="mf-field"
                  />
                </Field>
              </div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <Field label="Email"><Input id="qs-email" type="email" value={projectData.email} onChange={v => setPd("email", v)} /></Field>
                <Field label="Phone"><Input id="qs-phone" type="tel" value={projectData.phone} onChange={v => setPd("phone", v)} /></Field>
              </div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <Field label="Project name"><Input id="qs-project" value={projectData.projectName} onChange={v => setPd("projectName", v)} /></Field>
                <Field label="Architectural firm"><Input id="qs-firm" value={projectData.architecturalFirm} onChange={v => setPd("architecturalFirm", v)} /></Field>
              </div>
            </div>
          </section>
        </div>

        {/* ── Live sheet, always in view ── */}
        <aside style={{
          width: 372, flexShrink: 0,
          display: "flex", flexDirection: "column", minHeight: 0,
          padding: "22px 26px 22px 0",
        }}>
          <div style={{
            ...cardStyle, padding: 0, flex: 1, minHeight: 0,
            display: "flex", flexDirection: "column",
          }}>
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 22px" }}>
            <SectionTitle>Specification</SectionTitle>
            {rows.map(r => (
              <div key={r.label} style={{
                display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12,
                padding: "8px 0", borderBottom: `1px solid ${UI.rule}`,
              }}>
                <span style={{ fontSize: 12.5, color: UI.body }}>{r.label}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: UI.ink, textAlign: "right" }}>{r.value}</span>
              </div>
            ))}
          </div>

          <div style={{ borderTop: `1px solid ${UI.rule}`, padding: "16px 22px 20px", flexShrink: 0 }}>
            {validation.errors.length > 0 && (
              <ul style={{ margin: "0 0 12px", padding: 0, listStyle: "none" }}>
                {validation.errors.slice(0, 4).map((e, i) => (
                  <li key={`${e.field}-${i}`} style={{ display: "flex", gap: 8, marginBottom: 5 }}>
                    <span aria-hidden="true" style={{ width: 3, height: 15, background: UI.warn, flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 12.5, lineHeight: 1.4, color: UI.body }}>{e.message}</span>
                  </li>
                ))}
                {validation.errors.length > 4 && (
                  <li style={{ fontSize: 12.5, color: UI.muted, marginLeft: 11 }}>
                    and {validation.errors.length - 4} more
                  </li>
                )}
              </ul>
            )}
            <button
              type="button" onClick={handleGenerate} disabled={generating || !validation.isValid}
              style={{
                width: "100%", padding: "13px 20px",
                border: `1px solid ${validation.isValid ? UI.accent : UI.ruleStrong}`,
                fontSize: 14, fontWeight: 600, fontFamily: FONT,
                background: validation.isValid ? UI.accent : UI.sunken,
                color: validation.isValid ? "#FFFFFF" : UI.muted,
                cursor: generating ? "progress" : validation.isValid ? "pointer" : "not-allowed",
              }}
            >
              {generating ? "Generating" : validation.isValid ? "Download specification (PDF)" : `${validation.errors.length} to fix`}
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
  );
}
