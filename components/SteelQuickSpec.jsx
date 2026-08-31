'use client'
import { UI, FONT, fieldStyle, cardStyle } from "../lib/theme";
import { useSteelSpecState } from "./steelSpecState";
import { describeSteelDoor, steelSpecRows } from "../lib/steelDoor";
import { SPEC_TYPES } from "../lib/hardwareSpec";
import SteelDoorsetFields, { Field, Chips, Input } from "./SteelDoorsetFields";
import { QS, CardTitle, ICONS, groupSheetRows, QuickHeader } from "./quickSpecUI";

// ─────────────────────────────────────────────────────────────────
// Steel doorsets — quick specification
// ─────────────────────────────────────────────────────────────────
// The same doorset, the same rules, for someone who specifies these
// every week. Every question on one screen: section cards down a
// centred page, with the specification building in a sticky sheet
// beside them.
//
// The questions themselves live in SteelDoorsetFields, shared with the
// pricer. What is here is the chrome around them: the header, the
// project details and the live sheet.
//
// State is the guided tool's own, so switching layouts carries the
// specification across.
// ─────────────────────────────────────────────────────────────────

// Which sheet rows belong under which summary heading. Anything a
// future row set adds lands in Hardware rather than disappearing.
const SHEET_GROUPS = [
  { title: "Doorset", icon: ICONS.door, labels: ["Quantity", "Doorset", "Fire rating", "Performance"] },
  { title: "Opening", icon: ICONS.opening, labels: ["Exposure", "Frame", "Structural opening", "Clear opening", "Leaf size", "Handing"] },
  { title: "Hardware", icon: ICONS.hardware, labels: null },
];

export default function SteelQuickSpec({ onChangeProduct, modeSwitch, saveButton }) {
  const {
    config, set, specType, setSpecType, projectData, setProjectData,
    resolution, validation, generating, notice, startOver, generate,
  } = useSteelSpecState();

  const setPd = (key, value) => setProjectData(pd => ({ ...pd, [key]: value }));
  const rows = steelSpecRows(config, resolution);
  const groups = groupSheetRows(rows, SHEET_GROUPS);

  return (
    <div className="mf-rounded" style={{
      background: QS.bg, borderTop: `1px solid ${UI.rule}`,
      minHeight: "calc(100vh - 62px)",
      fontFamily: FONT, color: UI.body,
    }}>
      <div className="qs-page">

        <QuickHeader
          title="Steel Doors"
          onChangeProduct={onChangeProduct} onStartOver={startOver}
          modeSwitch={modeSwitch} saveButton={saveButton}
        />

        <div className="qs-grid">

          {/* ── The whole specification, one screen ── */}
          <div style={{ minWidth: 0 }}>

            <SteelDoorsetFields
              config={config} set={set} resolution={resolution} idPrefix="sq" cards
            />

            <section style={cardStyle}>
              <CardTitle icon={ICONS.project}>Project</CardTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", gap: 22, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <Field label="Specification type & quantity" width={250}>
                    <Chips segmented
                      name="Specification type" value={specType} onChange={setSpecType}
                      options={SPEC_TYPES.map(sp => ({ value: sp.id, label: sp.label, title: sp.summary }))}
                    />
                  </Field>
                  <Field label="Quantity of doorsets" width={190}>
                    <input
                      id="sq-quantity" type="text" inputMode="numeric" value={config.quantity}
                      onChange={e => set("quantity", e.target.value.replace(/\D/g, "").slice(0, 3))}
                      style={{ ...fieldStyle, width: 76, height: 40, padding: "0 10px", fontSize: 13, textAlign: "center" }} className="mf-field"
                    />
                  </Field>
                </div>
                <div className="qs-3col" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                  <Field label="Email"><Input tall id="sq-email" type="email" value={projectData.email} onChange={v => setPd("email", v)} /></Field>
                  <Field label="Phone"><Input tall id="sq-phone" type="tel" value={projectData.phone} onChange={v => setPd("phone", v)} /></Field>
                  <Field label="Project name"><Input tall id="sq-project" value={projectData.projectName} onChange={v => setPd("projectName", v)} /></Field>
                  <Field label="Architectural firm"><Input tall id="sq-firm" value={projectData.architecturalFirm} onChange={v => setPd("architecturalFirm", v)} /></Field>
                </div>
              </div>
            </section>
          </div>

          {/* ── Live sheet, sticky beside the questions ── */}
          <aside className="qs-aside">
            <div style={{
              ...cardStyle, padding: 0, overflow: "hidden",
              display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 40px)",
            }}>
              <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 20 }}>
                <CardTitle icon={ICONS.sheet}>Specification</CardTitle>
                {rows.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: QS.muted }}>
                    Answer the doorset questions and the specification builds here.
                  </p>
                ) : (
                  <>
                    <p style={{ margin: "0 0 14px", fontSize: 12.5, lineHeight: 1.5, color: UI.body }}>
                      {describeSteelDoor(resolution.type)}
                    </p>
                    {groups.map((g, gi) => (
                      <div key={g.title} style={gi > 0 ? { marginTop: 14, paddingTop: 12, borderTop: "1px solid #E2E8F0" } : undefined}>
                        <div style={{
                          display: "flex", alignItems: "center", gap: 7, marginBottom: 2,
                          fontSize: 11, fontWeight: 700, letterSpacing: "0.07em",
                          textTransform: "uppercase", color: UI.accent,
                        }}>
                          <span aria-hidden="true" style={{ display: "inline-flex", transform: "scale(0.78)", transformOrigin: "left center" }}>
                            {g.icon}
                          </span>
                          {g.title}
                        </div>
                        {g.rows.map(r => (
                          <div key={r.label} style={{
                            display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12,
                            padding: "7px 0", borderBottom: "1px solid #EEF2F6",
                          }}>
                            <span style={{ fontSize: 12.5, color: QS.muted }}>{r.label}</span>
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: QS.ink, textAlign: "right" }}>{r.value}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </>
                )}
              </div>

              <div style={{ borderTop: "1px solid #E2E8F0", padding: "16px 20px 20px", flexShrink: 0 }}>
                {validation.errors.length > 0 && (
                  <ul style={{ margin: "0 0 12px", padding: 0, listStyle: "none" }}>
                    {validation.errors.slice(0, 4).map((e, i) => (
                      <li key={`${e.field}-${i}`} style={{ display: "flex", gap: 8, marginBottom: 5 }}>
                        <span aria-hidden="true" style={{ width: 3, height: 15, background: UI.warn, flexShrink: 0, marginTop: 1 }} />
                        <span style={{ fontSize: 12.5, lineHeight: 1.4, color: UI.body }}>{e.message}</span>
                      </li>
                    ))}
                    {validation.errors.length > 4 && (
                      <li style={{ fontSize: 12.5, color: QS.muted, marginLeft: 11 }}>
                        and {validation.errors.length - 4} more
                      </li>
                    )}
                  </ul>
                )}
                <button
                  type="button" onClick={generate} disabled={generating || !validation.isValid}
                  className="qs-download"
                  style={{
                    width: "100%", height: 46, padding: "0 20px",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                    border: `1px solid ${validation.isValid ? UI.accent : "#CBD5E1"}`,
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
                  <p style={{ margin: "10px 0 0", fontSize: 12.5, textAlign: "center", color: notice.error ? UI.warn : UI.body }}>
                    {notice.text}
                  </p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
