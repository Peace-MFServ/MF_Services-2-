'use client'
import { UI, FONT, fieldStyle, focusField, blurField } from "../lib/theme";
import { useSteelSpecState } from "./steelSpecState";
import { describeSteelDoor, steelSpecRows } from "../lib/steelDoor";
import { SPEC_TYPES } from "../lib/hardwareSpec";
import SteelDoorsetFields, { SectionTitle, Field, Chips, Input } from "./SteelDoorsetFields";
import BackArrow from "./BackArrow";

// ─────────────────────────────────────────────────────────────────
// Steel doorsets — quick specification
// ─────────────────────────────────────────────────────────────────
// The same doorset, the same rules, for someone who specifies these
// every week. Every question on one screen, top to bottom, with the
// specification building beside it.
//
// The questions themselves live in SteelDoorsetFields, shared with the
// pricer. What is here is the chrome around them: the header, the
// project details and the live sheet.
//
// State is the guided tool's own, so switching layouts carries the
// specification across.
// ─────────────────────────────────────────────────────────────────

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

export default function SteelQuickSpec({ onChangeProduct, modeSwitch, saveButton }) {
  const {
    config, set, specType, setSpecType, projectData, setProjectData,
    resolution, validation, generating, notice, startOver, generate,
  } = useSteelSpecState();

  const setPd = (key, value) => setProjectData(pd => ({ ...pd, [key]: value }));
  const rows = steelSpecRows(config, resolution);

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
          gap: 16, width: 452, flexShrink: 0, minWidth: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <BackArrow onClick={onChangeProduct} label="Change product" />
            <h1 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", color: UI.ink }}>
              Steel Doors
            </h1>
          </div>
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

          <SteelDoorsetFields
            config={config} set={set} resolution={resolution} idPrefix="sq"
          />

          <section>
            <SectionTitle>Project</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", gap: 22, flexWrap: "wrap", alignItems: "flex-end" }}>
                <Field label="Specification type & quantity" width={250}>
                  <Chips
                    name="Specification type" value={specType} onChange={setSpecType}
                    options={SPEC_TYPES.map(sp => ({ value: sp.id, label: sp.label, title: sp.summary }))}
                  />
                </Field>
                <Field label="Quantity of doorsets" width={190}>
                  <input
                    id="sq-quantity" type="text" inputMode="numeric" value={config.quantity}
                    onChange={e => set("quantity", e.target.value.replace(/\D/g, "").slice(0, 3))}
                    style={{ ...fieldStyle, width: 76, height: 31, padding: "0 10px", fontSize: 13, textAlign: "center" }}
                    onFocus={focusField} onBlur={blurField}
                  />
                </Field>
              </div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <Field label="Email"><Input id="sq-email" type="email" value={projectData.email} onChange={v => setPd("email", v)} /></Field>
                <Field label="Phone"><Input id="sq-phone" type="tel" value={projectData.phone} onChange={v => setPd("phone", v)} /></Field>
              </div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <Field label="Project name"><Input id="sq-project" value={projectData.projectName} onChange={v => setPd("projectName", v)} /></Field>
                <Field label="Architectural firm"><Input id="sq-firm" value={projectData.architecturalFirm} onChange={v => setPd("architecturalFirm", v)} /></Field>
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
