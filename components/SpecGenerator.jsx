'use client'
import { useState, useCallback, useRef, useEffect } from "react";
import RiserDoorPreview from "./RiserDoorPreview";
import { PRODUCT_ART } from "./ProductIllustrations";
import { generateHardwareSpecPDF } from "../lib/generateHardwareSpecPDF";
import { UI, FONT, fieldStyle, focusField, blurField } from "../lib/theme";
import {
  PRODUCT_TYPES, SPEC_TYPES, CHRISTO, getProduct,
  buildInitialConfig, resolveProduct, validateSpec, specRows, REQUIRE_ENQUIRY_DETAILS,
} from "../lib/hardwareSpec";

// The opening comes first; the leaf counts on offer are the ones the
// approval covers for that opening. Wall construction and lock get
// their own visual steps.
const STEPS = ["Product", "Specify", "Wall", "Lock & key", "Review"];

// Which validation errors belong to which step, so each step only
// gates on its own fields. Finish lives on the Wall step with the
// other appearance choices.
const SPECIFY_FIELDS = new Set(["width", "height", "handing", "acoustic", "doorRestrictor"]);

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
        const disabled = !!opt.disabled;
        return (
          <button
            key={opt.value} type="button" role="radio" aria-checked={on}
            disabled={disabled}
            title={disabled ? opt.disabledReason : undefined}
            onClick={disabled ? undefined : () => onChange(opt.value)}
            style={{
              padding: "9px 16px", fontSize: 13.5, fontWeight: on ? 600 : 400, fontFamily: FONT,
              border: `1px solid ${on ? UI.accent : UI.ruleStrong}`,
              background: on ? UI.accent : disabled ? UI.sunken : UI.surface,
              color: on ? "#FFFFFF" : disabled ? UI.muted : UI.body,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.55 : 1,
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
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              padding: "13px 4px", background: "none", border: "none",
              borderBottom: `2px solid ${active ? UI.accent : "transparent"}`, marginBottom: -1,
              cursor: reachable ? "pointer" : "default", fontFamily: FONT,
              color: active ? UI.ink : reachable ? UI.body : UI.muted,
              fontWeight: active ? 600 : 500, fontSize: 12.5,
            }}
          >
            <span style={{
              width: 19, height: 19, flexShrink: 0,
              border: `1.5px solid ${active || done ? UI.accent : UI.ruleStrong}`,
              background: done ? UI.accent : "transparent",
              color: done ? "#FFFFFF" : active ? UI.accent : UI.muted,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10.5, fontWeight: 600,
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

// ─── Step 1 — product ─────────────────────────────────────────────

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
      <div style={{
        position: "relative", width: "100%", aspectRatio: "4 / 3",
        borderBottom: `1px solid ${selected ? UI.accent : UI.rule}`,
        background: "#F4F6F8",
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

/** Everything still outstanding on THIS step, in a neutral tone. */
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

/** What the entered opening works out to. */
function DerivedOpening({ product, resolution }) {
  const clear = resolution?.clear;
  if (!clear) return null;
  const leaves = resolution?.leaves;
  const leafW = resolution?.leaf?.width ?? (leaves ? Math.round(clear.width / leaves) : null);

  const Line = ({ label, value }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginTop: 5 }}>
      <span style={{ fontSize: 13, color: UI.body }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: UI.ink }}>{value}</span>
    </div>
  );

  return (
    <div style={{
      marginTop: 4, padding: "13px 15px", background: UI.sunken,
      borderLeft: `3px solid ${UI.accent}`, fontFamily: FONT,
    }}>
      <div style={{
        fontSize: 11.5, fontWeight: 600, letterSpacing: "0.07em",
        textTransform: "uppercase", color: UI.muted, marginBottom: 2,
      }}>
        This opening works out to
      </div>
      <Line label="Clear opening" value={`${clear.width} × ${clear.height} mm`} />
      {leafW != null && <Line label="Leaf size" value={`${leafW} × ${clear.height} mm`} />}
    </div>
  );
}

function SpecifyStep({ product, config, setConfig, errorFor, markTouched, resolution }) {
  const set = (key, value) => { markTouched(key); setConfig(c => ({ ...c, [key]: value })); };

  const maxLeaves = product.statedLimits.maxLeaves ?? 6;
  const hasDims = resolution?.status !== "incomplete";
  const allowed = resolution?.allowedLeaves ?? [];

  // The measurements decide the leaf counts on offer. Before any
  // dimensions: nothing to choose. With dimensions: only approved
  // counts are enabled — unless nothing is approved, in which case the
  // choice is free and the sheet issues as a bespoke enquiry.
  const leafOptions = Array.from({ length: maxLeaves }, (_, i) => {
    const n = i + 1;
    const disabled = !hasDims || (allowed.length > 0 && !allowed.includes(n));
    return {
      value: n, label: String(n), disabled,
      disabledReason: !hasDims ? "Enter the opening first" : "Not an approved size at this leaf count",
    };
  });

  const leafNote = !hasDims
    ? "Enter the opening above — the approved leaf counts appear here."
    : allowed.length > 0
      ? `Approved for this opening: ${allowed.join(", ")} ${allowed.length === 1 ? "leaf" : "leaves"}.`
      : "No pre-approved configuration at this size — the specification will be issued as a bespoke enquiry.";

  return (
    <div style={{ padding: "20px 22px" }}>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div>
          <Label htmlFor="cfg-width">Structural width (mm)</Label>
          <input
            id="cfg-width" type="number" inputMode="numeric"
            min={product.statedLimits.width.min} max={product.statedLimits.width.absoluteMax}
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
            min={product.statedLimits.height.min} max={product.statedLimits.height.absoluteMax}
            value={config.height}
            onChange={e => set("height", e.target.value)}
            style={{ ...fieldStyle, borderColor: errorFor("height") ? UI.warn : UI.ruleStrong }}
            onFocus={focusField}
            onBlur={e => { markTouched("height"); e.target.style.borderColor = errorFor("height") ? UI.warn : UI.ruleStrong; e.target.style.boxShadow = "none"; }}
          />
          <FieldError>{errorFor("height")}</FieldError>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <Label>Number of leaves</Label>
        <Segmented
          name="Number of leaves"
          options={leafOptions}
          value={config.leaves}
          onChange={v => set("leaves", v)}
        />
        <p style={{ margin: "8px 0 0", fontSize: 12.5, color: UI.body, fontFamily: FONT }}>
          {leafNote}
        </p>
      </div>

      <DerivedOpening product={product} resolution={resolution} />

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

      {product.options.filter(opt => opt.id !== "finish").map(opt => (
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
    </div>
  );
}

// ─── Step 3 — wall construction (visual) ──────────────────────────

/** Miniature plan-sections, one per wall construction. Abstract but
 *  distinct at a glance — boards, studs, block, shaft, lined block. */
function WallArt({ id }) {
  const board = "#C4CCD4", stud = "#9AA5B1", timber = "#C9A876", block = "#B4B9BE";
  const W = 120, H = 62, boardH = 8;
  const Boards = () => (
    <>
      <rect x="4" y="6" width={W - 8} height={boardH} fill={board} stroke="#57646F" strokeWidth="0.8" />
      <rect x="4" y={H - 6 - boardH} width={W - 8} height={boardH} fill={board} stroke="#57646F" strokeWidth="0.8" />
    </>
  );
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" aria-hidden="true" style={{ display: "block" }}>
      {id === "timber-stud" && (
        <>
          <Boards />
          {[18, 52, 86].map(x => (
            <rect key={x} x={x} y={15} width={16} height={H - 30} fill={timber} stroke="#8A6B3F" strokeWidth="0.8" />
          ))}
        </>
      )}
      {id === "steel-stud" && (
        <>
          <Boards />
          {[18, 52, 86].map(x => (
            <path key={x} d={`M${x + 14} 15 H${x} V${H - 15} H${x + 14}`} fill="none" stroke={stud} strokeWidth="2.4" />
          ))}
        </>
      )}
      {id === "masonry" && (
        <>
          {[0, 1, 2].map(r => (
            <g key={r}>
              {[0, 1, 2].map(c => (
                <rect key={c} x={4 + c * 38 - (r % 2 ? 19 : 0)} y={8 + r * 16} width={36} height={14}
                  fill={block} stroke="#57646F" strokeWidth="0.8" />
              ))}
            </g>
          ))}
        </>
      )}
      {id === "shaftwall" && (
        <>
          <rect x="4" y="6" width={W - 8} height={boardH} fill={board} stroke="#57646F" strokeWidth="0.8" />
          <rect x="4" y={H - 6 - boardH * 2} width={W - 8} height={boardH} fill={board} stroke="#57646F" strokeWidth="0.8" />
          <rect x="4" y={H - 6 - boardH} width={W - 8} height={boardH} fill={board} stroke="#57646F" strokeWidth="0.8" />
          {[24, 62, 100].map(x => (
            <path key={x} d={`M${x - 6} 16 H${x + 6} M${x} 16 V${H - 24}`} fill="none" stroke={stud} strokeWidth="2.2" />
          ))}
        </>
      )}
      {id === "masonry-lined" && (
        <>
          {[0, 1].map(r => (
            <g key={r}>
              {[0, 1, 2].map(c => (
                <rect key={c} x={4 + c * 38 - (r % 2 ? 19 : 0)} y={6 + r * 16} width={36} height={14}
                  fill={block} stroke="#57646F" strokeWidth="0.8" />
              ))}
            </g>
          ))}
          <rect x="4" y={H - 20} width={W - 8} height={6} fill="none" stroke={stud} strokeWidth="1.4" />
          <rect x="4" y={H - 12} width={W - 8} height={boardH} fill={board} stroke="#57646F" strokeWidth="0.8" />
        </>
      )}
    </svg>
  );
}

/** Jamb-profile miniatures for the frame appearance choice. */
function FrameArt({ id }) {
  const wall = "#C4CCD4", steel = "#3C4956";
  return (
    <svg viewBox="0 0 120 46" width="100%" aria-hidden="true" style={{ display: "block" }}>
      <rect x="0" y="18" width="120" height="12" fill={wall} stroke="#57646F" strokeWidth="0.8" />
      {id === "flush" && (
        <path d="M40 18 V30 M80 18 V30" stroke={steel} strokeWidth="1.6" fill="none" />
      )}
      {id === "picture" && (
        <path d="M34 16 H86 M34 16 V18 M86 16 V18" stroke={steel} strokeWidth="2.4" fill="none" />
      )}
      {id === "raised-picture" && (
        <path d="M34 13 H86 M34 13 V18 M86 13 V18" stroke={steel} strokeWidth="2.4" fill="none" />
      )}
      {id === "framesmart" && (
        <>
          <path d="M34 16 H86" stroke={steel} strokeWidth="2.4" fill="none" />
          <circle cx="48" cy="24" r="2.2" fill={steel} />
          <circle cx="72" cy="24" r="2.2" fill={steel} />
        </>
      )}
    </svg>
  );
}

function ChoiceCard({ art, label, summary, selected, disabled, disabledNote, onSelect }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onSelect}
      disabled={disabled}
      aria-pressed={selected}
      style={{
        display: "flex", gap: 14, alignItems: "center", textAlign: "left", width: "100%",
        padding: 13, fontFamily: FONT, background: disabled ? UI.sunken : UI.surface,
        border: `1px solid ${selected ? UI.accent : UI.rule}`,
        boxShadow: selected ? `inset 0 0 0 2px ${UI.accent}` : "none",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        marginBottom: 10,
      }}
    >
      <div style={{ width: 108, flexShrink: 0, background: "#F4F6F8", padding: 4, border: `1px solid ${UI.rule}` }}>
        {art}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: disabled ? UI.muted : UI.ink }}>{label}</div>
        {summary && (
          <p style={{ margin: "4px 0 0", fontSize: 12.5, lineHeight: 1.45, color: UI.body }}>{summary}</p>
        )}
        {disabled && disabledNote && (
          <p style={{ margin: "4px 0 0", fontSize: 12, lineHeight: 1.4, color: UI.warn }}>{disabledNote}</p>
        )}
      </div>
    </button>
  );
}

function WallStep({ product, config, setConfig, leaves, markTouched, errorFor }) {
  const finish = product.options.find(o => o.id === "finish");
  return (
    <div style={{ padding: "20px 22px" }}>
      <p style={{ margin: "0 0 18px", fontSize: 13.5, lineHeight: 1.6, color: UI.body, fontFamily: FONT }}>
        What is the doorset going into? The fire rating depends on the
        wall meeting the required performance.
      </p>

      {CHRISTO.walls.map(w => {
        const disabled = leaves > w.maxLeaves;
        return (
          <ChoiceCard
            key={w.id}
            art={<WallArt id={w.id} />}
            label={w.label}
            summary={w.summary}
            selected={config.wallType === w.id}
            disabled={disabled}
            disabledNote={`Approved for single and double leaf sets only — this configuration has ${leaves} leaves.`}
            onSelect={() => setConfig(c => ({ ...c, wallType: w.id }))}
          />
        );
      })}

      <RailSection title="Frame appearance" note="Riser doors are flush as standard. Choose a frame style only if the design calls for a visible architrave — the drawing follows your choice.">
        {CHRISTO.frames.map(f => (
          <ChoiceCard
            key={f.id}
            art={<FrameArt id={f.id} />}
            label={f.label}
            summary={f.summary}
            selected={config.frameStyle === f.id}
            onSelect={() => setConfig(c => ({ ...c, frameStyle: f.id }))}
          />
        ))}
      </RailSection>

      {finish && (
        <RailSection title="Finish">
          <RadioList
            name="opt-finish"
            choices={finish.choices}
            value={config.finish}
            onChange={v => { markTouched("finish"); setConfig(c => ({ ...c, finish: v })); }}
            textValue={config.finishText}
            onTextChange={v => { markTouched("finish"); setConfig(c => ({ ...c, finishText: v })); }}
          />
          <FieldError>{errorFor("finish")}</FieldError>
        </RailSection>
      )}
    </div>
  );
}

// ─── Step 4 — lock & key (visual) ─────────────────────────────────

/** Lock face miniatures: SLIK slot, euro cylinder, thumb turn. */
function LockArt({ id }) {
  const steel = "#3C4956", face = "#E8ECEF";
  const plus = id.startsWith("slik-plus");
  const thumb = id.includes("thumb");
  const euro = id.includes("euro") || plus;
  const concealed = id === "slik-concealed";
  return (
    <svg viewBox="0 0 120 62" width="100%" aria-hidden="true" style={{ display: "block" }}>
      {/* Leaf face */}
      <rect x="30" y="4" width="60" height="54" fill={face} stroke={steel} strokeWidth="1" />
      {/* SLIK — spring-loaded invisible keyhole: a discreet slot */}
      <rect x="57" y="12" width="6" height="14" rx="3" fill="none" stroke={steel} strokeWidth="1.4" />
      {concealed && <circle cx="60" cy="42" r="1.6" fill={steel} />}
      {!concealed && euro && (
        <g>
          <circle cx="60" cy="42" r="7" fill="none" stroke={steel} strokeWidth="1.4" />
          {thumb
            ? <rect x="56.5" y="40.4" width="7" height="3.2" rx="1.6" fill={steel} />
            : <path d="M60 37.5 V44 M58.6 44 H61.4 V47.5 H58.6 Z" fill={steel} stroke="none" />}
        </g>
      )}
    </svg>
  );
}

function LockStep({ config, setConfig, leaves }) {
  return (
    <div style={{ padding: "20px 22px" }}>
      <p style={{ margin: "0 0 18px", fontSize: 13.5, lineHeight: 1.6, color: UI.body, fontFamily: FONT }}>
        All options use the same tested 3-point lock with a spring-loaded
        invisible keyhole — the choice is how it appears on the door face.
      </p>

      {CHRISTO.locks.map(l => (
        <ChoiceCard
          key={l.id}
          art={<LockArt id={l.id} />}
          label={l.label}
          summary={l.summary}
          selected={config.lockType === l.id}
          onSelect={() => setConfig(c => ({ ...c, lockType: l.id }))}
        />
      ))}

      {leaves > 1 && (
        <p style={{ margin: "14px 0 0", fontSize: 12.5, lineHeight: 1.5, color: UI.muted, fontFamily: FONT }}>
          {CHRISTO.passiveLeafLockNote}
        </p>
      )}
    </div>
  );
}

// ─── Step 5 — review ──────────────────────────────────────────────

function ReviewStep({ product, config, projectData, setProjectData, specType, setSpecType, validation, onGenerate, generating, notice, markTouched, errorFor }) {
  const resolution = validation.resolution;
  const rows = specRows(product, config, resolution);

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
        <Row label="Document" value={SPEC_TYPES.find(s => s.id === specType)?.label ?? specType} />
      </Section>

      <Section title="Specification">
        {rows.map(r => <Row key={r.label} label={r.label} value={r.value} />)}
      </Section>

      <Section title="Standards">
        {CHRISTO.standards.map(s => (
          <div key={s.code} style={{ padding: "8px 0", borderBottom: `1px solid ${UI.rule}` }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: UI.ink, fontFamily: FONT }}>{s.code}</div>
            <div style={{ fontSize: 12.5, color: UI.body, fontFamily: FONT, marginTop: 2, lineHeight: 1.45 }}>{s.description}</div>
          </div>
        ))}
      </Section>

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

      <div style={{ height: 18 }} />

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

// Everything the user has typed, persisted so a refresh or an
// accidental tab close does not cost them the configuration. v2:
// the Christo restructure changed the option ids, so older saves are
// ignored rather than merged.
const STORAGE_KEY = "mf-hardware-spec-v2";

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
  const restored = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.productTypeId && getProduct(saved.productTypeId)) {
          setProductTypeId(saved.productTypeId);
          setConfig({ ...buildInitialConfig(getProduct(saved.productTypeId)), ...(saved.config ?? {}) });
        }
        if (saved.specType) setSpecType(saved.specType);
        if (saved.projectData) setProjectData(pd => ({ ...pd, ...saved.projectData }));
        if (typeof saved.furthest === "number") setFurthest(saved.furthest);
        if (typeof saved.currentStep === "number") setCurrentStep(saved.currentStep);
      }
    } catch { /* corrupt or unavailable storage is not worth breaking the tool over */ }
    restored.current = true;
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        productTypeId, config, specType, projectData, currentStep, furthest,
      }));
    } catch { /* storage full or blocked — persistence is best-effort */ }
  }, [productTypeId, config, specType, projectData, currentStep, furthest]);

  const startOver = useCallback(() => {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* best-effort */ }
    setProductTypeId("riser-doors");
    setConfig(buildInitialConfig(getProduct("riser-doors")));
    setSpecType("branded");
    setProjectData({ businessName: "", contactName: "", email: "", phone: "", projectName: "", architecturalFirm: "" });
    setCurrentStep(0);
    setFurthest(0);
    setNotice(null);
  }, []);

  const validation = validateSpec(product, config, projectData);
  const resolution = validation.resolution ?? resolveProduct(product, config);

  // The measurements decide the leaf counts — when the entered opening
  // stops approving the current count, snap to the smallest approved one.
  const allowedKey = (resolution?.allowedLeaves ?? []).join(",");
  useEffect(() => {
    const allowed = resolution?.allowedLeaves ?? [];
    if (allowed.length > 0 && !allowed.includes(config.leaves)) {
      setConfig(c => ({ ...c, leaves: allowed[0] }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedKey]);

  // A field only turns red once it has been touched.
  const [touched, setTouched] = useState(() => new Set());
  const markTouched = useCallback(field => {
    setTouched(t => (t.has(field) ? t : new Set(t).add(field)));
  }, []);
  const errorFor = useCallback(
    field => (touched.has(field) ? validation.errors.find(e => e.field === field)?.message : undefined),
    [touched, validation.errors],
  );

  const chooseProduct = useCallback(id => {
    setProductTypeId(prev => {
      if (prev !== id) setConfig(buildInitialConfig(getProduct(id)));
      return id;
    });
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

  // Each step gates on its own fields only. Finish lives on the Wall
  // step, so its error gates there.
  const specifyErrors = validation.errors.filter(e => SPECIFY_FIELDS.has(e.field));
  const finishError = validation.errors.some(e => e.field === "finish");
  const stepBlocked =
    currentStep === 1 ? specifyErrors.length > 0
    : currentStep === 2 ? (!config.wallType || resolution?.wallConflict || finishError)
    : currentStep === 3 ? !config.lockType
    : false;
  const nextLabel =
    currentStep === 0 ? `Specify ${product?.label ?? "product"}`
    : currentStep === 1 && stepBlocked ? `${specifyErrors.length} to fix`
    : currentStep === 2 && stepBlocked ? (!config.wallType ? "Choose a wall" : finishError ? "Enter the RAL number" : "Choose a wall")
    : currentStep === 3 && stepBlocked ? "Choose a lock"
    : "Next";

  // Full-bleed: the workspace owns the whole viewport below the
  // header and tab bar (60px header + 3px rule + ~49px tabs).
  const shell = {
    background: UI.surface, fontFamily: FONT, color: UI.body,
    borderTop: `1px solid ${UI.rule}`,
  };

  const footer = (
    <footer style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      padding: "14px 22px", borderTop: `1px solid ${UI.ruleStrong}`, flexShrink: 0,
    }}>
      <span style={{ display: "flex", gap: 10 }}>
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
        <button
          type="button" onClick={startOver}
          style={{
            padding: "10px 12px", fontSize: 12.5, fontWeight: 500, fontFamily: FONT,
            border: "none", background: "none", color: UI.muted, cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          Start over
        </button>
      </span>
      {currentStep < STEPS.length - 1 && (
        <button
          type="button" onClick={goNext} disabled={stepBlocked}
          style={{
            padding: "10px 26px", fontSize: 13.5, fontWeight: 600, fontFamily: FONT,
            border: `1px solid ${stepBlocked ? UI.ruleStrong : UI.accent}`,
            background: stepBlocked ? UI.sunken : UI.accent,
            color: stepBlocked ? UI.muted : "#FFFFFF",
            cursor: stepBlocked ? "not-allowed" : "pointer",
          }}
        >
          {nextLabel}
        </button>
      )}
    </footer>
  );

  // Product selection runs full width — the illustrations are the point
  // of the step, and they do not read at rail width.
  if (currentStep === 0) {
    return (
      <div style={{ ...shell, display: "flex", flexDirection: "column", minHeight: "calc(100vh - 112px)" }}>
        <StepBar currentStep={currentStep} setCurrentStep={setCurrentStep} furthest={furthest} />
        <div style={{ flex: 1 }}>
          <ProductStep productTypeId={productTypeId} onChoose={chooseProduct} />
        </div>
      </div>
    );
  }

  return (
    <div style={{
      ...shell, display: "flex", height: "calc(100vh - 112px)",
      minHeight: 640, overflow: "hidden",
    }}>
      <aside style={{
        width: 448, flexShrink: 0, display: "flex", flexDirection: "column",
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

        {currentStep === 1 && <OutstandingList errors={specifyErrors} />}

        <div ref={railRef} style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          {currentStep === 1 && product && (
            <SpecifyStep
              product={product} config={config} setConfig={setConfig}
              errorFor={errorFor} markTouched={markTouched}
              resolution={resolution}
            />
          )}
          {currentStep === 2 && product && (
            <WallStep
              product={product} config={config} setConfig={setConfig}
              leaves={config.leaves || 1}
              markTouched={markTouched} errorFor={errorFor}
            />
          )}
          {currentStep === 3 && (
            <LockStep config={config} setConfig={setConfig} leaves={config.leaves || 1} />
          )}
          {currentStep === 4 && product && (
            <ReviewStep
              product={product} config={config}
              projectData={projectData} setProjectData={setProjectData}
              specType={specType} setSpecType={setSpecType}
              validation={validation} onGenerate={handleGenerate} generating={generating} notice={notice}
              markTouched={markTouched} errorFor={errorFor}
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
