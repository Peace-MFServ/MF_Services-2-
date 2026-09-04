'use client'
import { useState } from "react";
import { UI, FONT, fieldStyle, cardStyle } from "../lib/theme";
import { QS, CardTitle, ICONS } from "./quickSpecUI";
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

export function Field({ label, children, width, auto }) {
  return (
    <div style={{ minWidth: 0, flex: width ? `0 0 ${width}px` : auto ? "0 1 auto" : "1 1 0" }}>
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

export function Chips({ options, value, onChange, name, segmented = false }) {
  // Segmented renders the options as one joined control — the quick
  // screens use it for short either/or questions. The default keeps
  // the free-standing chips the pricer and longer option sets use.
  if (segmented) {
    return (
      <div role="radiogroup" aria-label={name} style={{
        display: "inline-flex", flexWrap: "wrap", maxWidth: "100%",
        border: `1px solid #CBD5E1`, borderRadius: 6, overflow: "hidden",
        background: UI.surface,
      }}>
        {options.map((opt, i) => {
          const on = value === opt.value;
          const disabled = !!opt.disabled;
          return (
            <button
              key={String(opt.value)} type="button" role="radio" aria-checked={on}
              disabled={disabled}
              title={disabled ? opt.disabledReason : opt.title}
              onClick={disabled ? undefined : () => onChange(opt.value)}
              style={{
                height: 38, padding: "0 14px", fontSize: 13, fontWeight: on ? 600 : 500,
                fontFamily: FONT, border: "none", borderRadius: 0,
                borderLeft: i > 0 ? `1px solid ${on ? UI.accent : "#D8E0EA"}` : "none",
                background: on ? UI.accent : disabled ? UI.sunken : "transparent",
                color: on ? "#FFFFFF" : disabled ? UI.muted : QS.ink,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.55 : 1, whiteSpace: "nowrap",
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

export function Input({ id, value, onChange, placeholder, type = "text", tall = false }) {
  return (
    <input
      id={id} type={type} value={value || ""} placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      style={{ ...fieldStyle, padding: tall ? "10px 12px" : "8px 10px", fontSize: 13 }} className="mf-field"
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

export function Select({ id, group, value, onChange, tall = false }) {
  const blocked = group.options.length === 0;
  return (
    <select className="mf-field"
      id={id} value={blocked ? "" : value || ""} disabled={blocked}
      onChange={e => onChange(e.target.value)}
      style={{
        ...fieldStyle, padding: tall ? "10px 12px" : "8px 10px", fontSize: 13,
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

// Every frame variant has its own photograph, keyed by the frame id
// from the manufacturer's sheet. The family fallback below only
// matters if a new variant ever appears without a shot.
const FRAME_PHOTOS = {
  "corner":              { src: "/products/frame-corner.jpg",               position: "center" },
  "corner-thermal":      { src: "/products/frame-corner-thermal.jpg",       position: "center" },
  "block":               { src: "/products/frame-block.jpg",                position: "center" },
  "block-thermal":       { src: "/products/frame-block-thermal.jpg",        position: "center" },
  "block-with-plaster-board": { src: "/products/frame-block-plaster.jpg",   position: "center" },
  "block-thermal-with-plaster-board": { src: "/products/frame-block-thermal-plaster.jpg", position: "center" },
  "block-with-mineral-wool": { src: "/products/frame-block-wool.jpg",       position: "center" },
  "embracing":           { src: "/products/frame-embracing.jpg",            position: "center" },
  "embracing-thermal":   { src: "/products/frame-embracing-thermal.jpg",    position: "center" },
  "block-small":         { src: "/products/frame-block-small.jpg",          position: "center" },
  "block-small-filled-with-plaster-board": { src: "/products/frame-block-small-plaster.jpg", position: "center" },
};

function framePhotoFor(id) {
  if (FRAME_PHOTOS[id]) return FRAME_PHOTOS[id];
  if (id.startsWith("corner")) return FRAME_PHOTOS.corner;
  if (id.startsWith("embracing")) return FRAME_PHOTOS.embracing;
  if (id.startsWith("block-small")) return FRAME_PHOTOS["block-small"];
  if (id.includes("plaster")) return FRAME_PHOTOS["block-with-plaster-board"];
  return FRAME_PHOTOS.block;
}

/** A tile's photo strip; no photo, or one that fails to load,
 *  degrades to the plain grey ground behind it. */
function TilePhoto({ src, position }) {
  const [failedSrc, setFailedSrc] = useState(null);
  if (!src || failedSrc === src) return null;
  return (
    <img
      src={src} alt="" onError={() => setFailedSrc(src)}
      style={{
        position: "absolute", inset: 0, width: "100%", height: "100%",
        objectFit: "cover", objectPosition: position ?? "center",
      }}
    />
  );
}

// Photographs for the handle options, keyed by the option strings
// exactly as the manufacturer's sheet spells them (misspellings and
// all — the key has to match the data). Options without a photograph
// simply show no preview.
const HARDWARE_OPTION_PHOTOS = {
  "handle on long shield": "/products/hw-handle-long-shield.jpg",
  "handle on round rossette": "/products/hw-handle-round-rosette.jpg",
  "knob on long shield": "/products/hw-knob-long-shield.jpg",
  "knob on round rossette": "/products/hw-knob-round-rosette.jpg",
  "handle on blind long shield standard DFM": "/products/hw-handle-blind-long-shield.jpg",
  "knob on blind long shield Eco Schulte": "/products/hw-knob-blind-long-shield.jpg",
  "total blind shiled Eco Schulte": "/products/hw-total-blind-shield.jpg",
  "handle Eco WC": "/products/hw-handle-eco-wc.jpg",
  "preparation": "/products/hw-preparation.jpg",
  "without preparation": "/products/hw-without-preparation.jpg",
  "panic bar EPN 900 black": "/products/hw-epn900-black.jpg",
  "panic bar EPN 900 alu": "/products/hw-epn900-alu.jpg",
  "panic bar EPN 900 inox": "/products/hw-epn900-inox.jpg",
  "pushbar inox": "/products/hw-pushbar-inox.jpg",
};

// A few options look different on the passive leaf — its furniture has
// no keyway or latch — so those questions can override the shared shot.
const HARDWARE_OPTION_PHOTO_OVERRIDES = {
  handlePassiveOutside: {
    "handle on long shield": "/products/hw-passive-handle-long-shield.jpg",
    "handle on round rossette": "/products/hw-passive-handle-round-rosette.jpg",
  },
};

// The surface-mounted hardware — PHA2000/PHB3000 bars, PHT001 handle,
// PHT06 knob — comes in point-count, height and certification variants
// that all photograph the same; only the product and its colour
// matter, so those resolve by pattern.
function barPhotoFor(option) {
  const m = /^(PHA2000|PHB3000|PHT001|PHT06)\b.*\b(silver|black)\b/.exec(option ?? "");
  return m ? `/products/hw-${m[1].toLowerCase()}-${m[2]}.jpg` : null;
}

function hardwarePhotoFor(groupId, option) {
  return HARDWARE_OPTION_PHOTO_OVERRIDES[groupId]?.[option]
    ?? HARDWARE_OPTION_PHOTOS[option]
    ?? barPhotoFor(option);
}

// The three handle questions choose from photo tiles instead of a
// dropdown — the same floating-panel tiles as the Frame question,
// minus the glyph badge. An option without a photograph yet keeps a
// plain grey ground with a muted mark, and fills in when its shot
// arrives.
export const HANDLE_TILE_IDS = new Set([
  "handleActiveInside", "handleActiveOutside", "handlePassiveOutside",
]);

export function HardwareTiles({ group, value, onChange }) {
  // Options with a photograph lead; the plain tiles (preparation,
  // without, other) trail so the row doesn't read photo, photo,
  // blank, photo. The sheet's order holds within each half.
  const ordered = [...group.options].sort(
    (a, b) => (hardwarePhotoFor(group.id, b) ? 1 : 0) - (hardwarePhotoFor(group.id, a) ? 1 : 0),
  );
  return (
    <div role="radiogroup" aria-label={group.label} className="qs-hw-tiles">
      {ordered.map(o => {
        const on = value === o;
        return (
          <button
            key={o} type="button" role="radio" aria-checked={on}
            onClick={() => onChange(o)}
            style={{
              position: "relative", padding: 0,
              display: "flex", flexDirection: "column", textAlign: "left",
              fontFamily: FONT, background: on ? QS.selected : UI.surface,
              border: `1px solid ${on ? UI.accent : "#D8E0EA"}`,
              borderRadius: 6,
              boxShadow: on
                ? `inset 0 0 0 1px ${UI.accent}, 0 0 0 3px ${QS.tintOn}`
                : "none",
              cursor: "pointer",
            }}
          >
            <span aria-hidden="true" style={{
              position: "relative", display: "grid", placeItems: "center",
              width: "100%", aspectRatio: "1 / 1",
              flexShrink: 0, background: "#F4F6F8", color: "#B4BFCC",
              borderRadius: "5px 5px 0 0", overflow: "hidden",
            }}>
              {o === "other" ? (
                <span style={{
                  width: 30, height: 30, borderRadius: 8,
                  border: "1.5px dashed #B4BFCC",
                  display: "grid", placeItems: "center",
                  fontSize: 17, lineHeight: 1, color: "#B4BFCC",
                }}>
                  +
                </span>
              ) : (
                <span style={{ display: "inline-flex", transform: "scale(0.85)" }}>
                  {ICONS.hardware}
                </span>
              )}
              <TilePhoto src={hardwarePhotoFor(group.id, o)} />
            </span>
            <span style={{
              position: "relative", marginTop: -8, width: "100%", flex: 1,
              display: "flex", alignItems: "flex-start",
              padding: "5px 9px 7px",
              background: on ? QS.selected : UI.surface,
              borderRadius: "6px 6px 4px 4px",
            }}>
              {o === "other" ? (
                <span style={{ display: "flex", flexDirection: "column", minHeight: 30 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.3, color: QS.ink }}>
                    other
                  </span>
                  <span style={{ fontSize: 10.5, fontWeight: 400, lineHeight: 1.3, color: QS.muted }}>
                    custom
                  </span>
                </span>
              ) : (
                <span style={{
                  fontSize: 11.5, fontWeight: on ? 600 : 500, lineHeight: 1.3, color: QS.ink,
                  minHeight: 30,
                }}>
                  {o}
                </span>
              )}
            </span>
            {on && (
              <span aria-hidden="true" style={{
                position: "absolute", top: -8, right: -8,
                width: 22, height: 22, borderRadius: "50%",
                background: UI.accent, color: "#FFFFFF",
                display: "grid", placeItems: "center",
                border: "2px solid #FFFFFF",
                boxShadow: "0 1px 4px rgba(15, 23, 42, 0.25)",
              }}>
                {ICONS.check}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// What each lock actually is, in plain words, shown under the Lock
// dropdown as the pick changes — the info the estimators asked for.
// Keyed by the option strings exactly as the manufacturer's sheet
// spells them; a pattern handles the families. An option without an
// entry simply shows nothing.
function lockInfoFor(value = "") {
  if (!value || value === "other") return "";
  if (value === "standard") return "Key lock — the handle works the latch, the key throws the deadbolt.";
  if (value === "WC") return "Bathroom lock — thumb turn on the inside, emergency release outside; no key.";
  if (value === "roller") return "Roller latch — holds the door closed without locking it.";
  if (value === "GBS 90") return "GBS 90 sashlock from the manufacturer's list.";
  if (/^3 pts panic/.test(value)) {
    return "Three-point locking with the escape function — locks top, centre and bottom, and always opens from the inside in one movement.";
  }
  if (value === "3 pts") return "Three-point locking — locks at the centre and at the top and bottom of the leaf.";
  if (/^panic/.test(value)) {
    const twoLeaf = / for 2 Lv$/.test(value) ? " Made for double doors — both leaves carry escape hardware." : "";
    return `Escape-route lock — always opens from the inside in one movement, even when locked from outside.${twoLeaf}`;
  }
  if (/^EL \d/.test(value)) return "Electric lock — locking and release driven by the access-control system.";
  if (/^Dorma SVP/.test(value)) return "Self-locking panic lock — deadlocks itself every time the door closes, and always opens from the inside.";
  if (/^Dorma SVZ/.test(value)) return "Self-locking lock — deadlocks itself every time the door closes.";
  if (/^WITHOUT \(NFR/.test(value)) return "No lock in the door — the surface-mounted hardware carries the locking (non-fire-rated hardware).";
  if (/^WITHOUT \(EI/.test(value)) return "No lock in the door — the surface-mounted hardware carries the locking (fire-rated hardware).";
  return "";
}

/** The plain-words line under the Lock dropdown. */
export function LockInfo({ value }) {
  const text = lockInfoFor(value);
  if (!text) return null;
  return (
    <p style={{
      display: "flex", gap: 6, alignItems: "flex-start",
      margin: "7px 0 0", fontSize: 12, lineHeight: 1.5, color: UI.muted, fontFamily: FONT,
    }}>
      <span aria-hidden="true" style={{
        flexShrink: 0, marginTop: 1, width: 14, height: 14, borderRadius: "50%",
        border: `1.3px solid ${UI.accent}`, color: UI.accent,
        display: "grid", placeItems: "center",
        fontSize: 9.5, fontWeight: 700, fontStyle: "normal",
      }}>
        i
      </span>
      {text}
    </p>
  );
}

// The handle questions live in bordered boxes — one for the active
// leaf with Inside and Outside sub-groups, one for the passive leaf —
// so each group reads as a container rather than headings floating
// over one long wall of photos. On-screen grouping only: the spec
// sheet keeps its own row wordings.
const HANDLE_CONTAINERS = [
  {
    title: "Handle — Active leaf",
    items: [
      { id: "handleActiveInside", sub: "Inside" },
      { id: "handleActiveOutside", sub: "Outside" },
    ],
  },
  {
    title: "Handle — Passive leaf",
    items: [
      { id: "handlePassiveOutside", sub: "Outside" },
    ],
  },
];

export function HandleGroups({ byId, config, set, idPrefix = "ds", renderExtra }) {
  return HANDLE_CONTAINERS.map(box => {
    const items = box.items.filter(it => byId[it.id]);
    if (!items.length) return null;
    return (
      <div key={box.title} style={{
        border: "1px solid #E2E8F0", borderRadius: 8,
        padding: "14px 16px 16px", background: UI.surface,
      }}>
        <div style={{
          fontSize: 14, fontWeight: 600, color: UI.ink, fontFamily: FONT,
          marginBottom: 12,
        }}>
          {box.title}
        </div>
        {items.map((it, i) => {
          const g = byId[it.id];
          return (
            <div key={g.id} style={{ marginBottom: i < items.length - 1 ? 16 : 0 }}>
              <div style={{
                fontSize: 12, fontWeight: 600, color: UI.muted, fontFamily: FONT,
                marginBottom: 8,
              }}>
                {it.sub}
              </div>
              {g.options.length ? (
                <HardwareTiles group={g} value={config[g.id]} onChange={v => set(g.id, v)} />
              ) : (
                <div style={{ maxWidth: 320 }}>
                  <Select id={`${idPrefix}-${g.id}`} group={g} value={config[g.id]} onChange={v => set(g.id, v)} />
                </div>
              )}
              {hardwareNeedsText(config[g.id]) && (
                <div style={{ marginTop: 10, maxWidth: 340 }}>
                  <Input
                    id={`${idPrefix}-${g.id}-text`} value={config[`${g.id}Text`]}
                    onChange={v => set(`${g.id}Text`, v)}
                    placeholder={`Describe the ${g.label.toLowerCase()} required`}
                  />
                </div>
              )}
              {renderExtra?.(g.id)}
            </div>
          );
        })}
      </div>
    );
  });
}

// Frame choices as photo tiles — the same floating-panel look as the
// gallery cards, at tile scale: photograph on top, the label panel
// pulled up over it, the glyph badge riding the seam. The photo area
// keeps the photographs' own 4:3 shape so a full elevation shows the
// frame around the opening, not a strip of leaf. Used by the quick
// spec, the guided flow and the pricer's cards layout; the pricer's
// plain mode keeps its chips.
export function FrameCards({ frames, value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Frame" className="qs-frames">
      {frames.map(f => {
        const on = value === f.id;
        return (
          <button
            key={f.id} type="button" role="radio" aria-checked={on}
            onClick={() => onChange(f.id)}
            style={{
              position: "relative", padding: 0,
              display: "flex", flexDirection: "column", textAlign: "left",
              fontFamily: FONT, background: UI.surface,
              border: `1px solid ${on ? UI.accent : "#D8E0EA"}`,
              borderRadius: 6,
              boxShadow: on ? `inset 0 0 0 1px ${UI.accent}` : "none",
              cursor: "pointer",
            }}
          >
            <span aria-hidden="true" style={{
              position: "relative", display: "block", width: "100%",
              aspectRatio: "4 / 3",
              flexShrink: 0, background: "#F4F6F8",
              borderRadius: "5px 5px 0 0", overflow: "hidden",
            }}>
              <TilePhoto src={framePhotoFor(f.id)?.src} position={framePhotoFor(f.id)?.position} />
            </span>
            <span style={{
              position: "relative", marginTop: -10, width: "100%", flex: 1,
              display: "flex", alignItems: "center", gap: 9,
              padding: "6px 11px 8px",
              background: on ? QS.selected : UI.surface,
              borderRadius: "8px 8px 5px 5px",
            }}>
              <span aria-hidden="true" style={{
                width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                marginTop: -19,
                display: "grid", placeItems: "center",
                background: "#FFFFFF", border: "1px solid #D8E0EA",
                boxShadow: "0 1px 4px rgba(15, 23, 42, 0.10)",
                color: UI.accent,
              }}>
                <span style={{ display: "inline-flex", transform: "scale(0.85)" }}>
                  <FrameGlyph id={f.id} />
                </span>
              </span>
              <span style={{
                fontSize: 13, fontWeight: on ? 600 : 500, lineHeight: 1.25, color: QS.ink,
              }}>
                {f.label}
              </span>
            </span>
            {on && (
              <span aria-hidden="true" style={{
                position: "absolute", top: -7, right: -7,
                width: 19, height: 19, borderRadius: "50%",
                background: UI.accent, color: "#FFFFFF",
                display: "grid", placeItems: "center",
                border: "2px solid #FFFFFF",
              }}>
                {ICONS.check}
              </span>
            )}
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

  // In cards layout the questions sit on a shared three-column grid,
  // so answers line up from section to section instead of wrapping at
  // whatever width the chips happen to have. Short either/or questions
  // render as one joined segmented control.
  const sectionStyle = cards ? { ...cardStyle, marginBottom: 16 } : { marginBottom: 30 };
  const pairRow = cards
    ? undefined
    : { display: "flex", gap: 22, flexWrap: "wrap" };
  const Head = ({ icon, hint, children }) => cards
    ? <CardTitle icon={icon} hint={hint}>{children}</CardTitle>
    : <SectionTitle hint={hint}>{children}</SectionTitle>;

  const fireRatedField = (
    <Field label="Fire rated" width={cards ? undefined : 150} auto={cards}>
      <Chips segmented={cards}
        name="Fire rated" value={config.fireRated}
        onChange={v => { set("fireRated", v); set("minutes", v ? null : 0); }}
        options={[{ value: false, label: "No" }, { value: true, label: "Yes" }]}
      />
    </Field>
  );
  const howLongField = rated && (
    <Field label="How long" auto={cards}>
      <Chips segmented={cards}
        name="Fire rating" value={minutes} onChange={v => set("minutes", v)}
        options={fireRatings().filter(m => m > 0).map(m => ({ value: m, label: `${m} min` }))}
      />
    </Field>
  );
  const leavesField = (
    <Field label="Leaves" width={cards ? undefined : 150} auto={cards}>
      <Chips segmented={cards}
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
  );
  const performanceField = (
    <Field label="Performance" auto={cards}>
      <Chips segmented={cards}
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
  );

  return (
    <>
      <section style={sectionStyle}>
        <Head icon={ICONS.door} hint="A fire rated doorset is classified for both integrity and insulation.">
          Doorset
        </Head>
        {cards ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px 32px", alignItems: "flex-start" }}>
            {fireRatedField}
            {howLongField}
            {leavesField}
            {performanceField}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={pairRow}>
              {fireRatedField}
              {howLongField}
            </div>
            <div style={pairRow}>
              {leavesField}
              {performanceField}
            </div>
          </div>
        )}
      </section>

      <section style={sectionStyle}>
        <Head
          icon={ICONS.opening}
          hint={limits
            ? `Approved from ${limits.minWidth} × ${limits.minHeight} mm to ${limits.maxWidth} × ${limits.maxHeight} mm.`
            : "The approved sizes follow from the doorset, where it goes and the frame."}
        >
          Opening
        </Head>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={pairRow} className={cards ? "qs-3col" : undefined}>
              <Field label="Where it goes" width={cards ? undefined : 220}>
                <Chips segmented={cards}
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
                <Chips segmented={cards}
                  name="Handing" value={config.handing} onChange={v => set("handing", v)}
                  options={[{ value: "left", label: "Left hand" }, { value: "right", label: "Right hand" }]}
                />
              </Field>
              {cards && (
                <Field label="Opening size (mm)">
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      id={`${idPrefix}-width`} aria-label="Width (mm)" placeholder="1000"
                      value={config.width || ""} onChange={e => set("width", mmDigits(e.target.value))}
                      style={{ ...fieldStyle, flex: "1 1 0", minWidth: 82, padding: "10px 12px", fontSize: 13 }} className="mf-field"
                    />
                    <span aria-hidden="true" style={{ color: QS.muted, fontSize: 13 }}>×</span>
                    <input
                      id={`${idPrefix}-height`} aria-label="Height (mm)" placeholder="2100"
                      value={config.height || ""} onChange={e => set("height", mmDigits(e.target.value))}
                      style={{ ...fieldStyle, flex: "1 1 0", minWidth: 82, padding: "10px 12px", fontSize: 13 }} className="mf-field"
                    />
                  </div>
                </Field>
              )}
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

            {!cards && (
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
        <Head icon={ICONS.hardware} hint="Nothing is fitted unless you ask for it, apart from the lock, cylinder and hinges.">
          Hardware
        </Head>

          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {HARDWARE_SECTIONS.map(section => {
              const groups = section.ids.map(id => byId[id]).filter(Boolean);
              if (!groups.length) return null;
              // In cards layout the handle questions leave the dropdown
              // grid and render as their own bordered boxes below it.
              const fieldGroups = cards ? groups.filter(g => !HANDLE_TILE_IDS.has(g.id)) : groups;
              const hasHandles = cards && groups.some(g => HANDLE_TILE_IDS.has(g.id));
              return (
                <div key={section.title}>
                  <div style={{
                    fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
                    color: UI.ink, marginBottom: 8,
                  }}>
                    {section.title}
                  </div>
                  {fieldGroups.length > 0 && (
                  <div style={cards
                    ? { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "16px 14px" }
                    : { display: "flex", gap: 14, flexWrap: "wrap" }
                  }>
                    {fieldGroups.map(g => (
                      <div key={g.id} style={cards ? { minWidth: 0 } : { flex: "1 1 220px", minWidth: 200, maxWidth: 320 }}>
                        <Field label={g.label}>
                          <Select id={`${idPrefix}-${g.id}`} group={g} value={config[g.id]} onChange={v => set(g.id, v)} tall={cards} />
                          {g.id === "lock" && <LockInfo value={config.lock} />}
                          {hardwareNeedsText(config[g.id]) && (
                            <div style={{ marginTop: 8 }}>
                              <Input
                                id={`${idPrefix}-${g.id}-text`} value={config[`${g.id}Text`]}
                                onChange={v => set(`${g.id}Text`, v)}
                                placeholder={`Describe the ${g.label.toLowerCase()} required`}
                                tall={cards}
                              />
                            </div>
                          )}
                        </Field>
                      </div>
                    ))}
                  </div>
                  )}
                  {hasHandles && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
                      <HandleGroups byId={byId} config={config} set={set} idPrefix={idPrefix} />
                    </div>
                  )}
                </div>
              );
            })}
            <div>
              <div style={{
                fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
                color: UI.ink, marginBottom: 8,
              }}>
                Finish
              </div>
              <div style={{ maxWidth: 220 }}>
                <Field label="Colour (RAL)">
                  <Input id={`${idPrefix}-ral`} value={config.ral} onChange={v => set("ral", v)} placeholder="7016" tall={cards} />
                </Field>
              </div>
            </div>
          </div>
      </section>
    </>
  );
}
