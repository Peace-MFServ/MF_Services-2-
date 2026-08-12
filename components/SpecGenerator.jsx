'use client'
import { useState, useCallback, useRef } from "react";
import RiserDoorPreview from "./RiserDoorPreview";
import { PRODUCT_ART } from "./ProductIllustrations";
import { generateHardwareSpecPDF } from "../lib/generateHardwareSpecPDF";
import { UI, FONT, fieldStyle, focusField, blurField } from "../lib/theme";
import {
  PRODUCT_TYPES, SPEC_TYPES, getProduct,
  buildInitialConfig, resolveProduct, validateSpec, specRows, getClearOpening, REQUIRE_ENQUIRY_DETAILS,
} from "../lib/hardwareSpec";

const STEPS = ["Product", "Specify", "Review"];

// ─── Primitives ───────────────────────────────────────────────────

function Label({ children, htmlFor, required }) {
  return (
    <label htmlFor={htmlFor} style={{
      display: "block", fontSize: 11.5, fontWeight: 600, letterSpacing: "0.07em",
      textTransform: "uppercase", color: UI.muted, fontFamily: FONT, marginBottom: 8,
    }}>
      {children}
      {required && <span style={{ color: UI.warn, marginLeft: 4 }} aria-hidden="true">*</span>}
      {required && <span style={{ position: "absolute", left: -9999 }}>(required)</span>}
    </label>
  );
}

function RailSection({ title, note, children }) {
  return (
    <div style={{ borderTop: `1px solid ${UI.ruleStrong}`, paddingTop: 20, marginTop: 26 }}>
      <div style={{
        fontSize: 11.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase",
        color: UI.ink, fontFamily: FONT, marginBottom: note ? 6 : 16,
      }}>
        {title}
      </div>
      {note && (
        <p style={{ margin: "0 0 16px", fontSize: 12.5, lineHeight: 1.5, color: UI.body, fontFamily: FONT }}>
          {note}
        </p>
      )}
      {children}
    </div>
  );
}

/** Labelled text field with its own error slot. */
function TextField({ id, label, required, value, onChange, onBlurTouch, error, type = "text", multiline }) {
  const border = error ? UI.warn : UI.ruleStrong;
  const common = {
    id, value: value || "",
    onChange: e => onChange(e.target.value),
    style: { ...fieldStyle, borderColor: border, ...(multiline ? { resize: "vertical" } : {}) },
    onFocus: focusField,
    onBlur: e => { onBlurTouch?.(); e.target.style.borderColor = border; e.target.style.boxShadow = "none"; },
  };
  return (
    <div style={{ marginBottom: 18 }}>
      <Label htmlFor={id} required={required}>{label}</Label>
      {multiline ? <textarea rows={3} {...common} /> : <input type={type} {...common} />}
      <FieldError>{error}</FieldError>
    </div>
  );
}

function FieldError({ children }) {
  if (!children) return null;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 7 }}>
      <span aria-hidden="true" style={{ width: 3, height: 15, background: UI.warn, flexShrink: 0, marginTop: 1 }} />
      <span style={{ fontSize: 12.5, lineHeight: 1.45, color: UI.warn, fontFamily: FONT }}>{children}</span>
    </div>
  );
}

/** Segmented selector — one row of mutually exclusive choices. */
function Segmented({ options, value, onChange, name }) {
  return (
    <div role="radiogroup" aria-label={name} style={{ display: "flex", flexWrap: "wrap", gap: -1 }}>
      {options.map((opt, i) => {
        const on = value === opt.value;
        return (
          <button
            key={opt.value} type="button" role="radio" aria-checked={on}
            onClick={() => onChange(opt.value)}
            style={{
              padding: "9px 16px", fontSize: 13.5, fontWeight: on ? 600 : 400, fontFamily: FONT,
              border: `1px solid ${on ? UI.accent : UI.ruleStrong}`,
              background: on ? UI.accent : UI.surface,
              color: on ? "#FFFFFF" : UI.body,
              cursor: "pointer",
              marginLeft: i === 0 ? 0 : -1,
              position: "relative", zIndex: on ? 1 : 0,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function RadioList({ choices, value, onChange, name, textValue, onTextChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {choices.map(choice => {
        const on = value === choice.id;
        return (
          <div key={choice.id}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input
                type="radio" name={name} checked={on}
                onChange={() => onChange(choice.id)}
                style={{ accentColor: UI.accent, width: 15, height: 15, margin: 0, flexShrink: 0 }}
              />
              <span style={{ fontSize: 13.5, color: on ? UI.ink : UI.body, fontWeight: on ? 600 : 400, fontFamily: FONT }}>
                {choice.label}
              </span>
            </label>
            {choice.note && (
              <p style={{
                margin: "3px 0 0 25px", fontSize: 12.5, lineHeight: 1.45,
                color: UI.muted, fontFamily: FONT,
              }}>
                {choice.note}
              </p>
            )}
            {on && choice.requiresText && (
              <input
                type="text"
                aria-label={choice.textLabel || "Value"}
                placeholder={choice.textPlaceholder || ""}
                value={textValue || ""}
                onChange={e => onTextChange(e.target.value)}
                style={{ ...fieldStyle, marginTop: 8, marginLeft: 25, width: "calc(100% - 25px)" }}
                onFocus={focusField} onBlur={blurField}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StepBar({ currentStep, setCurrentStep, furthest }) {
  return (
    <nav aria-label="Progress" style={{ display: "flex", borderBottom: `1px solid ${UI.rule}`, flexShrink: 0 }}>
      {STEPS.map((label, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        const reachable = i <= furthest;
        return (
          <button
            key={label} type="button"
            onClick={reachable ? () => setCurrentStep(i) : undefined}
            aria-current={active ? "step" : undefined}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "14px 8px", background: "none", border: "none",
              borderBottom: `2px solid ${active ? UI.accent : "transparent"}`, marginBottom: -1,
              cursor: reachable ? "pointer" : "default", fontFamily: FONT,
              color: active ? UI.ink : reachable ? UI.body : UI.muted,
              fontWeight: active ? 600 : 500, fontSize: 13.5,
            }}
          >
            <span style={{
              width: 20, height: 20, flexShrink: 0,
              border: `1.5px solid ${active || done ? UI.accent : UI.ruleStrong}`,
              background: done ? UI.accent : "transparent",
              color: done ? "#FFFFFF" : active ? UI.accent : UI.muted,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 600,
            }}>
              {done ? (
                <svg width="10" height="8" viewBox="0 0 10 8" aria-hidden="true">
                  <path d="M1 4L3.6 6.6L9 1.2" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : i + 1}
            </span>
            {label}
          </button>
        );
      })}
    </nav>
  );
}

// ─── Step 1 — product and project ─────────────────────────────────

/** Product card — the illustration carries it, the text supports it. */
function ProductCard({ product, selected, onSelect }) {
  const Art = PRODUCT_ART[product.id];
  const [hover, setHover] = useState(false);
  const live = product.available;
  const lift = live && (hover || selected);

  return (
    <button
      type="button"
      onClick={live ? onSelect : undefined}
      disabled={!live}
      aria-pressed={selected}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", flexDirection: "column", textAlign: "left", padding: 0,
        fontFamily: FONT, background: UI.surface,
        border: `1px solid ${selected ? UI.accent : lift ? UI.ruleStrong : UI.rule}`,
        boxShadow: selected ? `inset 0 0 0 2px ${UI.accent}` : "none",
        cursor: live ? "pointer" : "not-allowed",
        transition: "border-color 120ms, transform 120ms",
        transform: lift && !selected ? "translateY(-2px)" : "none",
        overflow: "hidden",
      }}
    >
      {/* Illustration */}
      <div style={{
        position: "relative", width: "100%", aspectRatio: "4 / 3",
        borderBottom: `1px solid ${selected ? UI.accent : UI.rule}`,
        background: "#F4F6F8",
        // Unavailable products stay legible — they are still selling the
        // range. The badge does the work of saying they aren't ready.
        opacity: live ? 1 : 0.78,
      }}>
        {Art ? <Art /> : null}
        {!live && (
          <span style={{
            position: "absolute", top: 10, right: 10,
            background: UI.ink, color: "#FFFFFF",
            fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase",
            padding: "4px 8px",
          }}>
            Coming soon
          </span>
        )}
      </div>

      {/* Caption */}
      <div style={{ padding: "14px 16px 16px", flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{
          fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em",
          color: live ? UI.ink : UI.muted, lineHeight: 1.3,
        }}>
          {product.label}
        </div>
        <div style={{ fontSize: 13, color: UI.body, marginTop: 5, lineHeight: 1.5, flex: 1 }}>
          {product.summary}
        </div>
        {live && (
          <div style={{
            marginTop: 12, fontSize: 12.5, fontWeight: 600,
            color: lift ? UI.accent : UI.muted,
          }}>
            Specify this doorset →
          </div>
        )}
      </div>
    </button>
  );
}

function ProductStep({ productTypeId, onChoose }) {
  return (
    <div style={{ padding: "36px 32px 44px" }}>
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", color: UI.ink, lineHeight: 1.2 }}>
        Choose a doorset
      </h1>
      <p style={{ margin: "9px 0 30px", fontSize: 15, lineHeight: 1.55, color: UI.body, maxWidth: 620 }}>
        Select a product to specify.
      </p>

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(266px, 1fr))", gap: 18,
      }}>
        {PRODUCT_TYPES.map(pt => (
          <ProductCard
            key={pt.id}
            product={pt}
            selected={productTypeId === pt.id}
            onSelect={() => onChoose(pt.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Step 2 — specify ─────────────────────────────────────────────

/** Everything still outstanding, in a neutral tone. The per-field
 *  errors only appear once a field has been touched, so this is what
 *  explains the "N to fix" on the footer button before then. */
function OutstandingList({ errors }) {
  if (errors.length === 0) {
    return (
      <div style={{ padding: "12px 22px", borderBottom: `1px solid ${UI.rule}`, background: UI.sunken }}>
        <span style={{ fontSize: 13, color: UI.body, fontFamily: FONT }}>Specification complete.</span>
      </div>
    );
  }
  return (
    <div style={{ padding: "12px 22px", borderBottom: `1px solid ${UI.rule}`, background: UI.sunken }}>
      {errors.map((e, i) => (
        <div key={`${e.field}-${i}`} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: i < errors.length - 1 ? 6 : 0 }}>
          <span aria-hidden="true" style={{ width: 3, height: 16, background: UI.ruleStrong, flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 13, lineHeight: 1.45, color: UI.body, fontFamily: FONT }}>{e.message}</span>
        </div>
      ))}
    </div>
  );
}

function SpecifyStep({ product, config, setConfig, errorFor, markTouched, specType, setSpecType, projectData, setProjectData }) {
  const set = (key, value) => { markTouched(key); setConfig(c => ({ ...c, [key]: value })); };
  const clearOpening = getClearOpening(product, config);

  return (
    <div style={{ padding: "20px 22px" }}>

      <div style={{ marginBottom: 24 }}>
        <Label>Number of leaves</Label>
        <Segmented
          name="Number of leaves"
          options={product.leafOptions.map(l => ({ value: l.value, label: String(l.value) }))}
          value={config.leaves}
          onChange={v => set("leaves", v)}
        />
        <p style={{ margin: "8px 0 0", fontSize: 12.5, color: UI.body, fontFamily: FONT }}>
          Choose the maximum for the opening.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div>
          <Label htmlFor="cfg-width">Structural width (mm)</Label>
          <input
            id="cfg-width" type="number" inputMode="numeric"
            min={product.limits.width.min} max={product.limits.width.absoluteMax}
            value={config.width}
            onChange={e => set("width", e.target.value)}
            style={{ ...fieldStyle, borderColor: errorFor("width") ? UI.warn : UI.ruleStrong }}
            onFocus={focusField}
            onBlur={e => { markTouched("width"); e.target.style.borderColor = errorFor("width") ? UI.warn : UI.ruleStrong; e.target.style.boxShadow = "none"; }}
          />
          <FieldError>{errorFor("width")}</FieldError>
        </div>
        <div>
          <Label htmlFor="cfg-height">Structural height (mm)</Label>
          <input
            id="cfg-height" type="number" inputMode="numeric"
            min={product.limits.height.min} max={product.limits.height.absoluteMax}
            value={config.height}
            onChange={e => set("height", e.target.value)}
            style={{ ...fieldStyle, borderColor: errorFor("height") ? UI.warn : UI.ruleStrong }}
            onFocus={focusField}
            onBlur={e => { markTouched("height"); e.target.style.borderColor = errorFor("height") ? UI.warn : UI.ruleStrong; e.target.style.boxShadow = "none"; }}
          />
          <FieldError>{errorFor("height")}</FieldError>
        </div>
      </div>

      <FieldError>{errorFor("size")}</FieldError>

      {clearOpening && (
        <div style={{
          marginTop: 4, padding: "11px 13px", background: UI.sunken,
          borderLeft: `3px solid ${UI.ruleStrong}`, fontFamily: FONT,
        }}>
          <div style={{ fontSize: 13, color: UI.body, lineHeight: 1.5 }}>
            Clear opening{" "}
            <strong style={{ color: UI.ink, fontWeight: 700 }}>
              {clearOpening.width} × {clearOpening.height} mm
            </strong>
          </div>
          {product.structuralAllowance?.note && (
            <div style={{ fontSize: 12.5, color: UI.muted, lineHeight: 1.45, marginTop: 4 }}>
              {product.structuralAllowance.note}
            </div>
          )}
        </div>
      )}

      <div style={{ marginBottom: 24, marginTop: 24 }}>
        <Label>Fire rating</Label>
        <Segmented
          name="Fire rating"
          options={product.fireRatings.map(r => ({ value: r.id, label: r.label }))}
          value={config.fireRating}
          onChange={v => set("fireRating", v)}
        />
        {product.fireClassificationNote && (
          <p style={{ margin: "10px 0 0", fontSize: 12.5, lineHeight: 1.5, color: UI.body, fontFamily: FONT }}>
            {product.fireClassificationNote}
          </p>
        )}
      </div>

      {product.options.map(opt => (
        <div key={opt.id} style={{ marginBottom: 24 }}>
          <Label>{opt.label}</Label>
          {opt.note && (
            <p style={{ margin: "-3px 0 10px", fontSize: 12.5, lineHeight: 1.5, color: UI.body, fontFamily: FONT }}>
              {opt.note}
            </p>
          )}
          <RadioList
            name={`opt-${opt.id}`}
            choices={opt.choices}
            value={config[opt.id]}
            onChange={v => set(opt.id, v)}
            textValue={config[`${opt.id}Text`]}
            onTextChange={v => set(`${opt.id}Text`, v)}
          />
          <FieldError>{errorFor(opt.id)}</FieldError>
        </div>
      ))}

      <RailSection title="Specification type">
        <Segmented
          name="Specification type"
          options={SPEC_TYPES.map(sp => ({ value: sp.id, label: sp.label }))}
          value={specType}
          onChange={setSpecType}
        />
        <p style={{ margin: "10px 0 0", fontSize: 12.5, lineHeight: 1.5, color: UI.body, fontFamily: FONT }}>
          {SPEC_TYPES.find(sp => sp.id === specType)?.summary}
        </p>
      </RailSection>

      <RailSection title="Your details" note={REQUIRE_ENQUIRY_DETAILS ? "So we can send the specification on and answer any questions." : "Optional for now. So we can answer any questions."}>
        <TextField
          id="pd-businessName" label="Business name" required={REQUIRE_ENQUIRY_DETAILS}
          value={projectData.businessName}
          onChange={v => setProjectData(pd => ({ ...pd, businessName: v }))}
          onBlurTouch={() => markTouched("businessName")}
          error={errorFor("businessName")}
        />
        <TextField
          id="pd-contactName" label="Contact name"
          value={projectData.contactName}
          onChange={v => setProjectData(pd => ({ ...pd, contactName: v }))}
        />
        <TextField
          id="pd-email" label="Email" required={REQUIRE_ENQUIRY_DETAILS} type="email"
          value={projectData.email}
          onChange={v => setProjectData(pd => ({ ...pd, email: v }))}
          onBlurTouch={() => markTouched("email")}
          error={errorFor("email")}
        />
        <TextField
          id="pd-phone" label="Phone" required={REQUIRE_ENQUIRY_DETAILS} type="tel"
          value={projectData.phone}
          onChange={v => setProjectData(pd => ({ ...pd, phone: v }))}
          onBlurTouch={() => markTouched("phone")}
          error={errorFor("phone")}
        />
      </RailSection>

      <RailSection title="Project">
        <TextField
          id="pd-projectName" label="Project name"
          value={projectData.projectName}
          onChange={v => setProjectData(pd => ({ ...pd, projectName: v }))}
        />
        <TextField
          id="pd-architecturalFirm" label="Architectural firm"
          value={projectData.architecturalFirm}
          onChange={v => setProjectData(pd => ({ ...pd, architecturalFirm: v }))}
        />
      </RailSection>
    </div>
  );
}

// ─── Step 3 — review ──────────────────────────────────────────────

function ReviewStep({ product, config, projectData, specType, validation, onGenerate, generating, notice }) {
  const rows = specRows(product, config);
  const resolution = validation.resolution;

  const Section = ({ title, children }) => (
    <div style={{ marginBottom: 26 }}>
      <div style={{
        fontSize: 11.5, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase",
        color: UI.muted, fontFamily: FONT, paddingBottom: 9, marginBottom: 12,
        borderBottom: `1px solid ${UI.ruleStrong}`,
      }}>{title}</div>
      {children}
    </div>
  );

  const Row = ({ label, value, accent }) => (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 14,
      padding: "9px 0", borderBottom: `1px solid ${UI.rule}`,
    }}>
      <span style={{ fontSize: 13.5, color: UI.body, fontFamily: FONT }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: accent || UI.ink, fontFamily: FONT, textAlign: "right" }}>{value}</span>
    </div>
  );

  return (
    <div style={{ padding: "20px 22px" }}>
      <Section title="Doorset">
        <Row label="Type" value={product.label} />
        {resolution?.status === "matched"
          ? <Row label="Configuration" value={resolution.product.name} />
          : resolution?.status !== "incomplete" && (
              <Row label="Configuration" value="Bespoke enquiry" accent={UI.warn} />
            )}
        <Row label="Document" value={SPEC_TYPES.find(s => s.id === specType)?.label ?? specType} />
      </Section>

      <Section title="Specification">
        {rows.map(r => <Row key={r.label} label={r.label} value={r.value} />)}
      </Section>

      <Section title="Project">
        {projectData.projectName?.trim()
          ? <Row label="Project" value={projectData.projectName} />
          : <p style={{ margin: 0, fontSize: 13.5, color: UI.body, fontFamily: FONT }}>No project name recorded.</p>}
        {projectData.architecturalFirm?.trim() && <Row label="Architectural firm" value={projectData.architecturalFirm} />}
      </Section>

      <Section title="Your details">
        {projectData.businessName?.trim() && <Row label="Business" value={projectData.businessName} />}
        {projectData.contactName?.trim() && <Row label="Contact" value={projectData.contactName} />}
        {projectData.email?.trim() && <Row label="Email" value={projectData.email} />}
        {projectData.phone?.trim() && <Row label="Phone" value={projectData.phone} />}
      </Section>

      <Section title="Standards">
        {product.standards.map(s => (
          <div key={s.code} style={{ padding: "8px 0", borderBottom: `1px solid ${UI.rule}` }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: UI.ink, fontFamily: FONT }}>{s.code}</div>
            <div style={{ fontSize: 12.5, color: UI.body, fontFamily: FONT, marginTop: 2, lineHeight: 1.45 }}>{s.description}</div>
          </div>
        ))}
      </Section>

      {validation.warnings.map((w, i) => (
        <div key={i} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <span aria-hidden="true" style={{ width: 3, height: 17, background: UI.ruleStrong, flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 13, lineHeight: 1.5, color: UI.body, fontFamily: FONT }}>{w.message}</span>
        </div>
      ))}

      <button
        type="button" onClick={onGenerate} disabled={generating || !validation.isValid}
        style={{
          width: "100%", padding: "14px 20px",
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
        <p style={{ margin: "12px 0 0", fontSize: 13, lineHeight: 1.5, textAlign: "center", fontFamily: FONT, color: notice.error ? UI.warn : UI.body }}>
          {notice.text}
        </p>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────

export default function SpecGenerator() {
  const [currentStep, setCurrentStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [productTypeId, setProductTypeId] = useState("riser-doors");
  const [specType, setSpecType] = useState("branded");
  const [projectData, setProjectData] = useState({
    businessName: "", contactName: "", email: "", phone: "",
    projectName: "", architecturalFirm: "",
  });

  const product = getProduct(productTypeId);
  const [config, setConfig] = useState(() => buildInitialConfig(getProduct("riser-doors")));
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState(null);

  const railRef = useRef(null);

  const validation = validateSpec(product, config, projectData);
  const resolution = resolveProduct(product, config);

  // A field only turns red once it has been touched — arriving on the
  // step with everything already flagged reads as broken. What is still
  // outstanding is listed neutrally above the fields instead.
  const [touched, setTouched] = useState(() => new Set());
  const markTouched = useCallback(field => {
    setTouched(t => (t.has(field) ? t : new Set(t).add(field)));
  }, []);
  const errorFor = useCallback(
    field => (touched.has(field) ? validation.errors.find(e => e.field === field)?.message : undefined),
    [touched, validation.errors],
  );

  const chooseProduct = useCallback(id => {
    setProductTypeId(id);
    setCurrentStep(1);
    setFurthest(f => Math.max(f, 1));
    if (railRef.current) railRef.current.scrollTop = 0;
  }, []);

  const goNext = () => {
    const next = Math.min(currentStep + 1, STEPS.length - 1);
    setCurrentStep(next);
    setFurthest(f => Math.max(f, next));
    if (railRef.current) railRef.current.scrollTop = 0;
  };
  const goBack = () => {
    setCurrentStep(s => Math.max(s - 1, 0));
    if (railRef.current) railRef.current.scrollTop = 0;
  };

  const handleGenerate = async () => {
    setGenerating(true); setNotice(null);
    try {
      const filename = await generateHardwareSpecPDF({ product, config, projectData, specType, resolution });
      setNotice({ text: `Saved as ${filename}` });
    } catch (err) {
      setNotice({ text: err?.message || "Could not generate the PDF.", error: true });
    } finally {
      setGenerating(false);
    }
  };

  const nextBlocked = currentStep === 1 && !validation.isValid;

  const shell = {
    border: `1px solid ${UI.ruleStrong}`, background: UI.surface,
    fontFamily: FONT, color: UI.body,
  };

  const footer = (
    <footer style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      padding: "14px 22px", borderTop: `1px solid ${UI.ruleStrong}`, flexShrink: 0,
    }}>
      <button
        type="button" onClick={goBack} disabled={currentStep === 0}
        style={{
          padding: "10px 18px", fontSize: 13.5, fontWeight: 500, fontFamily: FONT,
          border: `1px solid ${UI.ruleStrong}`, background: UI.surface,
          color: currentStep === 0 ? UI.muted : UI.ink,
          cursor: currentStep === 0 ? "not-allowed" : "pointer",
          opacity: currentStep === 0 ? 0.5 : 1,
        }}
      >
        Back
      </button>
      {currentStep < STEPS.length - 1 && (
        <button
          type="button" onClick={goNext} disabled={nextBlocked}
          style={{
            padding: "10px 26px", fontSize: 13.5, fontWeight: 600, fontFamily: FONT,
            border: `1px solid ${nextBlocked ? UI.ruleStrong : UI.accent}`,
            background: nextBlocked ? UI.sunken : UI.accent,
            color: nextBlocked ? UI.muted : "#FFFFFF",
            cursor: nextBlocked ? "not-allowed" : "pointer",
          }}
        >
          {nextBlocked ? `${validation.errors.length} to fix` : currentStep === 0 ? `Specify ${product?.label ?? "product"}` : "Next"}
        </button>
      )}
    </footer>
  );

  // Product selection runs full width — the illustrations are the point
  // of the step, and they do not read at rail width.
  if (currentStep === 0) {
    return (
      <div style={{ ...shell, display: "flex", flexDirection: "column", minHeight: 640 }}>
        <StepBar currentStep={currentStep} setCurrentStep={setCurrentStep} furthest={furthest} />
        <div style={{ flex: 1 }}>
          <ProductStep productTypeId={productTypeId} onChoose={chooseProduct} />
        </div>
      </div>
    );
  }

  return (
    <div style={{
      ...shell, display: "flex", height: "calc(100vh - 190px)",
      minHeight: 640, overflow: "hidden",
    }}>
      <aside style={{
        width: 424, flexShrink: 0, display: "flex", flexDirection: "column",
        borderRight: `1px solid ${UI.ruleStrong}`, minHeight: 0,
      }}>
        <header style={{ padding: "18px 22px 16px", borderBottom: `1px solid ${UI.rule}`, flexShrink: 0 }}>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", color: UI.ink, lineHeight: 1.3 }}>
            {product?.label ?? "Doorset"}
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: UI.body, lineHeight: 1.5 }}>
            {SPEC_TYPES.find(s => s.id === specType)?.label} specification
            {projectData.projectName?.trim() ? ` · ${projectData.projectName.trim()}` : ""}
          </p>
        </header>

        <StepBar currentStep={currentStep} setCurrentStep={setCurrentStep} furthest={furthest} />

        {currentStep === 1 && <OutstandingList errors={validation.errors} />}

        <div ref={railRef} style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          {currentStep === 1 && product && (
            <SpecifyStep
              product={product} config={config} setConfig={setConfig}
              errorFor={errorFor} markTouched={markTouched}
              specType={specType} setSpecType={setSpecType}
              projectData={projectData} setProjectData={setProjectData}
            />
          )}
          {currentStep === 2 && product && (
            <ReviewStep
              product={product} config={config} projectData={projectData} specType={specType}
              validation={validation} onGenerate={handleGenerate} generating={generating} notice={notice}
            />
          )}
        </div>

        {footer}
      </aside>

      <section style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <RiserDoorPreview product={product} config={config} resolution={resolution} />
      </section>
    </div>
  );
}
