'use client'
import { useState, useCallback, useRef } from "react";
import RiserDoorPreview from "./RiserDoorPreview";
import { generateHardwareSpecPDF } from "../lib/generateHardwareSpecPDF";
import { UI, FONT, fieldStyle, focusField, blurField } from "../lib/theme";
import {
  PRODUCT_TYPES, SPEC_TYPES, getProduct,
  buildInitialConfig, resolveProduct, validateSpec, specRows,
} from "../lib/hardwareSpec";

const STEPS = ["Product", "Specify", "Review"];

// ─── Primitives ───────────────────────────────────────────────────

function Label({ children, htmlFor }) {
  return (
    <label htmlFor={htmlFor} style={{
      display: "block", fontSize: 11.5, fontWeight: 600, letterSpacing: "0.07em",
      textTransform: "uppercase", color: UI.muted, fontFamily: FONT, marginBottom: 8,
    }}>
      {children}
    </label>
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

function ProductStep({ productTypeId, setProductTypeId, specType, setSpecType, projectData, setProjectData }) {
  return (
    <div style={{ padding: "20px 22px" }}>
      <Label>Product type</Label>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 26 }}>
        {PRODUCT_TYPES.map(pt => {
          const on = productTypeId === pt.id;
          return (
            <button
              key={pt.id} type="button"
              onClick={pt.available ? () => setProductTypeId(pt.id) : undefined}
              disabled={!pt.available}
              aria-pressed={on}
              style={{
                textAlign: "left", padding: "13px 15px", fontFamily: FONT,
                border: `1px solid ${on ? UI.accent : UI.ruleStrong}`,
                boxShadow: on ? `inset 0 0 0 1px ${UI.accent}` : "none",
                background: pt.available ? UI.surface : UI.sunken,
                cursor: pt.available ? "pointer" : "not-allowed",
                opacity: pt.available ? 1 : 0.65,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontSize: 14.5, fontWeight: 600, color: pt.available ? UI.ink : UI.muted }}>
                  {pt.label}
                </span>
                {!pt.available && (
                  <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: UI.muted }}>
                    Coming soon
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12.5, color: UI.body, marginTop: 4, lineHeight: 1.45 }}>
                {pt.summary}
              </div>
            </button>
          );
        })}
      </div>

      <Label>Specification type</Label>
      <div style={{ marginBottom: 26 }}>
        <Segmented
          name="Specification type"
          options={SPEC_TYPES.map(s => ({ value: s.id, label: s.label }))}
          value={specType}
          onChange={setSpecType}
        />
        <p style={{ margin: "9px 0 0", fontSize: 12.5, lineHeight: 1.5, color: UI.body, fontFamily: FONT }}>
          {SPEC_TYPES.find(s => s.id === specType)?.summary}
        </p>
      </div>

      {[
        ["projectName", "Project name"],
        ["architecturalFirm", "Architectural firm"],
        ["contactDetails", "Contact details"],
      ].map(([key, label]) => (
        <div key={key} style={{ marginBottom: 18 }}>
          <Label htmlFor={`pd-${key}`}>{label}</Label>
          {key === "contactDetails" ? (
            <textarea
              id={`pd-${key}`} rows={3} value={projectData[key]}
              onChange={e => setProjectData(p => ({ ...p, [key]: e.target.value }))}
              style={{ ...fieldStyle, resize: "vertical" }}
              onFocus={focusField} onBlur={blurField}
            />
          ) : (
            <input
              id={`pd-${key}`} type="text" value={projectData[key]}
              onChange={e => setProjectData(p => ({ ...p, [key]: e.target.value }))}
              style={fieldStyle}
              onFocus={focusField} onBlur={blurField}
            />
          )}
        </div>
      ))}
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

function SpecifyStep({ product, config, setConfig, errorFor, markTouched }) {
  const set = (key, value) => { markTouched(key); setConfig(c => ({ ...c, [key]: value })); };

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
          <Label htmlFor="cfg-width">Maximum width (mm)</Label>
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
          <Label htmlFor="cfg-height">Maximum height (mm)</Label>
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

      <div style={{ marginBottom: 24, marginTop: 24 }}>
        <Label>Fire rating</Label>
        <Segmented
          name="Fire rating"
          options={product.fireRatings.map(r => ({ value: r.id, label: r.label }))}
          value={config.fireRating}
          onChange={v => set("fireRating", v)}
        />
      </div>

      {product.options.map(opt => (
        <div key={opt.id} style={{ marginBottom: 24 }}>
          <Label>{opt.label}</Label>
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

  const Row = ({ label, value }) => (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 14,
      padding: "9px 0", borderBottom: `1px solid ${UI.rule}`,
    }}>
      <span style={{ fontSize: 13.5, color: UI.body, fontFamily: FONT }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: UI.ink, fontFamily: FONT, textAlign: "right" }}>{value}</span>
    </div>
  );

  return (
    <div style={{ padding: "20px 22px" }}>
      <Section title="Product">
        <Row label="Type" value={product.label} />
        {resolution?.status === "matched" && (
          <>
            <Row label="Product" value={resolution.product.name} />
            <Row label="Code" value={resolution.product.code} />
          </>
        )}
        <Row label="Specification" value={SPEC_TYPES.find(s => s.id === specType)?.label ?? specType} />
      </Section>

      <Section title="Specification">
        {rows.map(r => <Row key={r.label} label={r.label} value={r.value} />)}
      </Section>

      <Section title="Project">
        {projectData.projectName?.trim()
          ? <Row label="Project" value={projectData.projectName} />
          : <p style={{ margin: 0, fontSize: 13.5, color: UI.body, fontFamily: FONT }}>No project name recorded.</p>}
        {projectData.architecturalFirm?.trim() && <Row label="Architectural firm" value={projectData.architecturalFirm} />}
        {projectData.contactDetails?.trim() && <Row label="Contact" value={projectData.contactDetails} />}
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
  const [projectData, setProjectData] = useState({ projectName: "", architecturalFirm: "", contactDetails: "" });

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

  return (
    <div style={{
      display: "flex", height: "calc(100vh - 190px)", minHeight: 640,
      border: `1px solid ${UI.ruleStrong}`, background: UI.surface,
      fontFamily: FONT, color: UI.body, overflow: "hidden",
    }}>

      <aside style={{
        width: 424, flexShrink: 0, display: "flex", flexDirection: "column",
        borderRight: `1px solid ${UI.ruleStrong}`, minHeight: 0,
      }}>
        <header style={{ padding: "18px 22px 16px", borderBottom: `1px solid ${UI.rule}`, flexShrink: 0 }}>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", color: UI.ink, lineHeight: 1.3 }}>
            Hardware specification
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: UI.body, lineHeight: 1.5 }}>
            Choose a product, set the dimensions, download the specification.
          </p>
        </header>

        <StepBar currentStep={currentStep} setCurrentStep={setCurrentStep} furthest={furthest} />

        {currentStep === 1 && <OutstandingList errors={validation.errors} />}

        <div ref={railRef} style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          {currentStep === 0 && (
            <ProductStep
              productTypeId={productTypeId} setProductTypeId={setProductTypeId}
              specType={specType} setSpecType={setSpecType}
              projectData={projectData} setProjectData={setProjectData}
            />
          )}
          {currentStep === 1 && product && (
            <SpecifyStep product={product} config={config} setConfig={setConfig}
              errorFor={errorFor} markTouched={markTouched} />
          )}
          {currentStep === 2 && product && (
            <ReviewStep
              product={product} config={config} projectData={projectData} specType={specType}
              validation={validation} onGenerate={handleGenerate} generating={generating} notice={notice}
            />
          )}
        </div>

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
              {nextBlocked ? `${validation.errors.length} to fix` : "Next"}
            </button>
          )}
        </footer>
      </aside>

      <section style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <RiserDoorPreview product={product} config={config} resolution={resolution} />
      </section>
    </div>
  );
}
