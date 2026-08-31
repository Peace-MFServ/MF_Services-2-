'use client'
import { UI, FONT, fieldStyle, cardStyle } from "../lib/theme";
import { mmDigits } from "./steelSpecState";
import {
  fireRatings, leafCountsFor, highPerformanceAvailable,
  hardwareNeedsText, hardwareWithPlaceholders,
} from "../lib/steelDoor";

// ─────────────────────────────────────────────────────────────────
// The questions a steel doorset asks
// ─────────────────────────────────────────────────────────────────
// One set of fields, mounted wherever a doorset is being configured —
// the quick specification layout and the pricer both use these, so an
// estimator and a specifier are answering exactly the same questions
// in exactly the same order.
//
// Everything is on the page from the start. What cannot be answered
// yet sits there greyed out saying what it is waiting for, rather than
// appearing later and moving the rest of the form down.
// ─────────────────────────────────────────────────────────────────

export function SectionTitle({ children, hint }) {
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

export function Field({ label, children, width }) {
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

export function Chips({ options, value, onChange, name }) {
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
              padding: "7px 12px", fontSize: 13, fontWeight: on ? 600 : 500, fontFamily: FONT,
              border: `1px solid ${on ? UI.accent : UI.ruleStrong}`,
              background: on ? UI.accent : disabled ? UI.sunken : UI.surface,
              color: on ? "#FFFFFF" : disabled ? UI.muted : UI.ink,
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.5 : 1, whiteSpace: "nowrap",
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

export function Input({ id, value, onChange, placeholder, type = "text" }) {
  return (
    <input
      id={id} type={type} value={value || ""} placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      style={{ ...fieldStyle, padding: "8px 10px", fontSize: 13 }} className="mf-field"
    />
  );
}

// The trades the ironmongery reads in — the same grouping as the
// guided flow, laid out across the page rather than down it. Any group
// the doorset does not ask simply does not appear.
const HARDWARE_SECTIONS = [
  { title: "Locking", ids: ["lock", "cylinder", "handleActiveInside", "handleActiveOutside", "handlePassiveOutside", "flushBolt", "electricStrike"] },
  { title: "Hanging and closing", ids: ["smokeProtection", "hinge", "hingeCount", "doorCloser", "doorStopper", "magnetContact"] },
  { title: "Openings in the leaf", ids: ["glazing", "ventilationGrill"] },
  { title: "Sealing and thresholds", ids: ["dropSeal", "threshold", "dripCap"] },
];

export function Select({ id, group, value, onChange }) {
  const blocked = group.options.length === 0;
  return (
    <select className="mf-field"
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

// A little section profile for each frame family, so the options read
// at a glance: an L for corner, a box for block (smaller when small,
// hatched when filled with plaster board, waved for mineral wool), a C
// for embracing. Thermal variants carry a double slash — the thermal
// break. Everything draws in currentColor so it inverts on selection.
function FrameGlyph({ id }) {
  const line = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };
  const thin = { ...line, strokeWidth: 1.2 };
  const small = id.startsWith("block-small");
  const plaster = id.includes("plaster");
  const wool = id.includes("mineral-wool");
  const thermal = id.includes("thermal");

  let shape;
  if (id.startsWith("corner")) {
    shape = <path {...line} d="M8 4 V20 H20" />;
  } else if (id.startsWith("embracing")) {
    shape = <path {...line} d="M17 4 H7 V20 H17" />;
  } else {
    const r = small
      ? { x: 7.5, y: 7.5, width: 9, height: 9 }
      : { x: 5.5, y: 5.5, width: 13, height: 13 };
    shape = (
      <>
        <rect {...line} {...r} />
        {plaster && (
          small
            ? <path {...thin} d="M8.5 15 L15 8.5 M8.5 11 L11 8.5" />
            : <path {...thin} d="M6.5 17 L17 6.5 M6.5 11.5 L11.5 6.5 M12 17.5 L17.5 12" />
        )}
        {wool && <path {...thin} d="M7.5 12 q1.6 -2.4 3.2 0 t3.2 0 t3.2 0" />}
      </>
    );
  }

  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      {shape}
      {thermal && <path {...thin} d="M15.5 2.5 L20 7 M18 1.5 L22.5 6" />}
    </svg>
  );
}

// Frame choices as equal-height cards — the labels run long, and a
// row of chips of wildly different widths reads badly. Cards layout
// only; the pricer keeps its chips.
function FrameCards({ frames, value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Frame" style={{
      display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(178px, 1fr))", gap: 8,
    }}>
      {frames.map(f => {
        const on = value === f.id;
        return (
          <button
            key={f.id} type="button" role="radio" aria-checked={on}
            onClick={() => onChange(f.id)}
            style={{
              minHeight: 52, padding: "9px 12px", fontSize: 13, fontFamily: FONT,
              fontWeight: on ? 600 : 500, textAlign: "left", lineHeight: 1.35,
              display: "flex", alignItems: "center", gap: 10,
              border: `1px solid ${on ? UI.accent : UI.ruleStrong}`,
              background: on ? UI.accent : UI.surface,
              color: on ? "#FFFFFF" : UI.ink, cursor: "pointer",
            }}
          >
            <span aria-hidden="true" style={{
              width: 32, height: 32, borderRadius: 6, flexShrink: 0,
              display: "grid", placeItems: "center",
              background: on ? "rgba(255,255,255,0.18)" : "#EDF2F8",
              color: on ? "#FFFFFF" : UI.accent,
            }}>
              <FrameGlyph id={f.id} />
            </span>
            {f.label}
          </button>
        );
      })}
    </div>
  );
}

export default function SteelDoorsetFields({ config, set, resolution, idPrefix = "ds", cards = false }) {
  const rated = config.fireRated === true;
  const minutes = config.minutes;
  const leafOptions = minutes == null ? [] : leafCountsFor({ minutes, highPerformance: config.highPerformance });
  const { frames, exposures, limits, clear } = resolution;
  const byId = Object.fromEntries(
    hardwareWithPlaceholders(config, resolution).map(g => [g.id, g]),
  );
  const waiting = "Choose the doorset first";

  // In cards layout every question pair sits on the same two-column
  // grid, so answers line up from section to section instead of
  // wrapping at whatever width the chips happen to have.
  const sectionStyle = cards ? { ...cardStyle, marginBottom: 18 } : { marginBottom: 30 };
  const pairRow = cards
    ? { display: "grid", gridTemplateColumns: "minmax(170px, 230px) 1fr", gap: "16px 26px", alignItems: "start" }
    : { display: "flex", gap: 22, flexWrap: "wrap" };

  return (
    <>
      <section style={sectionStyle}>
        <SectionTitle hint="A fire rated doorset is classified for both integrity and insulation.">
          Doorset
        </SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={pairRow}>
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

          <div style={pairRow}>
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

      <section style={sectionStyle}>
        <SectionTitle
          hint={limits
            ? `Approved from ${limits.minWidth} × ${limits.minHeight} mm to ${limits.maxWidth} × ${limits.maxHeight} mm.`
            : "The approved sizes follow from the doorset, where it goes and the frame."}
        >
          Opening
        </SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={pairRow}>
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
                cards ? (
                  <FrameCards frames={frames} value={config.frameId} onChange={v => set("frameId", v)} />
                ) : (
                  <Chips
                    name="Frame" value={config.frameId} onChange={v => set("frameId", v)}
                    options={frames.map(f => ({ value: f.id, label: f.label }))}
                  />
                )
              ) : (
                <p style={{ margin: "3px 0 0", fontSize: 12.5, color: UI.muted }}>
                  The frames on offer follow from the doorset.
                </p>
              )}
            </Field>

            {cards ? (
              <Field label="Opening size (mm)">
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    id={`${idPrefix}-width`} aria-label="Width (mm)" placeholder="1000"
                    value={config.width || ""} onChange={e => set("width", mmDigits(e.target.value))}
                    style={{ ...fieldStyle, width: 120, padding: "8px 10px", fontSize: 13 }} className="mf-field"
                  />
                  <span aria-hidden="true" style={{ color: UI.muted, fontSize: 13 }}>×</span>
                  <input
                    id={`${idPrefix}-height`} aria-label="Height (mm)" placeholder="2100"
                    value={config.height || ""} onChange={e => set("height", mmDigits(e.target.value))}
                    style={{ ...fieldStyle, width: 120, padding: "8px 10px", fontSize: 13 }} className="mf-field"
                  />
                  <span style={{ color: UI.muted, fontSize: 12.5 }}>width × height</span>
                </div>
              </Field>
            ) : (
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                <Field label="Width (mm)" width={130}>
                  <Input id={`${idPrefix}-width`} value={config.width} onChange={v => set("width", mmDigits(v))} placeholder="1000" />
                </Field>
                <Field label="Height (mm)" width={130}>
                  <Input id={`${idPrefix}-height`} value={config.height} onChange={v => set("height", mmDigits(v))} placeholder="2100" />
                </Field>
              </div>
            )}

            {clear && (
              <p style={{ margin: 0, fontSize: 12.5, color: UI.muted }}>
                Clear opening <strong style={{ color: UI.ink }}>{clear.width} × {clear.height} mm</strong>
              </p>
            )}
          </div>
      </section>

      <section style={sectionStyle}>
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
                  <div style={cards
                    ? { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "16px 14px" }
                    : { display: "flex", gap: 14, flexWrap: "wrap" }
                  }>
                    {groups.map(g => (
                      <div key={g.id} style={cards ? { minWidth: 0 } : { flex: "1 1 220px", minWidth: 200, maxWidth: 320 }}>
                        <Field label={g.label}>
                          <Select id={`${idPrefix}-${g.id}`} group={g} value={config[g.id]} onChange={v => set(g.id, v)} />
                          {hardwareNeedsText(config[g.id]) && (
                            <div style={{ marginTop: 8 }}>
                              <Input
                                id={`${idPrefix}-${g.id}-text`} value={config[`${g.id}Text`]}
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
                  <Input id={`${idPrefix}-ral`} value={config.ral} onChange={v => set("ral", v)} placeholder="7016" />
                </Field>
              </div>
            </div>
          </div>
      </section>
    </>
  );
}
