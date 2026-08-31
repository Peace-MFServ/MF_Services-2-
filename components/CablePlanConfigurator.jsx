'use client'
import { useState, useCallback, useRef, useEffect } from "react";
import DoorElevation from "./DoorElevation";
import BackArrow from "./BackArrow";
import ReviewAndGenerate from "./ReviewAndGenerate";
import {
  UI, FONT, CABLE_TYPES, resolveCable,
  flattenComponents, buildInclusionMap, buildInitialState,
  isMandatoryForSystem, getRemarksOverride, validateConfiguration,
} from "../lib/cablePlanSpec";
import { cardStyle } from "../lib/theme";
import { QS, ICONS, StepTabs } from "./quickSpecUI";

// ─── System definitions ───────────────────────────────────────────
// One JSON file per system in data/cable-systems/ — the component
// schedule and the drawing geometry travel together, so the elevation,
// the schedule and the PDF can never disagree. Adding a system is a
// data change, not a code change.
import ets73Single from "../data/cable-systems/ets73-single-leaf.json";
import ets73Double from "../data/cable-systems/ets73-double-leaf.json";

const SYSTEMS = Object.fromEntries(
  [ets73Single, ets73Double].map(sys => [sys.id, sys])
);

// Systems the range will grow into — shown so the tool reads as a
// range, the same way the door gallery does.
const COMING_SOON = [
  { id: "hold-open", label: "Hold-open system", summary: "Free-swing and hold-open closers with detection, for fire and smoke doors." },
  { id: "sliding",   label: "Sliding operator", summary: "Automatic sliding door drive with safety sensors." },
];

const TYPE_LABELS = {
  power_supply: "Power supply", e_opener: "Electric opener", bolt_switch: "Bolt switch",
  cable_transition: "Cable transition", sensor_strip: "Sensor", flip_switch: "Flip switch",
  radar_sensor: "Radar sensor", program_switch: "Program switch",
  manual_release_button: "Release button", smoke_detector: "Smoke detector",
  sequence_controller: "Door coordinator", operating_element: "Operating element",
  cladding: "Cladding", system_cable: "System cable",
};

const STEPS = ["System", "Components", "Project", "Review"];
const STEP_ICONS = ["gear", "components", "project", "sheet"];

const fieldStyle = {
  width: "100%", boxSizing: "border-box",
  border: `1px solid ${UI.ruleStrong}`, background: UI.surface,
  padding: "10px 12px", fontSize: 13.5, lineHeight: 1.5,
  fontFamily: FONT, color: UI.ink,
};

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
    <StepTabs
      steps={STEPS.map((label, i) => ({ label, icon: ICONS[STEP_ICONS[i]] }))}
      current={currentStep} furthest={furthest} onSelect={setCurrentStep}
    />
  );
}

// ─── System selection ─────────────────────────────────────────────

/** Miniature elevation for the system cards — one or two leaves under
 *  an operator band, matching the drawing style of the plan itself. */
function SystemArt({ leaves }) {
  const openL = 14, openR = 106, top = 12, floor = 74;
  const innerL = openL + 5, innerR = openR - 5;
  const leafTop = 30;
  const leafViews = leaves === 2
    ? [[innerL, 59], [61, innerR]]
    : [[innerL, innerR]];
  return (
    <svg viewBox="0 0 120 84" width="100%" height="100%" aria-hidden="true" style={{ display: "block" }}>
      <rect x={openL} y={top} width={openR - openL} height={floor - top} fill="#8895A3" stroke="#3C4956" strokeWidth="1" />
      <rect x={innerL} y={top + 5} width={innerR - innerL} height={floor - top - 8} fill="#FFFFFF" stroke="none" />
      <rect x={innerL} y={top + 5} width={innerR - innerL} height={leafTop - top - 5} fill="#FFFFFF" stroke="#3C4956" strokeWidth="0.8" />
      {leafViews.map(([l, r], i) => (
        <rect key={i} x={l} y={leafTop} width={r - l} height={floor - leafTop - 3} fill="#CBD5DF" stroke="#3C4956" strokeWidth="0.9" />
      ))}
    </svg>
  );
}

function SystemCard({ system, selected, comingSoon, onSelect }) {
  const live = !comingSoon;
  return (
    <button
      type="button"
      onClick={live ? onSelect : undefined}
      disabled={!live}
      aria-pressed={selected}
      style={{
        display: "flex", gap: 14, alignItems: "stretch", textAlign: "left", width: "100%",
        padding: 14, fontFamily: FONT, background: UI.surface,
        border: `1px solid ${selected ? UI.accent : UI.rule}`,
        boxShadow: selected ? `inset 0 0 0 2px ${UI.accent}` : "none",
        cursor: live ? "pointer" : "not-allowed",
        marginBottom: 12,
      }}
    >
      <div style={{ width: 96, flexShrink: 0, background: "#F4F6F8", opacity: live ? 1 : 0.6 }}>
        <SystemArt leaves={system.leafType === "double-leaf" ? 2 : 1} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14.5, fontWeight: 600, color: live ? UI.ink : UI.muted }}>
            {system.label}
          </span>
          {!live && (
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase",
              background: UI.ink, color: "#FFFFFF", padding: "2px 6px",
            }}>
              Coming soon
            </span>
          )}
        </div>
        <p style={{ margin: "5px 0 0", fontSize: 12.5, lineHeight: 1.5, color: UI.body }}>
          {system.summary}
        </p>
        {live && (
          <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: selected ? UI.accent : UI.muted }}>
            {selected ? "Selected — the prepared plan is on the right" : "Select this system →"}
          </div>
        )}
      </div>
    </button>
  );
}

function SystemStep({ selectedSystemId, onChoose }) {
  return (
    <div style={{ padding: "20px 22px" }}>
      <p style={{ margin: "0 0 18px", fontSize: 13.5, lineHeight: 1.6, color: UI.body, fontFamily: FONT }}>
        Choose a door system. Each comes as a prepared plan — mandatory
        positions already included — which you then customise.
      </p>
      {Object.values(SYSTEMS).map(sys => (
        <SystemCard
          key={sys.id} system={sys}
          selected={selectedSystemId === sys.id}
          onSelect={() => onChoose(sys.id)}
        />
      ))}
      {COMING_SOON.map(sys => (
        <SystemCard key={sys.id} system={{ ...sys, leafType: "single-leaf" }} comingSoon />
      ))}
    </div>
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
                    className="mf-field"
                    onBlur={e => { e.target.style.borderColor = e.target.value.trim() ? UI.ruleStrong : UI.warn; }}
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
                style={{ ...fieldStyle, resize: "vertical" }} className="mf-field"
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
              style={{ ...fieldStyle, resize: "vertical" }} className="mf-field" />
          ) : (
            <input id={`pd-${key}`} type="text"
              value={projectData[key]}
              onChange={e => setProjectData(p => ({ ...p, [key]: e.target.value }))}
              style={fieldStyle} className="mf-field" />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────

// Everything the customer has put into the plan, kept for this browser
// session and read by Save when a plan is kept as a project.
const STORAGE_KEY = "mf-cable-plan-v1";

export default function CablePlanConfigurator({ startSystemId, onChangeSystem, saveButton }) {
  // Mounted inside the Specification Tool the system is already
  // chosen, so step 0 belongs to the shared chooser rather than here.
  const embedded = !!startSystemId && !!SYSTEMS[startSystemId];
  const firstSystemId = embedded ? startSystemId : "ets73-single";
  const [currentStep, setCurrentStep] = useState(embedded ? 1 : 0);
  const [furthest, setFurthest] = useState(embedded ? 1 : 0);
  const [selectedSystemId, setSelectedSystemId] = useState(firstSystemId);
  const [componentStates, setComponentStates] = useState(() => buildInitialState(SYSTEMS[firstSystemId]));
  const [projectData, setProjectData] = useState({
    constructionProject: "", doorNumberOrNaming: "", installationLocation: "",
    positionNumberInSpec: "", functionDescription: "", miscellaneous: "",
  });
  const [activeId, setActiveId] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  // Restore before the first save runs, or the save writes an empty
  // plan over the stored one. A saved plan for a different system than
  // the one chosen in the gallery is left alone — the choice wins.
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        const sameSystem = saved.selectedSystemId === firstSystemId;
        if (SYSTEMS[saved.selectedSystemId] && (sameSystem || !embedded)) {
          setSelectedSystemId(saved.selectedSystemId);
          if (saved.componentStates) {
            // Merge over a fresh state so a data update that adds a
            // position never leaves it undefined.
            setComponentStates({
              ...buildInitialState(SYSTEMS[saved.selectedSystemId]),
              ...saved.componentStates,
            });
          }
          if (saved.projectData) setProjectData(pd => ({ ...pd, ...saved.projectData }));
          if (typeof saved.currentStep === "number") setCurrentStep(saved.currentStep);
          if (typeof saved.furthest === "number") setFurthest(saved.furthest);
        }
      }
    } catch { /* corrupt or unavailable storage is not worth breaking the tool over */ }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        selectedSystemId, componentStates, projectData, currentStep, furthest,
      }));
    } catch { /* best-effort */ }
  }, [hydrated, selectedSystemId, componentStates, projectData, currentStep, furthest]);

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

  const chooseSystem = useCallback(id => {
    setSelectedSystemId(prev => {
      // A different system means a different component schedule —
      // rebuild the state rather than carrying the old plan across.
      if (prev !== id) {
        setComponentStates(buildInitialState(SYSTEMS[id]));
        setActiveId(null);
      }
      return id;
    });
    // Choosing IS the step — move straight on to the components,
    // the same way the door gallery works.
    setFurthest(f => Math.max(f, 1));
    setCurrentStep(1);
    if (railRef.current) railRef.current.scrollTop = 0;
  }, []);

  const handleSelectFromDrawing = useCallback(compId => {
    setActiveId(compId);
    setCurrentStep(1);
  }, []);

  useEffect(() => {
    if (currentStep !== 1 || !activeId) return;
    const node = entryRefs.current[activeId];
    if (node) node.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeId, currentStep]);

  const goNext = () => {
    if (currentStep === 1 && !validation.isValid) return;
    const next = Math.min(currentStep + 1, STEPS.length - 1);
    setCurrentStep(next);
    setFurthest(f => Math.max(f, next));
    if (railRef.current) railRef.current.scrollTop = 0;
  };
  const goBack = () => {
    if (currentStep <= 1 && onChangeSystem) { onChangeSystem(); return; }
    setCurrentStep(s => Math.max(s - 1, 0));
    if (railRef.current) railRef.current.scrollTop = 0;
  };

  // Stepping back to "System" hands control to the shared chooser
  // when this is mounted inside the Specification Tool.
  const goToStep = i => {
    if (i === 0 && onChangeSystem) { onChangeSystem(); return; }
    setCurrentStep(i);
  };

  const nextDisabled = currentStep === 1 && !validation.isValid;

  return (
    <div className="mf-rounded" style={{
      display: "flex", gap: 20, height: "calc(100vh - 62px)", minHeight: 640,
      borderTop: `1px solid ${UI.rule}`, background: QS.bg, padding: "20px 24px",
      fontFamily: FONT, color: UI.body, overflow: "hidden",
    }}>

      {/* ── Configuration rail ── */}
      <aside style={{
        ...cardStyle, padding: 0,
        width: 496, flexShrink: 0, display: "flex", flexDirection: "column",
        minHeight: 0, overflow: "hidden",
      }}>

        <header style={{ padding: "18px 22px 16px", borderBottom: `1px solid ${UI.rule}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <BackArrow onClick={goBack} />
              <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", color: UI.ink, lineHeight: 1.3 }}>
                {system.name}
              </h2>
            </div>
            {saveButton}
          </div>
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

        <StepBar currentStep={currentStep} setCurrentStep={goToStep} furthest={furthest} />

        {currentStep === 1 && <IssueList validation={validation} />}

        <div ref={railRef} style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          {currentStep === 0 && (
            <SystemStep selectedSystemId={selectedSystemId} onChoose={chooseSystem} />
          )}

          {currentStep === 1 && flat.map(({ comp, depth }) => (
            <ComponentEntry
              key={comp.id} comp={comp} depth={depth} system={system}
              componentStates={componentStates} inclusion={inclusion}
              onStateChange={handleStateChange}
              active={activeId === comp.id}
              onActivate={() => setActiveId(comp.id)}
              entryRef={el => { entryRefs.current[comp.id] = el; }}
            />
          ))}

          {currentStep === 2 && <ProjectDetails projectData={projectData} setProjectData={setProjectData} />}

          {currentStep === 3 && (
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
      <section style={{ ...cardStyle, padding: 0, flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <DoorElevation
          system={system} componentStates={componentStates}
          activeId={activeId} onSelect={handleSelectFromDrawing}
        />
      </section>
    </div>
  );
}
