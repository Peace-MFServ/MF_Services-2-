'use client'
import { useState, useCallback, useEffect } from "react";
import SpecGenerator from "./SpecGenerator";
import CablePlanConfigurator from "./CablePlanConfigurator";
import QuickSpec from "./QuickSpec";
import { PRODUCT_ART, CABLE_ART, CableSingleArt } from "./ProductIllustrations";
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
  { id: "hold-open", label: "Hold-open system", summary: "Free-swing and hold-open closers with detection, for fire and smoke doors." },
  { id: "sliding-operator", label: "Sliding operator", summary: "Automatic sliding door drive with safety sensors." },
];

const STORAGE_KEY = "mf-specification-tool-selection";
const MODE_KEY = "mf-specification-tool-mode";

/** Guided walks you through it; quick puts the whole thing on one
 *  screen for someone who specifies these every week. */
function ModeSwitch({ mode, onChange }) {
  const opts = [
    { id: "guided", label: "Guided", title: "Step by step, with the drawing beside you" },
    { id: "quick", label: "Quick spec", title: "Everything on one screen" },
  ];
  return (
    <div role="radiogroup" aria-label="Layout" style={{ display: "flex", flexShrink: 0 }}>
      {opts.map((o, i) => {
        const on = mode === o.id;
        return (
          <button
            key={o.id} type="button" role="radio" aria-checked={on} title={o.title}
            onClick={() => onChange(o.id)}
            style={{
              padding: "7px 14px", fontSize: 12.5, fontWeight: on ? 600 : 400, fontFamily: FONT,
              border: `1px solid ${on ? UI.accent : UI.ruleStrong}`,
              background: on ? UI.accent : UI.surface,
              color: on ? "#FFFFFF" : UI.body,
              cursor: "pointer", marginLeft: i === 0 ? 0 : -1,
              position: "relative", zIndex: on ? 1 : 0, whiteSpace: "nowrap",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
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
            art={(() => { const Art = CABLE_ART[sys.id]; return Art ? <Art /> : null; })()}
            label={sys.label}
            summary={sys.summary}
            onSelect={() => onChoose({ kind: "cable", id: sys.id })}
          />
        ))}
        {CABLE_COMING_SOON.map(sys => (
          <Card
            key={sys.id}
            art={<CableSingleArt />}
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
  const [mode, setMode] = useState("guided");
  const restored = useRestoredSelection(setSelection, setMode);

  const chooseMode = useCallback(m => {
    setMode(m);
    try { window.sessionStorage.setItem(MODE_KEY, m); } catch { /* best-effort */ }
  }, []);

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

  // The cable plan is a checklist already — the quick layout is for
  // doorsets, where the guided flow is the slow part.
  if (selection.kind === "cable") {
    return <CablePlanConfigurator startSystemId={selection.id} onChangeSystem={clear} />;
  }

  const modeSwitch = <ModeSwitch mode={mode} onChange={chooseMode} />;

  if (mode === "quick") {
    return <QuickSpec productTypeId={selection.id} onChangeProduct={clear} modeSwitch={modeSwitch} />;
  }
  return <SpecGenerator startProductId={selection.id} onChangeProduct={clear} modeSwitch={modeSwitch} />;
}

/** Bring back what was being specified before a refresh. */
function useRestoredSelection(setSelection, setMode) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    try {
      const savedMode = window.sessionStorage.getItem(MODE_KEY);
      if (savedMode === "quick" || savedMode === "guided") setMode(savedMode);
    } catch { /* best-effort */ }
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
  }, [setSelection, setMode]);
  return done;
}
