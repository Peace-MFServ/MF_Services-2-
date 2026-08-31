'use client'
import { useRef } from "react";
import SteelDoorPreview from "./SteelDoorPreview";
import BackArrow from "./BackArrow";
import { useSteelSpecState, mmDigits } from "./steelSpecState";
import { UI, FONT, fieldStyle, cardStyle } from "../lib/theme";
import { QS, ICONS, StepTabs } from "./quickSpecUI";
import {
  fireRatings, leafCountsFor, highPerformanceAvailable,
  describeSteelDoor, steelSpecRows, standardsFor, hardwareNeedsText,
} from "../lib/steelDoor";
import { SPEC_TYPES, REQUIRE_ENQUIRY_DETAILS } from "../lib/hardwareSpec";

// ─────────────────────────────────────────────────────────────────
// Steel doorsets
// ─────────────────────────────────────────────────────────────────
// The order matters. What the doorset IS decides which frames and
// exposures exist; those decide which sizes are approved. So the
// questions run doorset → opening → project, and nothing downstream
// offers a choice the answers above it have ruled out.
// ─────────────────────────────────────────────────────────────────

const STEPS = ["Doorset", "Opening", "Hardware", "Project", "Review"];
const STEP_ICONS = ["door", "opening", "hardware", "project", "sheet"];

const OPENING_FIELDS = new Set(["exposure", "frameId", "width", "height"]);
const PROJECT_FIELDS = new Set(["email", "phone"]);

// The ironmongery reads better in trades than in one long list. Any
// group the doorset does not ask simply does not appear.
const HARDWARE_SECTIONS = [
  { title: "Locking", ids: ["lock", "cylinder", "handleActiveInside", "handleActiveOutside", "handlePassiveOutside", "flushBolt", "electricStrike"] },
  { title: "Hanging and closing", ids: ["smokeProtection", "hinge", "hingeCount", "doorCloser", "doorStopper", "magnetContact"] },
  { title: "Openings in the leaf", ids: ["glazing", "ventilationGrill"] },
  { title: "Sealing and thresholds", ids: ["dropSeal", "threshold", "dripCap"] },
];

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
              padding: "9px 15px", fontSize: 13.5, fontWeight: on ? 600 : 500, fontFamily: FONT,
              border: `1px solid ${on ? UI.accent : UI.ruleStrong}`,
              background: on ? UI.accent : opt.disabled ? UI.sunken : UI.surface,
              color: on ? "#FFFFFF" : opt.disabled ? UI.muted : UI.ink,
              cursor: opt.disabled ? "not-allowed" : "pointer",
              opacity: opt.disabled ? 0.5 : 1,
            }}
          >
            {opt.label}
            {opt.disabled && opt.disabledReason ? <span className="vh"> — {opt.disabledReason}</span> : null}
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
    <StepTabs
      steps={STEPS.map((label, i) => ({ label, icon: ICONS[STEP_ICONS[i]] }))}
      current={currentStep} furthest={furthest} onSelect={setCurrentStep}
    />
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
              style={{ ...fieldStyle, borderColor: errorFor("width") ? UI.warn : UI.ruleStrong }} className="mf-field"
            />
          </div>
          <div style={{ flex: "0 0 140px" }}>
            <Label>Height (mm)</Label>
            <input
              id="steel-height" type="text" inputMode="numeric" value={config.height}
              onChange={e => set("height", mmDigits(e.target.value))}
              style={{ ...fieldStyle, borderColor: errorFor("height") ? UI.warn : UI.ruleStrong }} className="mf-field"
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

function TextField({ id, label, required, value, onChange, onBlurTouch, error, type = "text" }) {
  const border = error ? UI.warn : UI.ruleStrong;
  return (
    <div style={{ marginBottom: 18 }}>
      <label htmlFor={id} style={{
        display: "block", fontSize: 11.5, fontWeight: 600, letterSpacing: "0.07em",
        textTransform: "uppercase", color: UI.muted, fontFamily: FONT, marginBottom: 8,
      }}>
        {label}{required && <span style={{ color: UI.warn }}> *</span>}
      </label>
      <input
        id={id} type={type} value={value || ""}
        onChange={e => onChange(e.target.value)}
        style={{ ...fieldStyle, borderColor: border }}
        className="mf-field"
        onBlur={() => onBlurTouch?.()}
      />
      <FieldError>{error}</FieldError>
    </div>
  );
}

/** One hardware question: the manufacturer's own list, plus a place to
 *  write it down when the answer is "other". */
function HardwareField({ group, value, text, onChange, onChangeText, error }) {
  const blocked = group.options.length === 0;
  return (
    <div style={{ marginBottom: 16 }}>
      <label htmlFor={`hw-${group.id}`} style={{
        display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
        textTransform: "uppercase", color: UI.muted, fontFamily: FONT, marginBottom: 6,
      }}>
        {group.label}
      </label>
      <select className="mf-field"
        id={`hw-${group.id}`} value={blocked ? "" : value || ""} disabled={blocked}
        onChange={e => onChange(e.target.value)}
        style={{
          ...fieldStyle, padding: "9px 10px", fontSize: 13,
          borderColor: error ? UI.warn : UI.ruleStrong,
          background: blocked ? UI.sunken : UI.surface,
          color: blocked ? UI.muted : UI.ink,
          cursor: blocked ? "not-allowed" : "pointer",
        }}
      >
        {blocked && <option value="">{group.blocked ?? "Not available yet"}</option>}
        {group.options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
      {hardwareNeedsText(value) && (
        <input
          id={`hw-${group.id}-text`} value={text || ""}
          placeholder={`Describe the ${group.label.toLowerCase()} required`}
          onChange={e => onChangeText(e.target.value)}
          style={{ ...fieldStyle, marginTop: 8, padding: "9px 10px", fontSize: 13 }} className="mf-field"
        />
      )}
      {group.note && (
        <p style={{ margin: "6px 0 0", fontSize: 12, lineHeight: 1.45, color: UI.muted, fontFamily: FONT }}>
          {group.note}
        </p>
      )}
      <FieldError>{error}</FieldError>
    </div>
  );
}

/** Everything that gets fitted to the doorset. What is on offer comes
 *  from the doorset itself and, for most of it, from the lock. */
function HardwareStep({ config, set, hardware, errorFor }) {
  const byId = Object.fromEntries(hardware.map(g => [g.id, g]));
  return (
    <div style={{ padding: "20px 22px" }}>
      <p style={{ margin: "0 0 20px", fontSize: 13, lineHeight: 1.55, color: UI.body, fontFamily: FONT }}>
        Nothing is fitted unless you ask for it, apart from the lock,
        cylinder and hinges every doorset needs.
      </p>
      {HARDWARE_SECTIONS.map(section => {
        const groups = section.ids.map(id => byId[id]).filter(Boolean);
        if (!groups.length) return null;
        return (
          <div key={section.title} style={{ marginBottom: 26 }}>
            <Label>{section.title}</Label>
            {groups.map(g => (
              <HardwareField
                key={g.id} group={g}
                value={config[g.id]} text={config[`${g.id}Text`]}
                onChange={v => set(g.id, v)}
                onChangeText={v => set(`${g.id}Text`, v)}
                error={errorFor(g.id)}
              />
            ))}
          </div>
        );
      })}

      <div style={{ marginBottom: 8 }}>
        <Label>Finish</Label>
        <TextField
          id="steel-ral" label="Colour (RAL)"
          value={config.ral}
          onChange={v => set("ral", v)}
        />
      </div>
    </div>
  );
}

/** Who the specification is for and which project it belongs to —
 *  its own step, the same as on the riser doors and the cable plan. */
function ProjectStep({ projectData, setProjectData, specType, setSpecType, markTouched, errorFor, config, setQuantity }) {
  return (
    <div style={{ padding: "20px 22px" }}>
      <Section title="Specification type & quantity" note={SPEC_TYPES.find(sp => sp.id === specType)?.summary}>
        <div style={{ display: "flex", gap: 18, alignItems: "flex-end", flexWrap: "wrap" }}>
          <Chips
            name="Specification type"
            value={specType}
            onChange={setSpecType}
            options={SPEC_TYPES.map(sp => ({ value: sp.id, label: sp.label }))}
          />
          <div style={{ flex: "0 0 190px" }}>
            <label htmlFor="steel-quantity" style={{
              display: "block", fontSize: 11.5, fontWeight: 600, letterSpacing: "0.07em",
              textTransform: "uppercase", color: UI.muted, fontFamily: FONT,
              marginBottom: 8, whiteSpace: "nowrap",
            }}>
              Quantity of doorsets
            </label>
            <input
              id="steel-quantity" type="text" inputMode="numeric" value={config.quantity}
              onChange={e => setQuantity(e.target.value.replace(/\D/g, "").slice(0, 3))}
              style={{ ...fieldStyle, width: 80, height: 35, padding: "0 12px", textAlign: "center" }} className="mf-field"
            />
          </div>
        </div>
      </Section>

      <Section
        title="Your details"
        note={REQUIRE_ENQUIRY_DETAILS
          ? "So we can send the specification on and answer any questions."
          : "Optional for now. So we can answer any questions."}
      >
        <div style={{ display: "flex", gap: 14 }}>
          <div style={{ flex: 1 }}>
            <TextField
              id="steel-email" label="Email" type="email" required={REQUIRE_ENQUIRY_DETAILS}
              value={projectData.email}
              onChange={v => setProjectData(pd => ({ ...pd, email: v }))}
              onBlurTouch={() => markTouched("email")}
              error={errorFor("email")}
            />
          </div>
          <div style={{ flex: 1 }}>
            <TextField
              id="steel-phone" label="Phone" type="tel" required={REQUIRE_ENQUIRY_DETAILS}
              value={projectData.phone}
              onChange={v => setProjectData(pd => ({ ...pd, phone: v }))}
              onBlurTouch={() => markTouched("phone")}
              error={errorFor("phone")}
            />
          </div>
        </div>
      </Section>

      <Section title="Project">
        <div style={{ display: "flex", gap: 14 }}>
          <div style={{ flex: 1 }}>
            <TextField
              id="steel-projectName" label="Project name"
              value={projectData.projectName}
              onChange={v => setProjectData(pd => ({ ...pd, projectName: v }))}
            />
          </div>
          <div style={{ flex: 1 }}>
            <TextField
              id="steel-architecturalFirm" label="Architectural firm"
              value={projectData.architecturalFirm}
              onChange={v => setProjectData(pd => ({ ...pd, architecturalFirm: v }))}
            />
          </div>
        </div>
      </Section>
    </div>
  );
}

function ReviewHeading({ children }) {
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

function ReviewRow({ label, value }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 14,
      padding: "9px 0", borderBottom: `1px solid ${UI.rule}`,
    }}>
      <span style={{ fontSize: 13.5, color: UI.body, fontFamily: FONT }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: UI.ink, fontFamily: FONT, textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}

function ReviewStep({ config, resolution, specType, validation, onGenerate, generating, notice }) {
  const rows = steelSpecRows(config, resolution);
  const standards = standardsFor(resolution.type, resolution.exposure);

  return (
    <div style={{ padding: "20px 22px" }}>
      <div style={{ marginBottom: 26 }}>
        <ReviewHeading>Doorset</ReviewHeading>
        <ReviewRow label="Type" value="Steel Doors" />
        <ReviewRow label="Document" value={SPEC_TYPES.find(sp => sp.id === specType)?.label ?? specType} />
      </div>

      <div style={{ marginBottom: 26 }}>
        <ReviewHeading>Specification</ReviewHeading>
        {rows.map(r => <ReviewRow key={r.label} label={r.label} value={r.value} />)}
      </div>

      {standards.length > 0 && (
        <div style={{ marginBottom: 26 }}>
          <ReviewHeading>Standards</ReviewHeading>
          {standards.map(st => (
            <div key={st.code} style={{ padding: "8px 0", borderBottom: `1px solid ${UI.rule}` }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: UI.ink, fontFamily: FONT }}>{st.code}</div>
              <div style={{ fontSize: 12.5, color: UI.body, fontFamily: FONT, marginTop: 2, lineHeight: 1.45 }}>
                {st.description}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button" onClick={onGenerate} disabled={generating || !validation.isValid}
        className="qs-download"
        style={{
          width: "100%", height: 46, padding: "0 20px",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          border: `1px solid ${validation.isValid ? UI.accent : UI.ruleStrong}`,
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
        <p style={{
          margin: "12px 0 0", fontSize: 13, lineHeight: 1.5, textAlign: "center",
          fontFamily: FONT, color: notice.error ? UI.warn : UI.body,
        }}>
          {notice.text}
        </p>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────

export default function SteelDoorSpec({ onChangeProduct, modeSwitch, saveButton }) {
  const {
    config, set, specType, setSpecType, projectData, setProjectData,
    currentStep, setCurrentStep, furthest, setFurthest,
    markTouched, errorFor, resolution, validation, hardware,
    generating, notice, startOver, generate,
  } = useSteelSpecState();
  const railRef = useRef(null);

  const stepErrors = fields => validation.errors.filter(e => fields.has(e.field));
  const openingErrors = stepErrors(OPENING_FIELDS);
  const hardwareErrors = stepErrors(new Set(hardware.map(g => g.id)));
  const projectErrors = stepErrors(PROJECT_FIELDS);

  const stepBlocked =
    currentStep === 0 ? !resolution.type
    : currentStep === 1 ? openingErrors.length > 0
    : currentStep === 2 ? hardwareErrors.length > 0
    : currentStep === 3 ? projectErrors.length > 0
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

  const blockedCount =
    currentStep === 1 ? openingErrors.length
    : currentStep === 2 ? hardwareErrors.length
    : currentStep === 3 ? projectErrors.length
    : 0;

  const nextLabel =
    currentStep === 0 ? (resolution.type ? "Next" : "Choose a doorset")
    : stepBlocked ? `${blockedCount} to fix`
    : "Next";

  return (
    <div className="mf-rounded" style={{
      display: "flex", gap: 20, height: "calc(100vh - 136px)", minHeight: 640,
      borderTop: `1px solid ${UI.rule}`, background: QS.bg, padding: "20px 24px",
      fontFamily: FONT, color: UI.body, overflow: "hidden",
    }}>
      <aside style={{
        ...cardStyle, padding: 0,
        width: 496, flexShrink: 0, display: "flex", flexDirection: "column",
        minHeight: 0, overflow: "hidden",
      }}>
        <header style={{ padding: "18px 22px 16px", borderBottom: `1px solid ${UI.rule}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <BackArrow onClick={goBack} />
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", color: UI.ink }}>
                Steel Doors
              </h2>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              {modeSwitch}
              {saveButton}
            </div>
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
          {currentStep === 2 && (
            <HardwareStep config={config} set={set} hardware={hardware} errorFor={errorFor} />
          )}
          {currentStep === 3 && (
            <ProjectStep
              projectData={projectData} setProjectData={setProjectData}
              specType={specType} setSpecType={setSpecType}
              markTouched={markTouched} errorFor={errorFor}
              config={config} setQuantity={v => set("quantity", v)}
            />
          )}
          {currentStep === 4 && (
            <ReviewStep
              config={config} resolution={resolution} specType={specType}
              validation={validation} onGenerate={generate}
              generating={generating} notice={notice}
            />
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

      <section style={{ ...cardStyle, padding: 0, flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <SteelDoorPreview resolution={resolution} config={config} />
      </section>
    </div>
  );
}
