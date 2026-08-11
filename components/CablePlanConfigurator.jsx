'use client'
import { useState, useCallback, useRef, useEffect } from "react";
import DoorElevation from "./DoorElevation";
import ReviewAndGenerate from "./ReviewAndGenerate";
import {
  UI, FONT, CABLE_TYPES, resolveCable,
  flattenComponents, buildInclusionMap, buildInitialState,
  isMandatoryForSystem, getRemarksOverride, validateConfiguration,
} from "../lib/cablePlanSpec";

// ─── System definition ────────────────────────────────────────────
// Physical anchor points and cable routing for each position live in
// lib/cablePlanSpec.js (ANCHORS), keyed by component id.
const SYSTEMS = {
  "ets64r-single": {
    id: "ets64r-single", name: "ETS 64-R", leafType: "single-leaf", isFireDoor: true, systemVariant: "ETS 64-R",
    components: [
      { id: "comp-1", position: "1", label: "Voltage supply", type: "power_supply", mandatory: true, cable: { defaultCable: "NYM 3 x 1.5 mm²", allowedCables: ["NYM 3 x 1.5 mm²"], allowOther: true }, remarks: "Motor must be supplied with 230 V" },
      { id: "comp-2", position: "2", label: "24 V DC E-opener, 100% ED, protective diode", type: "e_opener", mandatory: true, cable: { defaultCable: "J-Y(ST)Y 4 x 0.6 mm²", allowedCables: ["J-Y(ST)Y 4 x 0.6 mm²", "J-Y(ST)Y 4 x 0.8 mm²"], allowOther: true }, remarks: "" },
      { id: "comp-3", position: "3", label: "Bolt switch contact", type: "bolt_switch", mandatory: true, cable: { defaultCable: "J-Y(ST)Y 4 x 0.8 mm²", allowedCables: ["J-Y(ST)Y 4 x 0.8 mm²"], allowOther: true }, remarks: "" },
      { id: "comp-4", position: "4", label: "Concealed cable connection", type: "cable_transition", mandatory: false, optional: true, cable: { defaultCable: "(integrated)", allowedCables: [], allowOther: false }, remarks: "Optional, in building" },
      { id: "comp-5", position: "5", label: "Flatscan set", type: "sensor_strip", mandatory: true, cable: { defaultCable: "Cables through ECO", allowedCables: ["Cables through ECO"], allowOther: true }, remarks: "Concealed cable laying in building, otherwise surface-mounted",
        subComponents: [
          { id: "comp-5-1", position: "5.1", label: "Sensor strips set", type: "sensor_strip", mandatory: true, cable: { defaultCable: "Cables through ECO", allowedCables: ["Cables through ECO"], allowOther: true }, remarks: "Concealed cable laying in building" }
        ]
      },
      { id: "comp-6", position: "6", label: "Flip switch (inside)", type: "flip_switch", mandatory: false, optional: true, cable: { defaultCable: "J-Y(ST)Y 4 x 0.6 mm²", allowedCables: ["J-Y(ST)Y 4 x 0.6 mm²", "J-Y(ST)Y 4 x 0.8 mm²"], allowOther: true }, remarks: "In-wall socket, cable laying in building",
        subComponents: [
          { id: "comp-6-1", position: "6.1", label: "Flip switch (outside)", type: "flip_switch", mandatory: false, optional: true, cable: { defaultCable: "J-Y(ST)Y 4 x 0.6 mm²", allowedCables: ["J-Y(ST)Y 4 x 0.6 mm²", "J-Y(ST)Y 4 x 0.8 mm²"], allowOther: true }, remarks: "In-wall socket, cable laying in building" }
        ]
      },
      { id: "comp-7", position: "7", label: "Radar sensor (inside)", type: "radar_sensor", mandatory: false, optional: true, cable: { defaultCable: "J-Y(ST)Y 4 x 0.6 mm²", allowedCables: ["J-Y(ST)Y 4 x 0.6 mm²", "J-Y(ST)Y 4 x 0.8 mm²"], allowOther: true }, remarks: "Cable laying in building (in-wall if necessary)",
        subComponents: [
          { id: "comp-7-1", position: "7.1", label: "Radar sensor (outside)", type: "radar_sensor", mandatory: false, optional: true, cable: { defaultCable: "J-Y(ST)Y 4 x 0.6 mm²", allowedCables: ["J-Y(ST)Y 4 x 0.6 mm²", "J-Y(ST)Y 4 x 0.8 mm²"], allowOther: true }, remarks: "Cable laying in building (in-wall if necessary)" }
        ]
      },
      { id: "comp-8", position: "8", label: "Bedix program selection switch", type: "program_switch", mandatory: false, optional: true, cable: { defaultCable: "J-Y(ST)Y 4 x 0.6 mm²", allowedCables: ["J-Y(ST)Y 4 x 0.6 mm²", "J-Y(ST)Y 4 x 0.8 mm²"], allowOther: true }, remarks: "In-wall socket, cable laying in building" },
      { id: "comp-9", position: "9", label: "‘Close door’ manual release button", type: "manual_release_button", mandatory: true, cable: { defaultCable: "J-Y(ST)Y 4 x 0.8 mm²", allowedCables: ["J-Y(ST)Y 4 x 0.8 mm²"], allowOther: true }, remarks: "Cable laying in building; button outside the door's pivot range",
        conditions: [{ if: { property: "isFireDoor", equals: true }, then: { mandatory: true, remarksOverride: "Mandatory per DIGt approval. Button must be outside the door's pivot range." } }]
      },
      { id: "comp-11", position: "11", label: "Ceiling smoke detector", type: "smoke_detector", mandatory: false, optional: true, cable: { defaultCable: "J-Y(ST)Y 4 x 0.8 mm²", allowedCables: ["J-Y(ST)Y 4 x 0.8 mm²"], allowOther: true }, remarks: "Cable laying in building as per approval" },
      { id: "comp-12", position: "12", label: "Lintel-mounted smoke detector", type: "smoke_detector", mandatory: false, optional: true, cable: { defaultCable: "J-Y(ST)Y 4 x 0.8 mm²", allowedCables: ["J-Y(ST)Y 4 x 0.8 mm²"], allowOther: true }, remarks: "Cable laying in building as per approval" },
    ],
  },
};

const TYPE_LABELS = {
  power_supply: "Power supply", e_opener: "Electric opener", bolt_switch: "Bolt switch",
  cable_transition: "Cable transition", sensor_strip: "Sensor", flip_switch: "Flip switch",
  radar_sensor: "Radar sensor", program_switch: "Program switch",
  manual_release_button: "Release button", smoke_detector: "Smoke detector",
};

const STEPS = ["Components", "Project", "Review"];

const fieldStyle = {
  width: "100%", boxSizing: "border-box",
  border: `1px solid ${UI.ruleStrong}`, background: UI.surface,
  padding: "10px 12px", fontSize: 13.5, lineHeight: 1.5,
  fontFamily: FONT, color: UI.ink, outline: "none",
};

const focusField = e => { e.target.style.borderColor = UI.accent; e.target.style.boxShadow = `inset 0 0 0 1px ${UI.accent}`; };
const blurField  = e => { e.target.style.borderColor = UI.ruleStrong; e.target.style.boxShadow = "none"; };

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

function CheckBox({ checked, onChange, label }) {
  return (
    <button
      type="button" role="checkbox" aria-checked={checked} aria-label={label} onClick={onChange}
      style={{
        width: 17, height: 17, flexShrink: 0, padding: 0,
        border: `1.5px solid ${checked ? UI.accent : UI.ruleStrong}`,
        background: checked ? UI.accent : UI.surface,
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {checked && (
        <svg width="10" height="8" viewBox="0 0 10 8" aria-hidden="true">
          <path d="M1 4L3.6 6.6L9 1.2" fill="none" stroke="#FFFFFF" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
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
                  <path d="M1 4L3.6 6.6L9 1.2" fill="none" stroke="#FFFFFF" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round" />
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

// ─── Component entry ──────────────────────────────────────────────

function ComponentEntry({ comp, depth, system, componentStates, inclusion, onStateChange, active, onActivate, entryRef }) {
  const state = componentStates[comp.id] ?? {};
  const mandatory = isMandatoryForSystem(comp, system);
  const override = getRemarksOverride(comp, system);
  const standardRemark = override || comp.remarks;
  const included = inclusion[comp.id];
  const selfIncluded = state.included ?? false;
  const cables = comp.cable.allowedCables;
  const fixedCable = cables.length === 0 && !comp.cable.allowOther;
  const swatch = resolveCable(state).color;

  return (
    <section
      ref={entryRef}
      onFocusCapture={onActivate}
      onMouseEnter={onActivate}
      style={{
        borderBottom: `1px solid ${UI.rule}`,
        borderLeft: `3px solid ${active ? UI.accent : "transparent"}`,
        paddingLeft: depth > 0 ? 24 : 0,
      }}
    >
      <div style={{ padding: "16px 22px 18px" }}>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          {comp.optional && !mandatory ? (
            <div style={{ paddingTop: 2 }}>
              <CheckBox
                checked={selfIncluded}
                onChange={() => onStateChange(comp.id, { included: !selfIncluded })}
                label={`Include ${comp.label}`}
              />
            </div>
          ) : (
            <span aria-hidden="true" style={{ width: 17, flexShrink: 0 }} />
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
              <span style={{ fontSize: 14.5, fontWeight: 700, color: included ? UI.accent : UI.muted, fontFamily: FONT }}>
                {comp.position}
              </span>
              <h3 style={{
                margin: 0, fontSize: 14.5, fontWeight: 600, lineHeight: 1.4,
                color: included ? UI.ink : UI.muted, fontFamily: FONT,
              }}>
                {comp.label}
              </h3>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
              <span style={{ fontSize: 12.5, color: UI.muted, fontFamily: FONT }}>
                {TYPE_LABELS[comp.type] || comp.type}
              </span>
              {mandatory && (
                <span style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                  color: UI.warn, fontFamily: FONT,
                }}>
                  Required
                </span>
              )}
            </div>
          </div>

          {included && (
            <span aria-hidden="true" style={{ width: 18, height: 3, background: swatch, marginTop: 9, flexShrink: 0 }} />
          )}
        </div>

        {included && (
          <div style={{ marginTop: 16, paddingLeft: 29 }}>

            {fixedCable ? (
              <div style={{ marginBottom: 16 }}>
                <Label>Cable</Label>
                <span style={{ fontSize: 13.5, color: UI.body, fontFamily: FONT }}>
                  {comp.cable.defaultCable}
                </span>
              </div>
            ) : (
              <div style={{ marginBottom: 16 }}>
                <Label>Cable</Label>
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {cables.map(cable => {
                    const on = state.selectedCable === cable && !state.isOther;
                    return (
                      <label key={cable} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                        <input
                          type="radio" name={`cable-${comp.id}`} checked={on}
                          onChange={() => onStateChange(comp.id, { selectedCable: cable, isOther: false })}
                          style={{ accentColor: UI.accent, width: 15, height: 15, margin: 0, flexShrink: 0 }}
                        />
                        <span aria-hidden="true" style={{ width: 18, height: 3, background: CABLE_TYPES[cable]?.color ?? UI.muted, flexShrink: 0 }} />
                        <span style={{ fontSize: 13.5, color: on ? UI.ink : UI.body, fontWeight: on ? 600 : 400, fontFamily: FONT }}>
                          {cable}
                        </span>
                      </label>
                    );
                  })}
                  {comp.cable.allowOther && (
                    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                      <input
                        type="radio" name={`cable-${comp.id}`} checked={!!state.isOther}
                        onChange={() => onStateChange(comp.id, { isOther: true, selectedCable: "" })}
                        style={{ accentColor: UI.accent, width: 15, height: 15, margin: 0, flexShrink: 0 }}
                      />
                      <span aria-hidden="true" style={{ width: 18, height: 3, background: UI.warn, flexShrink: 0 }} />
                      <span style={{ fontSize: 13.5, color: state.isOther ? UI.ink : UI.body, fontWeight: state.isOther ? 600 : 400, fontFamily: FONT }}>
                        Other cable
                      </span>
                    </label>
                  )}
                </div>
                {state.isOther && (
                  <input
                    type="text" placeholder="Cable type"
                    aria-label={`Cable type for ${comp.label}`}
                    value={state.otherValue || ""}
                    onChange={e => onStateChange(comp.id, { otherValue: e.target.value })}
                    style={{ ...fieldStyle, marginTop: 10, borderColor: state.otherValue?.trim() ? UI.ruleStrong : UI.warn }}
                    onFocus={focusField}
                    onBlur={e => { e.target.style.borderColor = e.target.value.trim() ? UI.ruleStrong : UI.warn; e.target.style.boxShadow = "none"; }}
                  />
                )}
              </div>
            )}

            {standardRemark && (
              <div style={{
                marginBottom: 16, padding: "11px 13px",
                background: UI.sunken,
                borderLeft: `3px solid ${override ? UI.warn : UI.ruleStrong}`,
                fontSize: 13, lineHeight: 1.55, fontFamily: FONT,
                color: override ? UI.warn : UI.body,
                fontWeight: override ? 500 : 400,
              }}>
                {standardRemark}
              </div>
            )}

            <div>
              <Label>Site note</Label>
              <textarea
                rows={2} placeholder="Optional"
                aria-label={`Site note for ${comp.label}`}
                value={state.userRemarks || ""}
                onChange={e => onStateChange(comp.id, { userRemarks: e.target.value })}
                style={{ ...fieldStyle, resize: "vertical" }}
                onFocus={focusField} onBlur={blurField}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Issues ───────────────────────────────────────────────────────

function IssueList({ validation }) {
  const { errors, warnings } = validation;
  const items = [...errors.map(e => ({ ...e, level: "error" })), ...warnings.map(w => ({ ...w, level: "warning" }))];
  return (
    <div style={{ padding: "12px 22px", borderBottom: `1px solid ${UI.rule}`, background: UI.sunken }}>
      {items.length === 0 ? (
        <span style={{ fontSize: 13, color: UI.body, fontFamily: FONT }}>No outstanding issues.</span>
      ) : items.map((item, i) => (
        <div key={`${item.id}-${i}`} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: i < items.length - 1 ? 7 : 0 }}>
          <span aria-hidden="true" style={{ width: 3, height: 17, marginTop: 1, background: item.level === "error" ? UI.warn : UI.ruleStrong, flexShrink: 0 }} />
          <span style={{ fontSize: 13, lineHeight: 1.5, color: UI.body, fontFamily: FONT }}>
            <strong style={{ fontWeight: 700, color: UI.ink }}>{item.position}</strong>{" "}{item.reason}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Project details ──────────────────────────────────────────────

const PROJECT_FIELDS = [
  ["constructionProject", "Construction project", false],
  ["doorNumberOrNaming", "Door number", false],
  ["installationLocation", "Installation location", false],
  ["positionNumberInSpec", "Position no. in specification", false],
  ["functionDescription", "Function description", true],
  ["miscellaneous", "Notes", true],
];

function ProjectDetails({ projectData, setProjectData }) {
  return (
    <div style={{ padding: "20px 22px" }}>
      <p style={{ margin: "0 0 22px", fontSize: 13.5, lineHeight: 1.6, color: UI.body, fontFamily: FONT }}>
        These appear in the title block of the PDF.
      </p>
      {PROJECT_FIELDS.map(([key, label, multiline]) => (
        <div key={key} style={{ marginBottom: 18 }}>
          <label htmlFor={`pd-${key}`}><Label>{label}</Label></label>
          {multiline ? (
            <textarea id={`pd-${key}`} rows={3}
              value={projectData[key]}
              onChange={e => setProjectData(p => ({ ...p, [key]: e.target.value }))}
              style={{ ...fieldStyle, resize: "vertical" }}
              onFocus={focusField} onBlur={blurField} />
          ) : (
            <input id={`pd-${key}`} type="text"
              value={projectData[key]}
              onChange={e => setProjectData(p => ({ ...p, [key]: e.target.value }))}
              style={fieldStyle}
              onFocus={focusField} onBlur={blurField} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────

export default function CablePlanConfigurator() {
  const [currentStep, setCurrentStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [selectedSystemId, setSelectedSystemId] = useState("ets64r-single");
  const [componentStates, setComponentStates] = useState(() => buildInitialState(SYSTEMS["ets64r-single"]));
  const [projectData, setProjectData] = useState({
    constructionProject: "", doorNumberOrNaming: "", installationLocation: "",
    positionNumberInSpec: "", functionDescription: "", miscellaneous: "",
  });
  const [activeId, setActiveId] = useState(null);

  const system = SYSTEMS[selectedSystemId];
  const validation = validateConfiguration(system, componentStates);
  const inclusion = buildInclusionMap(system, componentStates);
  const flat = flattenComponents(system);
  const includedCount = flat.filter(({ comp }) => inclusion[comp.id]).length;

  const entryRefs = useRef({});
  const railRef = useRef(null);

  const handleStateChange = useCallback((compId, updates) => {
    setComponentStates(prev => ({ ...prev, [compId]: { ...prev[compId], ...updates } }));
  }, []);

  const handleSelectFromDrawing = useCallback(compId => {
    setActiveId(compId);
    setCurrentStep(0);
  }, []);

  useEffect(() => {
    if (currentStep !== 0 || !activeId) return;
    const node = entryRefs.current[activeId];
    if (node) node.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeId, currentStep]);

  const goNext = () => {
    if (currentStep === 0 && !validation.isValid) return;
    const next = Math.min(currentStep + 1, STEPS.length - 1);
    setCurrentStep(next);
    setFurthest(f => Math.max(f, next));
    if (railRef.current) railRef.current.scrollTop = 0;
  };
  const goBack = () => {
    setCurrentStep(s => Math.max(s - 1, 0));
    if (railRef.current) railRef.current.scrollTop = 0;
  };

  const nextDisabled = currentStep === 0 && !validation.isValid;

  return (
    <div style={{
      display: "flex", height: "calc(100vh - 190px)", minHeight: 640,
      border: `1px solid ${UI.ruleStrong}`, background: UI.surface,
      fontFamily: FONT, color: UI.body, overflow: "hidden",
    }}>

      {/* ── Configuration rail ── */}
      <aside style={{
        width: 424, flexShrink: 0, display: "flex", flexDirection: "column",
        borderRight: `1px solid ${UI.ruleStrong}`, minHeight: 0,
      }}>

        <header style={{ padding: "18px 22px 16px", borderBottom: `1px solid ${UI.rule}`, flexShrink: 0 }}>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", color: UI.ink, lineHeight: 1.3 }}>
            {system.name}
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: UI.body }}>{system.leafType}</span>
            <span aria-hidden="true" style={{ width: 1, height: 12, background: UI.ruleStrong }} />
            <span style={{ fontSize: 13, color: UI.body }}>
              <strong style={{ color: UI.ink, fontWeight: 700 }}>{includedCount}</strong> of {flat.length} positions
            </span>
            {system.isFireDoor && (
              <>
                <span aria-hidden="true" style={{ width: 1, height: 12, background: UI.ruleStrong }} />
                <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: UI.warn }}>
                  Fire door
                </span>
              </>
            )}
          </div>
        </header>

        <StepBar currentStep={currentStep} setCurrentStep={setCurrentStep} furthest={furthest} />

        {currentStep === 0 && <IssueList validation={validation} />}

        <div ref={railRef} style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          {currentStep === 0 && flat.map(({ comp, depth }) => (
            <ComponentEntry
              key={comp.id} comp={comp} depth={depth} system={system}
              componentStates={componentStates} inclusion={inclusion}
              onStateChange={handleStateChange}
              active={activeId === comp.id}
              onActivate={() => setActiveId(comp.id)}
              entryRef={el => { entryRefs.current[comp.id] = el; }}
            />
          ))}

          {currentStep === 1 && <ProjectDetails projectData={projectData} setProjectData={setProjectData} />}

          {currentStep === 2 && (
            <ReviewAndGenerate
              system={system} componentStates={componentStates} projectData={projectData}
              validation={validation} inclusion={inclusion}
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
              type="button" onClick={goNext} disabled={nextDisabled}
              style={{
                padding: "10px 26px", fontSize: 13.5, fontWeight: 600, fontFamily: FONT,
                border: `1px solid ${nextDisabled ? UI.ruleStrong : UI.accent}`,
                background: nextDisabled ? UI.sunken : UI.accent,
                color: nextDisabled ? UI.muted : "#FFFFFF",
                cursor: nextDisabled ? "not-allowed" : "pointer",
              }}
            >
              {nextDisabled
                ? `${validation.errors.length} to fix`
                : "Next"}
            </button>
          )}
        </footer>
      </aside>

      {/* ── Drawing ── */}
      <section style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <DoorElevation
          system={system} componentStates={componentStates}
          activeId={activeId} onSelect={handleSelectFromDrawing}
        />
      </section>
    </div>
  );
}
