'use client'
import { useState, useCallback, useEffect } from "react";
import SpecGenerator from "./SpecGenerator";
import CablePlanConfigurator from "./CablePlanConfigurator";
import { PRODUCT_ART } from "./ProductIllustrations";
import { PRODUCT_TYPES } from "../lib/hardwareSpec";
import { UI, FONT } from "../lib/theme";
import ets73Single from "../data/cable-systems/ets73-single-leaf.json";
import ets73Double from "../data/cable-systems/ets73-double-leaf.json";

// One tool, two kinds of specification. The customer says what they
// are specifying — a doorset or the cabling for a door system — and
// the right configurator takes it from there. Everything downstream is
// unchanged; this is the front door.

const CABLE_SYSTEMS = [ets73Single, ets73Double];

const CABLE_COMING_SOON = [
  { id: "hold-open", label: "Hold-open system", summary: "Free-swing and hold-open closers with detection, for fire and smoke doors.", leaves: 1 },
  { id: "sliding-operator", label: "Sliding operator", summary: "Automatic sliding door drive with safety sensors.", leaves: 1 },
];

const STORAGE_KEY = "mf-specification-tool-selection";

/** Miniature elevation for the cable system cards — one or two leaves
 *  under an operator band, matching the plan's own drawing style. */
function CableArt({ leaves }) {
  const openL = 14, openR = 106, top = 12, floor = 74;
  const innerL = openL + 5, innerR = openR - 5;
  const leafTop = 30;
  const leafViews = leaves === 2 ? [[innerL, 59], [61, innerR]] : [[innerL, innerR]];
  return (
    <svg viewBox="0 0 120 84" width="100%" height="100%" aria-hidden="true"
      preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
      <rect x={openL} y={top} width={openR - openL} height={floor - top} fill="#8895A3" stroke="#3C4956" strokeWidth="1" />
      <rect x={innerL} y={top + 5} width={innerR - innerL} height={floor - top - 8} fill="#FFFFFF" />
      <rect x={innerL} y={top + 5} width={innerR - innerL} height={leafTop - top - 5} fill="#FFFFFF" stroke="#3C4956" strokeWidth="0.8" />
      {leafViews.map(([l, r], i) => (
        <rect key={i} x={l} y={leafTop} width={r - l} height={floor - leafTop - 3} fill="#CBD5DF" stroke="#3C4956" strokeWidth="0.9" />
      ))}
    </svg>
  );
}

function Card({ art, label, summary, comingSoon, onSelect }) {
  const [hover, setHover] = useState(false);
  const live = !comingSoon;
  const lift = live && hover;
  return (
    <button
      type="button"
      onClick={live ? onSelect : undefined}
      disabled={!live}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", flexDirection: "column", textAlign: "left", padding: 0,
        fontFamily: FONT, background: UI.surface,
        border: `1px solid ${lift ? UI.ruleStrong : UI.rule}`,
        cursor: live ? "pointer" : "not-allowed",
        transition: "border-color 120ms, transform 120ms",
        transform: lift ? "translateY(-2px)" : "none",
        overflow: "hidden",
      }}
    >
      <div style={{
        position: "relative", width: "100%", aspectRatio: "4 / 3",
        borderBottom: `1px solid ${UI.rule}`, background: "#F4F6F8",
        opacity: live ? 1 : 0.78,
      }}>
        {art}
        {!live && (
          <span style={{
            position: "absolute", top: 10, right: 10,
            background: UI.ink, color: "#FFFFFF",
            fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase",
            padding: "4px 8px",
          }}>
            Coming soon
          </span>
        )}
      </div>
      <div style={{ padding: "14px 16px 16px", flex: 1 }}>
        <div style={{
          fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em",
          color: live ? UI.ink : UI.muted, lineHeight: 1.3,
        }}>
          {label}
        </div>
        <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.5, color: UI.body }}>
          {summary}
        </p>
      </div>
    </button>
  );
}

function Group({ title, note, children }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{
        margin: "0 0 4px", fontSize: 13, fontWeight: 700, letterSpacing: "0.07em",
        textTransform: "uppercase", color: UI.ink, fontFamily: FONT,
      }}>
        {title}
      </h2>
      <p style={{ margin: "0 0 18px", fontSize: 13.5, lineHeight: 1.5, color: UI.body, maxWidth: 620 }}>
        {note}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(266px, 1fr))", gap: 18 }}>
        {children}
      </div>
    </section>
  );
}

function Chooser({ onChoose }) {
  return (
    <div style={{ padding: "36px 32px 48px", fontFamily: FONT }}>
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", color: UI.ink, lineHeight: 1.2 }}>
        What are you specifying?
      </h1>
      <p style={{ margin: "9px 0 34px", fontSize: 15, lineHeight: 1.55, color: UI.body, maxWidth: 620 }}>
        Configure a doorset or the cabling for a door system, and take
        the specification away as a PDF.
      </p>

      <Group title="Doorsets" note="Fire-rated doorsets, specified against their approved sizes.">
        {PRODUCT_TYPES.map(pt => {
          const Art = PRODUCT_ART[pt.id];
          return (
            <Card
              key={pt.id}
              art={Art ? <Art /> : null}
              label={pt.label}
              summary={pt.summary}
              comingSoon={!pt.available}
              onSelect={() => onChoose({ kind: "door", id: pt.id })}
            />
          );
        })}
      </Group>

      <Group title="Cable plans" note="Cabling schedules for powered door systems, position by position.">
        {CABLE_SYSTEMS.map(sys => (
          <Card
            key={sys.id}
            art={<CableArt leaves={sys.leafType === "double-leaf" ? 2 : 1} />}
            label={sys.label}
            summary={sys.summary}
            onSelect={() => onChoose({ kind: "cable", id: sys.id })}
          />
        ))}
        {CABLE_COMING_SOON.map(sys => (
          <Card
            key={sys.id}
            art={<CableArt leaves={sys.leaves} />}
            label={sys.label}
            summary={sys.summary}
            comingSoon
          />
        ))}
      </Group>
    </div>
  );
}

export default function SpecificationTool() {
  const [selection, setSelection] = useState(null);
  const restored = useRestoredSelection(setSelection);

  const choose = useCallback(sel => {
    setSelection(sel);
    try { window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sel)); } catch { /* best-effort */ }
  }, []);

  const clear = useCallback(() => {
    setSelection(null);
    try { window.sessionStorage.removeItem(STORAGE_KEY); } catch { /* best-effort */ }
  }, []);

  // Wait for the restore pass before painting, so a refresh does not
  // flash the chooser on its way back to where the customer was.
  if (!restored) return <div style={{ minHeight: "calc(100vh - 136px)" }} />;

  if (!selection) return <Chooser onChoose={choose} />;

  if (selection.kind === "cable") {
    return <CablePlanConfigurator startSystemId={selection.id} onChangeSystem={clear} />;
  }
  return <SpecGenerator startProductId={selection.id} onChangeProduct={clear} />;
}

/** Bring back what was being specified before a refresh. */
function useRestoredSelection(setSelection) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        const valid = saved?.kind === "door"
          ? PRODUCT_TYPES.some(p => p.id === saved.id && p.available)
          : CABLE_SYSTEMS.some(s => s.id === saved?.id);
        if (valid) setSelection(saved);
      }
    } catch { /* corrupt or unavailable storage is not worth breaking the tool over */ }
    setDone(true);
  }, [setSelection]);
  return done;
}
