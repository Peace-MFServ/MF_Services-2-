'use client'
import { useState, useCallback, useEffect } from "react";
import SpecGenerator from "./SpecGenerator";
import CablePlanConfigurator from "./CablePlanConfigurator";
import QuickSpec from "./QuickSpec";
import SteelDoorSpec from "./SteelDoorSpec";
import SteelQuickSpec from "./SteelQuickSpec";
import { useAuth } from "./AuthProvider";
import { SaveProjectButton } from "./SavedProjects";
import { writeWorkingState, workingKeyFor } from "../lib/projects";
import { useProjects } from "./ProjectsProvider";
import { PRODUCT_ART, CABLE_ART, CableSingleArt } from "./ProductIllustrations";
import ProductPhoto, { PRODUCT_PHOTOS, CABLE_PHOTOS } from "./ProductPhoto";
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

// ─── The flow rule ────────────────────────────────────────────────
// One piece of memory decides where you are: the selection blob,
// {kind, id, mode}. Entering a product from the chooser always
// starts guided, on the first step — the answers resume, the place
// in the flow does not. The mode lives inside the blob, so leaving
// the product (Change product, the logo) forgets it too; only a
// mid-spec refresh brings it back. Saved projects open guided.
// ──────────────────────────────────────────────────────────────────
const STORAGE_KEY = "mf-specification-tool-selection";

/** A fresh entry starts at the first step; the answers stay. The
 *  tools clamp the step up themselves where step 0 is the chooser. */
function resetWorkingStep(kind, selectionId) {
  try {
    const key = workingKeyFor(kind, selectionId);
    if (!key) return;
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (typeof saved.currentStep === "number" && saved.currentStep !== 0) {
      saved.currentStep = 0;
      window.sessionStorage.setItem(key, JSON.stringify(saved));
    }
  } catch { /* best-effort */ }
}

/** Guided walks you through it; quick puts the whole thing on one
 *  screen for someone who specifies these every week. */
function ModeSwitch({ mode, onChange, locked }) {
  const opts = [
    { id: "guided", label: "Guided", title: "Step by step, with the drawing beside you" },
    {
      id: "quick", label: "Quick spec",
      title: locked ? "Sign in to use the quick layout" : "Everything on one screen",
      locked,
    },
  ];
  return (
    <div role="radiogroup" aria-label="Layout" style={{ display: "flex", flexShrink: 0 }}>
      {opts.map((o, i) => {
        const on = mode === o.id;
        return (
          <button
            key={o.id} type="button" role="radio" aria-checked={on} title={o.title}
            onClick={() => onChange(o.id)}
            aria-describedby={o.locked ? "mode-locked" : undefined}
            style={{
              padding: "9px 18px", fontSize: 13.5, fontWeight: on ? 600 : 500, fontFamily: FONT,
              border: `1px solid ${on ? UI.accent : UI.ruleStrong}`,
              // The unselected half sits on a tint so the pair reads as
              // one control rather than fading into the header.
              background: on ? UI.accent : UI.sunken,
              color: on ? "#FFFFFF" : UI.ink,
              cursor: "pointer", marginLeft: i === 0 ? 0 : -1,
              position: "relative", zIndex: on ? 1 : 0, whiteSpace: "nowrap",
            }}
          >
            {o.label}
            {o.locked && (
              <svg width="11" height="13" viewBox="0 0 11 13" aria-hidden="true"
                style={{ marginLeft: 7, verticalAlign: "-2px" }}>
                <path d="M2.4 5.5V3.6a3.1 3.1 0 0 1 6.2 0v1.9" fill="none" stroke="currentColor" strokeWidth="1.3" />
                <rect x="1" y="5.5" width="9" height="6.6" rx="1" fill="currentColor" />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}

// The badge glyph — a door standing ajar in its frame, drawn to read
// inside the round badge on every gallery card.
const doorStroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };
const DOOR_GLYPH = (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
    <path {...doorStroke} d="M3 20.5h18 M5.5 20.5V4h9v16.5 M14.5 4l4.5 2.2v14.3" />
    <circle cx="17" cy="13.2" r="0.9" fill="currentColor" stroke="none" />
  </svg>
);

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
        border: `1px solid ${lift ? UI.ruleStrong : "#D8E0EA"}`,
        borderRadius: 10,
        boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)",
        cursor: live ? "pointer" : "not-allowed",
        transition: "border-color 120ms, transform 120ms",
        transform: lift ? "translateY(-2px)" : "none",
        overflow: "hidden",
      }}
    >
      <div style={{
        position: "relative", width: "100%", height: 240, flexShrink: 0,
        background: "#F4F6F8",
        opacity: live ? 1 : 0.78,
      }}>
        {art}
        {!live && (
          <span style={{
            position: "absolute", top: 10, right: 10,
            background: UI.ink, color: "#FFFFFF",
            fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase",
            padding: "4px 8px",
          }}>
            Coming soon
          </span>
        )}
      </div>
      {/* The white panel floats up over the photo, and the badge
          floats up again over both — the mf navy lives in the icon,
          the name and the chevron rather than a solid plate. */}
      <div style={{
        position: "relative", marginTop: -12, flex: 1,
        display: "flex", alignItems: "flex-start", gap: 13,
        padding: "14px 18px 15px",
        background: UI.surface, borderRadius: "10px 10px 0 0",
      }}>
        <span aria-hidden="true" style={{
          width: 48, height: 48, borderRadius: "50%", flexShrink: 0,
          marginTop: -28,
          display: "grid", placeItems: "center",
          background: "#FFFFFF", border: "1px solid #D8E0EA",
          boxShadow: "0 2px 6px rgba(15, 23, 42, 0.08)",
          color: live ? UI.accent : UI.muted,
        }}>
          {DOOR_GLYPH}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em",
            color: live ? UI.accent : UI.muted, lineHeight: 1.25,
          }}>
            {label}
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 13, lineHeight: 1.45, color: UI.body }}>
            {summary}
          </p>
        </div>
        {live && (
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"
            style={{ flexShrink: 0, color: UI.accent, alignSelf: "center" }}>
            <path fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
          </svg>
        )}
      </div>
    </button>
  );
}

function Group({ title, note, children }) {
  return (
    <section style={{ marginBottom: 38 }}>
      <h2 style={{
        margin: "0 0 3px", fontSize: 13, fontWeight: 700, letterSpacing: "0.07em",
        textTransform: "uppercase", color: UI.ink, fontFamily: FONT,
      }}>
        {title}
      </h2>
      <p style={{ margin: "0 0 18px", fontSize: 13, lineHeight: 1.5, color: UI.body, maxWidth: 620 }}>
        {note}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(266px, 1fr))", gap: 16 }}>
        {children}
      </div>
    </section>
  );
}

function Chooser({ onChoose }) {
  return (
    <div style={{ padding: "20px 32px 28px", fontFamily: FONT }}>
      <Group title="Doorsets" note="Fire-rated doorsets, specified against their approved sizes.">
        {PRODUCT_TYPES.map(pt => {
          const Art = PRODUCT_ART[pt.id];
          return (
            <Card
              key={pt.id}
              art={<ProductPhoto photo={PRODUCT_PHOTOS[pt.id]} fallback={Art ? <Art /> : null} />}
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
            art={<ProductPhoto
              photo={CABLE_PHOTOS[sys.id]}
              fallback={(() => { const Art = CABLE_ART[sys.id]; return Art ? <Art /> : null; })()}
            />}
            label={sys.label}
            summary={sys.summary}
            onSelect={() => onChoose({ kind: "cable", id: sys.id })}
          />
        ))}
        {CABLE_COMING_SOON.map(sys => (
          <Card
            key={sys.id}
            art={<ProductPhoto photo={CABLE_PHOTOS[sys.id]} fallback={<CableSingleArt />} />}
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
  // The saved project currently open, so Save can overwrite it rather
  // than making a second copy every time.
  const [openProject, setOpenProject] = useState(null);
  const restored = useRestoredSelection(setSelection, setMode);
  const { ready, signedIn, promptSignIn } = useAuth();
  const { pendingOpen, consumeOpen } = useProjects();

  const chooseMode = useCallback(m => {
    // The quick layout belongs to account holders. Asking to sign in
    // beats hiding it — it is the clearest reason to have an account.
    if (m === "quick" && !signedIn) { promptSignIn(); return; }
    setMode(m);
    // The mode rides inside the selection blob, so it lives and dies
    // with this visit to the product.
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...JSON.parse(raw), mode: m }));
      }
    } catch { /* best-effort */ }
  }, [signedIn, promptSignIn]);

  // Signing out drops straight back to the guided layout, including
  // when a stored preference says otherwise.
  const effectiveMode = signedIn ? mode : "guided";

  /** Enter a product fresh: guided, first step, answers intact. */
  const choose = useCallback(sel => {
    setSelection(sel);
    setMode("guided");
    resetWorkingStep(sel.kind, sel.id);
    try { window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...sel, mode: "guided" })); } catch { /* best-effort */ }
  }, []);

  const clear = useCallback(() => {
    setSelection(null);
    setOpenProject(null);
    setMode("guided");
    try { window.sessionStorage.removeItem(STORAGE_KEY); } catch { /* best-effort */ }
  }, []);

  const openProjectRecord = useCallback(record => {
    writeWorkingState(record.kind, record.selectionId, record.payload);
    setOpenProject({ id: record.id, name: record.name });
    choose({ kind: record.kind, id: record.selectionId });
  }, [choose]);

  useEffect(() => {
    if (!pendingOpen) return;
    openProjectRecord(pendingOpen);
    consumeOpen();
  }, [pendingOpen, openProjectRecord, consumeOpen]);

  // Wait for the restore pass before painting, so a refresh does not
  // flash the chooser on its way back to where the customer was.
  if (!restored) return <div style={{ minHeight: "calc(100vh - 62px)" }} />;

  if (!selection) return <Chooser onChoose={choose} />;

  const saveButton = (
    <SaveProjectButton
      kind={selection.kind}
      selectionId={selection.id}
      openProject={openProject}
      onSaved={saved => setOpenProject(saved)}
    />
  );

  // The cable plan is a checklist already — the quick layout is for
  // doorsets, where the guided flow is the slow part.
  if (selection.kind === "cable") {
    return <CablePlanConfigurator startSystemId={selection.id} onChangeSystem={clear} saveButton={saveButton} />;
  }

  const modeSwitch = (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <ModeSwitch mode={effectiveMode} onChange={chooseMode} locked={ready && !signedIn} />
      {saveButton}
    </div>
  );

  // Steel doorsets run their own flow — what the doorset IS decides
  // which frames, exposures and sizes exist, so the questions differ
  // from the riser doors. Both layouts are theirs alone, and both sit
  // on one shared piece of state.
  if (selection.id === "steel-doors") {
    const steelSwitch = <ModeSwitch mode={effectiveMode} onChange={chooseMode} locked={ready && !signedIn} />;
    return effectiveMode === "quick"
      ? <SteelQuickSpec onChangeProduct={clear} modeSwitch={steelSwitch} saveButton={saveButton} />
      : <SteelDoorSpec onChangeProduct={clear} modeSwitch={steelSwitch} saveButton={saveButton} />;
  }

  if (effectiveMode === "quick") {
    const plainSwitch = <ModeSwitch mode={effectiveMode} onChange={chooseMode} locked={ready && !signedIn} />;
    return <QuickSpec productTypeId={selection.id} onChangeProduct={clear} modeSwitch={plainSwitch} saveButton={saveButton} />;
  }
  return <SpecGenerator startProductId={selection.id} onChangeProduct={clear} modeSwitch={modeSwitch} />;
}

/** Bring back what was being specified before a refresh — selection
 *  and mode together, from the one blob. */
function useRestoredSelection(setSelection, setMode) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    try {
      // The mode used to live under its own immortal key; forget any
      // leftover so old sessions cannot haunt new visits.
      window.sessionStorage.removeItem("mf-specification-tool-mode");
    } catch { /* best-effort */ }
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        const valid = saved?.kind === "door"
          ? PRODUCT_TYPES.some(p => p.id === saved.id && p.available)
          : CABLE_SYSTEMS.some(s => s.id === saved?.id);
        if (valid) {
          setSelection({ kind: saved.kind, id: saved.id });
          if (saved.mode === "quick" || saved.mode === "guided") setMode(saved.mode);
        }
      }
    } catch { /* corrupt or unavailable storage is not worth breaking the tool over */ }
    setDone(true);
  }, [setSelection, setMode]);
  return done;
}
