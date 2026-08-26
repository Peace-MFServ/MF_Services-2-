'use client'
import { useState, useCallback, useEffect, useRef } from "react";
import SteelDoorPreview from "./SteelDoorPreview";
import { UI, FONT, fieldStyle, focusField, blurField } from "../lib/theme";
import {
  STEEL, fireRatings, leafCountsFor, highPerformanceAvailable,
  resolveSteelDoor, validateSteelDoor, describeSteelDoor,
} from "../lib/steelDoor";

// ─────────────────────────────────────────────────────────────────
// Steel doorsets
// ─────────────────────────────────────────────────────────────────
// The order matters. What the doorset IS decides which frames and
// exposures exist; those decide which sizes are approved. So the
// questions run doorset → opening → project, and nothing downstream
// offers a choice the answers above it have ruled out.
// ─────────────────────────────────────────────────────────────────

const STEPS = ["Doorset", "Opening", "Project", "Review"];
const STORAGE_KEY = "mf-steel-spec-v1";

const DOORSET_FIELDS = new Set(["minutes", "leaves", "highPerformance"]);
const OPENING_FIELDS = new Set(["exposure", "frameId", "width", "height"]);

const mmDigits = v => v.replace(/\D/g, "").slice(0, 4);

const initialConfig = () => ({
  fireRated: null,        // null until asked, then true/false
  minutes: null,
  leaves: null,
  highPerformance: false,
  exposure: "",
  frameId: "",
  width: "",
  height: "",
  handing: "left",
});

// ─── Primitives ───────────────────────────────────────────────────

function Label({ children }) {
  return (
    <div style={{
      fontSize: 11.5, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase",
      color: UI.muted, fontFamily: FONT, marginBottom: 8,
    }}>
      {children}
    </div>
  );
}

function Chips({ options, value, onChange, name }) {
  return (
    <div role="radiogroup" aria-label={name} style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
      {options.map(opt => {
        const on = value === opt.value;
        return (
          <button
            key={String(opt.value)} type="button" role="radio" aria-checked={on}
            disabled={opt.disabled}
            title={opt.disabled ? opt.disabledReason : opt.title}
            onClick={opt.disabled ? undefined : () => onChange(opt.value)}
            style={{
              padding: "9px 15px", fontSize: 13.5, fontWeight: on ? 600 : 400, fontFamily: FONT,
              border: `1px solid ${on ? UI.accent : UI.ruleStrong}`,
              background: on ? UI.accent : opt.disabled ? UI.sunken : UI.surface,
              color: on ? "#FFFFFF" : opt.disabled ? UI.muted : UI.body,
              cursor: opt.disabled ? "not-allowed" : "pointer",
              opacity: opt.disabled ? 0.5 : 1,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function Section({ title, note, children }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <Label>{title}</Label>
      {note && (
        <p style={{ margin: "-3px 0 11px", fontSize: 12.5, lineHeight: 1.5, color: UI.body, fontFamily: FONT }}>
          {note}
        </p>
      )}
      {children}
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
              fontWeight: active ? 600 : 500, fontSize: 13,
            }}
          >
            <span style={{
              width: 19, height: 19, flexShrink: 0,
              border: `1.5px solid ${active || done ? UI.accent : UI.ruleStrong}`,
              background: done ? UI.accent : "transparent",
              color: done ? "#FFFFFF" : active ? UI.accent : UI.muted,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 600,
            }}>
              {done ? "✓" : i + 1}
            </span>
            {label}
          </button>
        );
      })}
    </nav>
  );
}

// ─── Steps ────────────────────────────────────────────────────────

function DoorsetStep({ config, set, errorFor, resolution }) {
  const rated = config.fireRated === true;
  const minutes = config.minutes;
  const leafOptions = minutes == null ? [] : leafCountsFor({ minutes, highPerformance: config.highPerformance });

  return (
    <div style={{ padding: "20px 22px" }}>
      <Section
        title="Fire rated"
        note="A fire rated doorset is classified for both integrity and insulation — the E and the I of its rating."
      >
        <Chips
          name="Fire rated"
          value={config.fireRated}
          onChange={v => {
            set("fireRated", v);
            set("minutes", v ? null : 0);
            if (!v) set("highPerformance", config.highPerformance);
          }}
          options={[{ value: false, label: "No" }, { value: true, label: "Yes" }]}
        />
      </Section>

      {rated && (
        <Section title="How long">
          <Chips
            name="Fire rating"
            value={minutes}
            onChange={v => set("minutes", v)}
            options={fireRatings().filter(m => m > 0).map(m => ({ value: m, label: `${m} minutes` }))}
          />
        </Section>
      )}

      {minutes != null && (
        <>
          <Section title="Leaves">
            <Chips
              name="Leaves"
              value={config.leaves}
              onChange={v => set("leaves", v)}
              options={[1, 2].map(n => ({
                value: n,
                label: n === 1 ? "Single" : "Double",
                disabled: !leafOptions.includes(n),
                disabledReason: config.highPerformance
                  ? "Not made as High Performance at this rating"
                  : "Not made at this fire rating",
              }))}
            />
            <FieldError>{errorFor("leaves")}</FieldError>
          </Section>

          {config.leaves && (
            <Section
              title="Performance"
              note="High Performance is a 65 mm leaf with a high-density mineral wool core, and upgraded mechanical and corrosion resistance to C5 Marine."
            >
              <Chips
                name="Performance"
                value={config.highPerformance}
                onChange={v => set("highPerformance", v)}
                options={[
                  { value: false, label: "Standard" },
                  {
                    value: true, label: "High Performance",
                    disabled: !highPerformanceAvailable({ minutes, leaves: config.leaves }),
                    disabledReason: "Not made above 60 minutes",
                  },
                ]}
              />
            </Section>
          )}
        </>
      )}

      {resolution?.type && (
        <div style={{
          marginTop: 4, padding: "13px 15px", background: UI.sunken,
          borderLeft: `3px solid ${UI.accent}`, fontFamily: FONT,
        }}>
          <div style={{
            fontSize: 11.5, fontWeight: 600, letterSpacing: "0.07em",
            textTransform: "uppercase", color: UI.muted, marginBottom: 4,
          }}>
            This doorset
          </div>
          <div style={{ fontSize: 13.5, color: UI.ink, lineHeight: 1.5 }}>
            {describeSteelDoor(resolution.type)}
          </div>
        </div>
      )}
    </div>
  );
}

function OpeningStep({ config, set, errorFor, resolution }) {
  const { frames, exposures, limits, clear } = resolution;

  return (
    <div style={{ padding: "20px 22px" }}>
      <Section title="Where it goes" note="Approved sizes differ inside and out.">
        <Chips
          name="Exposure"
          value={config.exposure}
          onChange={v => set("exposure", v)}
          options={[
            { value: "INT", label: "Internal", disabled: !exposures.some(e => e.id === "INT") },
            {
              value: "EXT", label: "External",
              disabled: !exposures.some(e => e.id === "EXT"),
              disabledReason: "This doorset is approved for internal use only",
            },
          ]}
        />
        <FieldError>{errorFor("exposure")}</FieldError>
      </Section>

      <Section title="Frame" note="The frame decides how much of the structural opening is left clear.">
        <Chips
          name="Frame"
          value={config.frameId}
          onChange={v => set("frameId", v)}
          options={frames.map(f => ({ value: f.id, label: f.label }))}
        />
        <FieldError>{errorFor("frameId")}</FieldError>
      </Section>

      <Section
        title="Structural opening"
        note={limits
          ? `Approved from ${limits.minWidth} × ${limits.minHeight} mm to ${limits.maxWidth} × ${limits.maxHeight} mm.`
          : "Choose where it goes and a frame to see the approved range."}
      >
        <div style={{ display: "flex", gap: 14 }}>
          <div style={{ flex: "0 0 140px" }}>
            <Label>Width (mm)</Label>
            <input
              id="steel-width" type="text" inputMode="numeric" value={config.width}
              onChange={e => set("width", mmDigits(e.target.value))}
              style={{ ...fieldStyle, borderColor: errorFor("width") ? UI.warn : UI.ruleStrong }}
              onFocus={focusField} onBlur={blurField}
            />
          </div>
          <div style={{ flex: "0 0 140px" }}>
            <Label>Height (mm)</Label>
            <input
              id="steel-height" type="text" inputMode="numeric" value={config.height}
              onChange={e => set("height", mmDigits(e.target.value))}
              style={{ ...fieldStyle, borderColor: errorFor("height") ? UI.warn : UI.ruleStrong }}
              onFocus={focusField} onBlur={blurField}
            />
          </div>
        </div>
        <FieldError>{errorFor("width") || errorFor("height")}</FieldError>
      </Section>

      <Section title="Handing" note="Viewed from the access side. On a pair this is the active leaf.">
        <Chips
          name="Handing" value={config.handing} onChange={v => set("handing", v)}
          options={[{ value: "left", label: "Left hand" }, { value: "right", label: "Right hand" }]}
        />
      </Section>

      {clear && (
        <div style={{
          padding: "13px 15px", background: UI.sunken,
          borderLeft: `3px solid ${UI.accent}`, fontFamily: FONT,
        }}>
          <div style={{
            fontSize: 11.5, fontWeight: 600, letterSpacing: "0.07em",
            textTransform: "uppercase", color: UI.muted, marginBottom: 2,
          }}>
            This opening works out to
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 5 }}>
            <span style={{ fontSize: 13, color: UI.body }}>Clear opening</span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: UI.ink }}>
              {clear.width} × {clear.height} mm
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────

export default function SteelDoorSpec({ onChangeProduct, modeSwitch }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [config, setConfig] = useState(initialConfig);
  const [touched, setTouched] = useState(() => new Set());
  const [hydrated, setHydrated] = useState(false);
  const railRef = useRef(null);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.config) setConfig(c => ({ ...c, ...saved.config }));
        if (typeof saved.currentStep === "number") setCurrentStep(saved.currentStep);
        if (typeof saved.furthest === "number") setFurthest(saved.furthest);
      }
    } catch { /* corrupt or unavailable storage is not worth breaking the tool over */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ config, currentStep, furthest }));
    } catch { /* best-effort */ }
  }, [hydrated, config, currentStep, furthest]);

  const set = useCallback((key, value) => {
    setTouched(t => (t.has(key) ? t : new Set(t).add(key)));
    setConfig(c => ({ ...c, [key]: value }));
  }, []);

  const resolution = resolveSteelDoor(config);
  const validation = validateSteelDoor(config);

  // A change further up can invalidate what was chosen below it — drop
  // anything the new answers no longer offer, rather than carrying a
  // frame or exposure that does not exist for this doorset.
  const frameIds = resolution.frames.map(f => f.id).join(",");
  const exposureIds = resolution.exposures.map(e => e.id).join(",");
  useEffect(() => {
    if (config.frameId && frameIds && !frameIds.split(",").includes(config.frameId)) {
      setConfig(c => ({ ...c, frameId: "" }));
    }
    if (config.exposure && exposureIds && !exposureIds.split(",").includes(config.exposure)) {
      setConfig(c => ({ ...c, exposure: "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameIds, exposureIds]);

  // Where only one answer exists, give it rather than asking. An
  // internal-only doorset should say "Internal", not wait to be told.
  useEffect(() => {
    if (!config.exposure && resolution.exposures.length === 1) {
      setConfig(c => ({ ...c, exposure: resolution.exposures[0].id }));
    }
    if (!config.frameId && resolution.frames.length === 1) {
      setConfig(c => ({ ...c, frameId: resolution.frames[0].id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exposureIds, frameIds, config.exposure, config.frameId]);

  // High Performance above 60 minutes does not exist; step back down
  // rather than leaving an impossible doorset selected.
  useEffect(() => {
    if (config.highPerformance && config.minutes != null && config.leaves
        && !highPerformanceAvailable({ minutes: config.minutes, leaves: config.leaves })) {
      setConfig(c => ({ ...c, highPerformance: false }));
    }
  }, [config.minutes, config.leaves, config.highPerformance]);

  const errorFor = useCallback(field => {
    if (!touched.has(field)) return null;
    return validation.errors.find(e => e.field === field)?.message ?? null;
  }, [touched, validation]);

  const stepErrors = fields => validation.errors.filter(e => fields.has(e.field));
  const doorsetErrors = stepErrors(DOORSET_FIELDS);
  const openingErrors = stepErrors(OPENING_FIELDS);

  const stepBlocked =
    currentStep === 0 ? !resolution.type
    : currentStep === 1 ? openingErrors.length > 0
    : false;

  const goNext = () => {
    const next = Math.min(currentStep + 1, STEPS.length - 1);
    setCurrentStep(next);
    setFurthest(f => Math.max(f, next));
    if (railRef.current) railRef.current.scrollTop = 0;
  };
  const goBack = () => {
    if (currentStep === 0 && onChangeProduct) { onChangeProduct(); return; }
    setCurrentStep(s => Math.max(s - 1, 0));
    if (railRef.current) railRef.current.scrollTop = 0;
  };
  const startOver = () => {
    setConfig(initialConfig());
    setTouched(new Set());
    setCurrentStep(0);
    setFurthest(0);
    try { window.sessionStorage.removeItem(STORAGE_KEY); } catch { /* best-effort */ }
  };

  const nextLabel =
    currentStep === 0 ? (resolution.type ? "Next" : "Choose a doorset")
    : currentStep === 1 && stepBlocked ? `${openingErrors.length} to fix`
    : "Next";

  return (
    <div style={{
      display: "flex", height: "calc(100vh - 136px)", minHeight: 640,
      borderTop: `1px solid ${UI.rule}`, background: UI.surface,
      fontFamily: FONT, color: UI.body, overflow: "hidden",
    }}>
      <aside style={{
        width: 448, flexShrink: 0, display: "flex", flexDirection: "column",
        borderRight: `1px solid ${UI.ruleStrong}`, minHeight: 0,
      }}>
        <header style={{ padding: "18px 22px 16px", borderBottom: `1px solid ${UI.rule}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", color: UI.ink }}>
              Steel Doors
            </h1>
            {modeSwitch}
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: UI.body, lineHeight: 1.5 }}>
            {resolution.type ? describeSteelDoor(resolution.type) : "Fire rated or not, single or double."}
          </p>
        </header>

        <StepBar currentStep={currentStep} setCurrentStep={setCurrentStep} furthest={furthest} />

        <div ref={railRef} style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          {currentStep === 0 && (
            <DoorsetStep config={config} set={set} errorFor={errorFor} resolution={resolution} />
          )}
          {currentStep === 1 && (
            <OpeningStep config={config} set={set} errorFor={errorFor} resolution={resolution} />
          )}
          {currentStep >= 2 && (
            <div style={{ padding: "20px 22px" }}>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: UI.body }}>
                Project details and the specification sheet come next — that is the
                stage I am building now.
              </p>
            </div>
          )}
        </div>

        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          padding: "14px 22px", borderTop: `1px solid ${UI.ruleStrong}`, flexShrink: 0,
        }}>
          <button
            type="button" onClick={goBack}
            style={{
              padding: "11px 20px", border: `1px solid ${UI.ruleStrong}`, background: UI.surface,
              fontSize: 13.5, fontFamily: FONT, color: UI.ink, cursor: "pointer",
            }}
          >
            Back
          </button>
          <button
            type="button" onClick={startOver}
            style={{
              background: "none", border: "none", padding: 0, fontFamily: FONT,
              fontSize: 13, color: UI.accent, textDecoration: "underline", cursor: "pointer",
            }}
          >
            Start over
          </button>
          {currentStep < STEPS.length - 1 && (
            <button
              type="button" onClick={goNext} disabled={stepBlocked}
              style={{
                padding: "11px 22px",
                border: `1px solid ${stepBlocked ? UI.ruleStrong : UI.accent}`,
                background: stepBlocked ? UI.sunken : UI.accent,
                color: stepBlocked ? UI.muted : "#FFFFFF",
                fontSize: 13.5, fontWeight: 600, fontFamily: FONT,
                cursor: stepBlocked ? "not-allowed" : "pointer",
              }}
            >
              {nextLabel}
            </button>
          )}
        </div>
      </aside>

      <section style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <SteelDoorPreview resolution={resolution} config={config} />
      </section>
    </div>
  );
}
