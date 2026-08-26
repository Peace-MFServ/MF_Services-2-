'use client'
import { UI, FONT, fieldStyle, focusField, blurField } from "../lib/theme";
import { useSteelSpecState, mmDigits } from "./steelSpecState";
import {
  fireRatings, leafCountsFor, highPerformanceAvailable,
  describeSteelDoor, steelSpecRows, hardwareNeedsText, hardwareWithPlaceholders,
} from "../lib/steelDoor";
import { SPEC_TYPES } from "../lib/hardwareSpec";

// ─────────────────────────────────────────────────────────────────
// Steel doorsets — quick specification
// ─────────────────────────────────────────────────────────────────
// The same doorset, the same rules, for someone who specifies these
// every week. Every question on one screen, top to bottom, with the
// specification building beside it. What the answers rule out still
// disappears — an unrated door is not asked for how long, and a
// doorset with one approved frame is not asked to choose it.
//
// State is the guided tool's own, so switching layouts carries the
// specification across.
// ─────────────────────────────────────────────────────────────────

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

function Chips({ options, value, onChange, name }) {
  return (
    <div role="radiogroup" aria-label={name} style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map(opt => {
        const on = value === opt.value;
        const disabled = !!opt.disabled;
        return (
          <button
            key={String(opt.value)} type="button" role="radio" aria-checked={on}
            disabled={disabled}
            title={disabled ? opt.disabledReason : opt.title}
            onClick={disabled ? undefined : () => onChange(opt.value)}
            style={{
              padding: "7px 12px", fontSize: 13, fontWeight: on ? 600 : 400, fontFamily: FONT,
              border: `1px solid ${on ? UI.accent : UI.ruleStrong}`,
              background: on ? UI.accent : disabled ? UI.sunken : UI.surface,
              color: on ? "#FFFFFF" : disabled ? UI.muted : UI.body,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.5 : 1, whiteSpace: "nowrap",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

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
      style={{ ...fieldStyle, padding: "8px 10px", fontSize: 13 }}
      onFocus={focusField} onBlur={blurField}
    />
  );
}

// Same trades as the guided flow, laid out across the page rather
// than down it.
const HARDWARE_SECTIONS = [
  { title: "Locking", ids: ["lock", "cylinder", "handleActiveInside", "handleActiveOutside", "handlePassiveOutside", "flushBolt", "electricStrike"] },
  { title: "Hanging and closing", ids: ["smokeProtection", "hinge", "hingeCount", "doorCloser", "doorStopper", "magnetContact"] },
  { title: "Openings in the leaf", ids: ["glazing", "ventilationGrill"] },
  { title: "Sealing and thresholds", ids: ["dropSeal", "threshold", "dripCap"] },
];

function Select({ id, group, value, onChange }) {
  const blocked = group.options.length === 0;
  return (
    <select
      id={id} value={blocked ? "" : value || ""} disabled={blocked}
      onChange={e => onChange(e.target.value)}
      style={{
        ...fieldStyle, padding: "8px 10px", fontSize: 13,
        background: blocked ? UI.sunken : UI.surface,
        color: blocked ? UI.muted : UI.ink,
        cursor: blocked ? "not-allowed" : "pointer",
      }}
    >
      {blocked && <option value="">{group.blocked ?? "Not available yet"}</option>}
      {group.options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

export default function SteelQuickSpec({ onChangeProduct, modeSwitch, saveButton }) {
  const {
    config, set, specType, setSpecType, projectData, setProjectData,
    resolution, validation, generating, notice, startOver, generate,
  } = useSteelSpecState();
  const waiting = "Choose the doorset first";

  const setPd = (key, value) => setProjectData(pd => ({ ...pd, [key]: value }));

  const rated = config.fireRated === true;
  const minutes = config.minutes;
  const leafOptions = minutes == null ? [] : leafCountsFor({ minutes, highPerformance: config.highPerformance });
  const { frames, exposures, limits, clear } = resolution;
  const rows = steelSpecRows(config, resolution);

  // Everything is on the page from the start; what cannot be answered
  // yet sits there greyed out rather than appearing later and moving
  // the rest of the form down.
  const byId = Object.fromEntries(
    hardwareWithPlaceholders(config, resolution).map(g => [g.id, g]),
  );

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
          gap: 16, width: 404, flexShrink: 0, minWidth: 0,
        }}>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", color: UI.ink }}>
            Steel Doors
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {modeSwitch}
            {saveButton}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <HeaderButton onClick={onChangeProduct}>Change product</HeaderButton>
          <HeaderButton onClick={startOver}>Start over</HeaderButton>
        </div>
      </header>

      <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>

        {/* ── The whole specification, one screen ── */}
        <div style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: "22px 26px 40px" }}>

          <section style={{ marginBottom: 30 }}>
            <SectionTitle hint="A fire rated doorset is classified for both integrity and insulation.">
              Doorset
            </SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
                <Field label="Fire rated" width={150}>
                  <Chips
                    name="Fire rated" value={config.fireRated}
                    onChange={v => { set("fireRated", v); set("minutes", v ? null : 0); }}
                    options={[{ value: false, label: "No" }, { value: true, label: "Yes" }]}
                  />
                </Field>
                {rated && (
                  <Field label="How long">
                    <Chips
                      name="Fire rating" value={minutes} onChange={v => set("minutes", v)}
                      options={fireRatings().filter(m => m > 0).map(m => ({ value: m, label: `${m} min` }))}
                    />
                  </Field>
                )}
              </div>

              <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
                <Field label="Leaves" width={150}>
                  <Chips
                    name="Leaves" value={config.leaves} onChange={v => set("leaves", v)}
                    options={[1, 2].map(n => ({
                      value: n, label: n === 1 ? "Single" : "Double",
                      disabled: minutes == null || !leafOptions.includes(n),
                      disabledReason: minutes == null
                        ? "Answer the fire rating first"
                        : config.highPerformance
                          ? "Not made as High Performance at this rating"
                          : "Not made at this fire rating",
                    }))}
                  />
                </Field>
                <Field label="Performance">
                  <Chips
                    name="Performance" value={config.highPerformance}
                    onChange={v => set("highPerformance", v)}
                    options={[
                      { value: false, label: "Standard" },
                      {
                        value: true, label: "High Performance",
                        title: "65 mm leaf, high-density mineral wool core, corrosion resistance to C5 Marine",
                        disabled: !config.leaves || !highPerformanceAvailable({ minutes, leaves: config.leaves }),
                        disabledReason: config.leaves ? "Not made above 60 minutes" : waiting,
                      },
                    ]}
                  />
                </Field>
              </div>
            </div>
          </section>

          <section style={{ marginBottom: 30 }}>
            <SectionTitle
              hint={limits
                ? `Approved from ${limits.minWidth} × ${limits.minHeight} mm to ${limits.maxWidth} × ${limits.maxHeight} mm.`
                : "The approved sizes follow from the doorset, where it goes and the frame."}
            >
              Opening
            </SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
                  <Field label="Where it goes" width={220}>
                    <Chips
                      name="Exposure" value={config.exposure} onChange={v => set("exposure", v)}
                      options={[
                        {
                          value: "INT", label: "Internal",
                          disabled: !exposures.some(e => e.id === "INT"),
                          disabledReason: waiting,
                        },
                        {
                          value: "EXT", label: "External",
                          disabled: !exposures.some(e => e.id === "EXT"),
                          disabledReason: resolution.type
                            ? "This doorset is approved for internal use only"
                            : waiting,
                        },
                      ]}
                    />
                  </Field>
                  <Field label="Handing">
                    <Chips
                      name="Handing" value={config.handing} onChange={v => set("handing", v)}
                      options={[{ value: "left", label: "Left hand" }, { value: "right", label: "Right hand" }]}
                    />
                  </Field>
                </div>

                <Field label="Frame">
                  {frames.length ? (
                    <Chips
                      name="Frame" value={config.frameId} onChange={v => set("frameId", v)}
                      options={frames.map(f => ({ value: f.id, label: f.label }))}
                    />
                  ) : (
                    <p style={{ margin: "3px 0 0", fontSize: 12.5, color: UI.muted }}>
                      The frames on offer follow from the doorset.
                    </p>
                  )}
                </Field>

                <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <Field label="Width (mm)" width={130}>
                    <Input id="sq-width" value={config.width} onChange={v => set("width", mmDigits(v))} placeholder="1000" />
                  </Field>
                  <Field label="Height (mm)" width={130}>
                    <Input id="sq-height" value={config.height} onChange={v => set("height", mmDigits(v))} placeholder="2100" />
                  </Field>
                </div>

                {clear && (
                  <p style={{ margin: 0, fontSize: 12.5, color: UI.muted }}>
                    Clear opening <strong style={{ color: UI.ink }}>{clear.width} × {clear.height} mm</strong>
                  </p>
                )}
              </div>
          </section>

          <section style={{ marginBottom: 30 }}>
            <SectionTitle hint="Nothing is fitted unless you ask for it, apart from the lock, cylinder and hinges.">
              Hardware
            </SectionTitle>

              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {HARDWARE_SECTIONS.map(section => {
                  const groups = section.ids.map(id => byId[id]).filter(Boolean);
                  if (!groups.length) return null;
                  return (
                    <div key={section.title}>
                      <div style={{
                        fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
                        color: UI.ink, marginBottom: 8,
                      }}>
                        {section.title}
                      </div>
                      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                        {groups.map(g => (
                          <div key={g.id} style={{ flex: "1 1 220px", minWidth: 200, maxWidth: 320 }}>
                            <Field label={g.label}>
                              <Select id={`sq-${g.id}`} group={g} value={config[g.id]} onChange={v => set(g.id, v)} />
                              {hardwareNeedsText(config[g.id]) && (
                                <div style={{ marginTop: 8 }}>
                                  <Input
                                    id={`sq-${g.id}-text`} value={config[`${g.id}Text`]}
                                    onChange={v => set(`${g.id}Text`, v)}
                                    placeholder={`Describe the ${g.label.toLowerCase()} required`}
                                  />
                                </div>
                              )}
                            </Field>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <div>
                  <div style={{
                    fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
                    color: UI.ink, marginBottom: 8,
                  }}>
                    Finish
                  </div>
                  <div style={{ maxWidth: 220 }}>
                    <Field label="Colour (RAL)">
                      <Input id="sq-ral" value={config.ral} onChange={v => set("ral", v)} placeholder="7016" />
                    </Field>
                  </div>
                </div>
              </div>
          </section>

          <section>
            <SectionTitle>Project</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Field label="Specification type">
                <Chips
                  name="Specification type" value={specType} onChange={setSpecType}
                  options={SPEC_TYPES.map(sp => ({ value: sp.id, label: sp.label, title: sp.summary }))}
                />
              </Field>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <Field label="Project name"><Input id="sq-project" value={projectData.projectName} onChange={v => setPd("projectName", v)} /></Field>
                <Field label="Architectural firm"><Input id="sq-firm" value={projectData.architecturalFirm} onChange={v => setPd("architecturalFirm", v)} /></Field>
              </div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <Field label="Business"><Input id="sq-business" value={projectData.businessName} onChange={v => setPd("businessName", v)} /></Field>
                <Field label="Contact"><Input id="sq-contact" value={projectData.contactName} onChange={v => setPd("contactName", v)} /></Field>
                <Field label="Email"><Input id="sq-email" type="email" value={projectData.email} onChange={v => setPd("email", v)} /></Field>
                <Field label="Phone"><Input id="sq-phone" type="tel" value={projectData.phone} onChange={v => setPd("phone", v)} /></Field>
              </div>
            </div>
          </section>
        </div>

        {/* ── Live sheet, always in view ── */}
        <aside style={{
          width: 372, flexShrink: 0, borderLeft: `1px solid ${UI.ruleStrong}`,
          display: "flex", flexDirection: "column", minHeight: 0, background: UI.sunken,
        }}>
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 22px" }}>
            <SectionTitle>Specification</SectionTitle>
            {rows.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: UI.muted }}>
                Answer the doorset questions and the specification builds here.
              </p>
            ) : (
              <>
                <p style={{ margin: "0 0 12px", fontSize: 12.5, lineHeight: 1.5, color: UI.body }}>
                  {describeSteelDoor(resolution.type)}
                </p>
                {rows.map(r => (
                  <div key={r.label} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12,
                    padding: "8px 0", borderBottom: `1px solid ${UI.rule}`,
                  }}>
                    <span style={{ fontSize: 12.5, color: UI.body }}>{r.label}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: UI.ink, textAlign: "right" }}>{r.value}</span>
                  </div>
                ))}
              </>
            )}
          </div>

          <div style={{ borderTop: `1px solid ${UI.ruleStrong}`, padding: "16px 22px 20px", flexShrink: 0, background: UI.surface }}>
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
              type="button" onClick={generate} disabled={generating || !validation.isValid}
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
        </aside>
      </div>
    </div>
  );
}
