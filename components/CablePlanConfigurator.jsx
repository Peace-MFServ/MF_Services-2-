'use client'
import { useState, useCallback, useRef, useEffect } from "react";
import DoorElevation from "./DoorElevation";
import ReviewAndGenerate from "./ReviewAndGenerate";
import {
  FONT_SANS, FONT_MONO, CABLE_TYPES, resolveCable,
  flattenComponents, buildInclusionMap, buildInitialState,
  isMandatoryForSystem, getRemarksOverride, validateConfiguration,
} from "../lib/cablePlanSpec";

// ─── Surface palette ──────────────────────────────────────────────
const T = {
  navy:    "#00387B",
  orange:  "#ED6E02",
  red:     "#A6382F",
  ink:     "#1B2430",
  body:    "#3D4753",
  muted:   "#6B7686",
  faint:   "#98A2AE",
  hair:    "#DDE2E8",
  hairSoft:"#EBEEF2",
  surface: "#FFFFFF",
  sunken:  "#F7F9FA",
  canvas:  "#F1F4F6",
};

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

const STEPS = ["Components", "Project", "Release"];

// ─── Primitives ───────────────────────────────────────────────────

function FieldLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase",
      color: T.faint, fontFamily: FONT_SANS, marginBottom: 7,
    }}>
      {children}
    </div>
  );
}

/** Square check control — matches the reference tool's affordance. */
function CheckBox({ checked, disabled, onChange, label }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={disabled ? undefined : onChange}
      style={{
        width: 15, height: 15, flexShrink: 0, padding: 0,
        border: `1.5px solid ${disabled ? T.hair : checked ? T.orange : T.muted}`,
        background: checked ? T.orange : T.surface,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background 120ms, border-color 120ms",
      }}
    >
      {checked && (
        <svg width="9" height="7" viewBox="0 0 9 7" aria-hidden="true">
          <path d="M1 3.6L3.3 5.9L8 1.2" fill="none" stroke="#FFFFFF" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

function StepBar({ currentStep, setCurrentStep, furthest }) {
  return (
    <nav aria-label="Progress" style={{ display: "flex", borderBottom: `1px solid ${T.hair}`, background: T.surface, flexShrink: 0 }}>
      {STEPS.map((label, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        const reachable = i <= furthest;
        return (
          <button
            key={label}
            type="button"
            onClick={reachable ? () => setCurrentStep(i) : undefined}
            aria-current={active ? "step" : undefined}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              padding: "13px 8px", background: "none", border: "none",
              borderBottom: `2px solid ${active ? T.navy : "transparent"}`,
              marginBottom: -1,
              cursor: reachable ? "pointer" : "default",
              fontFamily: FONT_SANS,
              color: active ? T.ink : reachable ? T.muted : T.faint,
              fontWeight: active ? 650 : 500,
              fontSize: 12.5,
            }}
          >
            <span style={{
              width: 18, height: 18, flexShrink: 0,
              border: `1.5px solid ${active ? T.navy : done ? T.navy : T.hair}`,
              background: done ? T.navy : "transparent",
              color: done ? "#FFFFFF" : active ? T.navy : T.faint,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700, fontFamily: FONT_MONO,
            }}>
              {done ? (
                <svg width="9" height="7" viewBox="0 0 9 7" aria-hidden="true">
                  <path d="M1 3.6L3.3 5.9L8 1.2" fill="none" stroke="#FFFFFF" strokeWidth="1.8"
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
        borderBottom: `1px solid ${T.hairSoft}`,
        borderLeft: `2px solid ${active ? T.navy : "transparent"}`,
        background: active ? "#FBFCFD" : T.surface,
        paddingLeft: depth > 0 ? 22 : 0,
        transition: "background 120ms, border-color 120ms",
      }}
    >
      <div style={{ padding: "14px 20px 16px" }}>

        {/* Heading row */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          {comp.optional && !mandatory ? (
            <div style={{ paddingTop: 2 }}>
              <CheckBox
                checked={selfIncluded}
                onChange={() => onStateChange(comp.id, { included: !selfIncluded })}
                label={`Include ${comp.label}`}
              />
            </div>
          ) : (
            // Mandatory positions have no control — an empty gutter, so
            // the headings still align but nothing reads as "unchecked".
            <span aria-hidden="true" style={{ width: 15, flexShrink: 0 }} />
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 12.5, fontWeight: 700, color: included ? T.navy : T.faint }}>
                {comp.position}
              </span>
              <h3 style={{
                margin: 0, fontSize: 13.5, fontWeight: 600, lineHeight: 1.35,
                color: included ? T.ink : T.faint, fontFamily: FONT_SANS,
              }}>
                {comp.label}
              </h3>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
              <span style={{ fontSize: 11, color: T.faint, fontFamily: FONT_SANS }}>
                {TYPE_LABELS[comp.type] || comp.type}
              </span>
              {mandatory && (
                <span style={{
                  fontSize: 9.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase",
                  color: T.orange, fontFamily: FONT_SANS,
                }}>
                  Required
                </span>
              )}
            </div>
          </div>

          {included && (
            <span aria-hidden="true" style={{ width: 14, height: 3, background: swatch, marginTop: 8, flexShrink: 0 }} />
          )}
        </div>

        {included && (
          <div style={{ marginTop: 14, paddingLeft: 25 }}>

            {/* Cable */}
            {fixedCable ? (
              <div style={{ marginBottom: 14 }}>
                <FieldLabel>Cable</FieldLabel>
                <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: T.muted }}>
                  {comp.cable.defaultCable}
                </span>
              </div>
            ) : (
              <div style={{ marginBottom: 14 }}>
                <FieldLabel>Cable</FieldLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {cables.map(cable => {
                    const on = state.selectedCable === cable && !state.isOther;
                    return (
                      <label key={cable} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                        <input
                          type="radio"
                          name={`cable-${comp.id}`}
                          checked={on}
                          onChange={() => onStateChange(comp.id, { selectedCable: cable, isOther: false })}
                          style={{ accentColor: T.navy, width: 13, height: 13, margin: 0, flexShrink: 0 }}
                        />
                        <span aria-hidden="true" style={{ width: 14, height: 3, background: CABLE_TYPES[cable]?.color ?? T.faint, flexShrink: 0 }} />
                        <span style={{ fontFamily: FONT_MONO, fontSize: 12, color: on ? T.ink : T.body }}>{cable}</span>
                      </label>
                    );
                  })}
                  {comp.cable.allowOther && (
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                      <input
                        type="radio"
                        name={`cable-${comp.id}`}
                        checked={!!state.isOther}
                        onChange={() => onStateChange(comp.id, { isOther: true, selectedCable: "" })}
                        style={{ accentColor: T.orange, width: 13, height: 13, margin: 0, flexShrink: 0 }}
                      />
                      <span aria-hidden="true" style={{ width: 14, height: 3, background: T.orange, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: state.isOther ? T.ink : T.body, fontFamily: FONT_SANS }}>Other cable</span>
                    </label>
                  )}
                </div>
                {state.isOther && (
                  <input
                    type="text"
                    placeholder="Specify cable type"
                    aria-label={`Cable type for ${comp.label}`}
                    value={state.otherValue || ""}
                    onChange={e => onStateChange(comp.id, { otherValue: e.target.value })}
                    style={{
                      marginTop: 8, width: "100%", boxSizing: "border-box",
                      border: `1px solid ${state.otherValue?.trim() ? T.hair : T.orange}`,
                      background: T.surface, padding: "8px 10px",
                      fontSize: 12, fontFamily: FONT_MONO, color: T.ink, outline: "none",
                    }}
                  />
                )}
              </div>
            )}

            {/* Standard remark — specification text, not editable */}
            {standardRemark && (
              <div style={{
                marginBottom: 14, padding: "9px 11px",
                background: override ? "#FDF6EF" : T.sunken,
                borderLeft: `2px solid ${override ? T.orange : T.hair}`,
                fontSize: 11.5, lineHeight: 1.5, fontFamily: FONT_SANS,
                color: override ? "#8A4A08" : T.muted,
              }}>
                {standardRemark}
              </div>
            )}

            {/* Site note */}
            <div>
              <FieldLabel>Site note</FieldLabel>
              <textarea
                rows={2}
                placeholder="Optional — appears on the issued plan"
                aria-label={`Site note for ${comp.label}`}
                value={state.userRemarks || ""}
                onChange={e => onStateChange(comp.id, { userRemarks: e.target.value })}
                style={{
                  width: "100%", boxSizing: "border-box", resize: "vertical",
                  border: `1px solid ${T.hair}`, background: T.surface, padding: "8px 10px",
                  fontSize: 12, lineHeight: 1.5, fontFamily: FONT_SANS, color: T.ink, outline: "none",
                }}
                onFocus={e => { e.target.style.borderColor = T.navy; }}
                onBlur={e => { e.target.style.borderColor = T.hair; }}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Issue list ───────────────────────────────────────────────────

function IssueList({ validation }) {
  const { errors, warnings } = validation;
  if (errors.length === 0 && warnings.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 20px", borderBottom: `1px solid ${T.hair}`, background: T.surface }}>
        <span aria-hidden="true" style={{ width: 3, height: 14, background: "#5C8A2E", flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: T.body, fontFamily: FONT_SANS }}>
          Configuration complete — no outstanding issues.
        </span>
      </div>
    );
  }
  return (
    <div style={{ padding: "10px 20px", borderBottom: `1px solid ${T.hair}`, background: T.surface }}>
      {[...errors.map(e => ({ ...e, level: "error" })), ...warnings.map(w => ({ ...w, level: "warning" }))].map((item, i) => (
        <div key={`${item.id}-${i}`} style={{ display: "flex", alignItems: "flex-start", gap: 9, marginBottom: 5 }}>
          <span aria-hidden="true" style={{ width: 3, height: 14, marginTop: 2, background: item.level === "error" ? T.red : T.orange, flexShrink: 0 }} />
          <span style={{ fontSize: 12, lineHeight: 1.45, color: T.body, fontFamily: FONT_SANS }}>
            <strong style={{ fontFamily: FONT_MONO, fontWeight: 700, color: T.ink }}>{item.position}</strong>
            {"  "}{item.reason}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Project details ──────────────────────────────────────────────

const PROJECT_FIELDS = [
  ["constructionProject", "Construction project"],
  ["doorNumberOrNaming", "Door number / naming"],
  ["installationLocation", "Installation location"],
  ["positionNumberInSpec", "Position no. in specification"],
  ["functionDescription", "Function description"],
  ["miscellaneous", "Miscellaneous"],
];

function ProjectDetails({ projectData, setProjectData }) {
  return (
    <div style={{ padding: "20px" }}>
      <p style={{ margin: "0 0 20px", fontSize: 12.5, lineHeight: 1.55, color: T.muted, fontFamily: FONT_SANS }}>
        Recorded in the title block of the issued cable plan.
      </p>
      {PROJECT_FIELDS.map(([key, label]) => (
        <div key={key} style={{ marginBottom: 16 }}>
          <label htmlFor={`pd-${key}`}>
            <FieldLabel>{label}</FieldLabel>
          </label>
          {key === "functionDescription" || key === "miscellaneous" ? (
            <textarea
              id={`pd-${key}`}
              rows={3}
              value={projectData[key]}
              onChange={e => setProjectData(p => ({ ...p, [key]: e.target.value }))}
              style={{
                width: "100%", boxSizing: "border-box", resize: "vertical",
                border: `1px solid ${T.hair}`, background: T.surface, padding: "9px 11px",
                fontSize: 13, lineHeight: 1.5, fontFamily: FONT_SANS, color: T.ink, outline: "none",
              }}
              onFocus={e => { e.target.style.borderColor = T.navy; }}
              onBlur={e => { e.target.style.borderColor = T.hair; }}
            />
          ) : (
            <input
              id={`pd-${key}`}
              type="text"
              value={projectData[key]}
              onChange={e => setProjectData(p => ({ ...p, [key]: e.target.value }))}
              style={{
                width: "100%", boxSizing: "border-box",
                border: `1px solid ${T.hair}`, background: T.surface, padding: "9px 11px",
                fontSize: 13, fontFamily: FONT_SANS, color: T.ink, outline: "none",
              }}
              onFocus={e => { e.target.style.borderColor = T.navy; }}
              onBlur={e => { e.target.style.borderColor = T.hair; }}
            />
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

  // Selecting a callout on the drawing brings its entry into view.
  const handleSelectFromDrawing = useCallback((compId) => {
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

  return (
    <div style={{
      display: "flex",
      height: "calc(100vh - 190px)",
      minHeight: 620,
      border: `1px solid ${T.hair}`,
      background: T.surface,
      fontFamily: FONT_SANS,
      color: T.body,
      overflow: "hidden",
    }}>

      {/* ── Configuration rail ── */}
      <aside style={{
        width: 408, flexShrink: 0, display: "flex", flexDirection: "column",
        borderRight: `1px solid ${T.hair}`, background: T.surface, minHeight: 0,
      }}>

        {/* Title block */}
        <header style={{ padding: "16px 20px 14px", borderBottom: `1px solid ${T.hair}`, flexShrink: 0 }}>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 650, letterSpacing: "-0.01em", color: T.ink }}>
            {system.name}
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11.5, color: T.muted, fontFamily: FONT_MONO }}>{system.leafType}</span>
            <span aria-hidden="true" style={{ width: 1, height: 10, background: T.hair }} />
            <span style={{ fontSize: 11.5, color: T.muted, fontFamily: FONT_MONO }}>
              {includedCount} of {flat.length} positions
            </span>
            {system.isFireDoor && (
              <>
                <span aria-hidden="true" style={{ width: 1, height: 10, background: T.hair }} />
                <span style={{
                  fontSize: 9.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: T.orange,
                }}>
                  Fire door
                </span>
              </>
            )}
          </div>
        </header>

        <StepBar currentStep={currentStep} setCurrentStep={setCurrentStep} furthest={furthest} />

        {currentStep === 0 && <IssueList validation={validation} />}

        {/* Scrolling body */}
        <div ref={railRef} style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          {currentStep === 0 && flat.map(({ comp, depth }) => (
            <ComponentEntry
              key={comp.id}
              comp={comp}
              depth={depth}
              system={system}
              componentStates={componentStates}
              inclusion={inclusion}
              onStateChange={handleStateChange}
              active={activeId === comp.id}
              onActivate={() => setActiveId(comp.id)}
              entryRef={el => { entryRefs.current[comp.id] = el; }}
            />
          ))}

          {currentStep === 1 && (
            <ProjectDetails projectData={projectData} setProjectData={setProjectData} />
          )}

          {currentStep === 2 && (
            <ReviewAndGenerate
              system={system}
              componentStates={componentStates}
              projectData={projectData}
              validation={validation}
              inclusion={inclusion}
            />
          )}
        </div>

        {/* Rail footer */}
        <footer style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          padding: "12px 20px", borderTop: `1px solid ${T.hair}`, background: T.surface, flexShrink: 0,
        }}>
          <button
            type="button"
            onClick={goBack}
            disabled={currentStep === 0}
            style={{
              padding: "9px 16px", fontSize: 12.5, fontWeight: 550, fontFamily: FONT_SANS,
              border: `1px solid ${T.hair}`, background: T.surface,
              color: currentStep === 0 ? T.faint : T.body,
              cursor: currentStep === 0 ? "not-allowed" : "pointer",
            }}
          >
            Back
          </button>
          {currentStep < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={goNext}
              disabled={currentStep === 0 && !validation.isValid}
              style={{
                padding: "9px 22px", fontSize: 12.5, fontWeight: 600, fontFamily: FONT_SANS,
                border: "none",
                background: currentStep === 0 && !validation.isValid ? T.hair : T.navy,
                color: currentStep === 0 && !validation.isValid ? T.faint : "#FFFFFF",
                cursor: currentStep === 0 && !validation.isValid ? "not-allowed" : "pointer",
              }}
            >
              {currentStep === 0 && !validation.isValid
                ? `Resolve ${validation.errors.length} issue${validation.errors.length === 1 ? "" : "s"}`
                : "Next"}
            </button>
          ) : (
            <span style={{ fontSize: 11.5, color: T.faint, fontFamily: FONT_MONO }}>
              {system.systemVariant}
            </span>
          )}
        </footer>
      </aside>

      {/* ── Drawing ── */}
      <section style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: T.canvas }}>
        <DoorElevation
          system={system}
          componentStates={componentStates}
          activeId={activeId}
          onSelect={handleSelectFromDrawing}
        />
      </section>
    </div>
  );
}
