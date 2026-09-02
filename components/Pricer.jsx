'use client'
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./AuthProvider";
import { listProjects } from "../lib/projects";
import { SaveProjectButton } from "./SavedProjects";
import {
  resolveSteelDoor, describeSteelDoor, hardwareGroupsFor,
  hardwareNeedsText, validateSteelDoor,
} from "../lib/steelDoor";
import { useDoorsetConfig, initialConfig } from "./steelSpecState";
import { buildQuote, DEFAULT_MARGIN, MIN_MEN, MAX_DISCOUNT, LABOUR_RATE } from "../lib/quote";
import SteelDoorsetFields from "./SteelDoorsetFields";
import { UI, FONT, fieldStyle, cardStyle } from "../lib/theme";
import { QS, CardTitle, ICONS } from "./quickSpecUI";

// ─────────────────────────────────────────────────────────────────
// Pricer — MF Services staff only
// ─────────────────────────────────────────────────────────────────
// The in-house estimator that replaces the DFM spreadsheet. A quote is
// a schedule of doorsets: each line is a configured doorset and how
// many of it, and the numbers come back from the server — the cost
// list is never in the page.
//
// Nothing here is trusted to keep the prices private. The tab is
// hidden from anyone who is not staff, but the endpoint checks for
// itself, so hiding it is a courtesy rather than the protection.
// ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = "mf-pricer-v1";
const WORKING_KEY = "mf-steel-spec-v1";

const money = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" });
const pct = v => String(v).replace(/[^\d.]/g, "").slice(0, 5);

let nextId = 1;
const lineId = () => `line-${nextId++}-${Math.random().toString(36).slice(2, 7)}`;

// ─── Primitives ───────────────────────────────────────────────────

/** The tab paints its own canvas, like the specification tool. */
function Shell({ children }) {
  return (
    <div className="mf-rounded" style={{
      background: QS.bg, borderTop: `1px solid ${UI.rule}`,
      minHeight: "calc(100vh - 62px)", fontFamily: FONT, color: UI.body,
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 28px 60px" }}>
        {children}
      </div>
    </div>
  );
}

function Button({ onClick, children, primary, disabled, icon }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        padding: primary ? "11px 20px" : "8px 14px",
        fontSize: primary ? 13.5 : 12.5, fontWeight: primary ? 600 : 500, fontFamily: FONT,
        border: `1px solid ${disabled ? UI.ruleStrong : primary ? UI.accent : "#CBD5E1"}`,
        background: disabled ? UI.sunken : primary ? UI.accent : UI.surface,
        color: disabled ? UI.muted : primary ? "#FFFFFF" : UI.body,
        cursor: disabled ? "not-allowed" : "pointer", whiteSpace: "nowrap",
      }}
    >
      {icon && (
        <span aria-hidden="true" style={{ display: "inline-flex", color: disabled ? UI.muted : primary ? "#FFFFFF" : UI.accent }}>
          {icon}
        </span>
      )}
      {children}
    </button>
  );
}

function SmallInput({ id, value, onChange, width = 78, align = "right", placeholder }) {
  return (
    <input
      id={id} value={value ?? ""} placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      style={{ ...fieldStyle, width, padding: "6px 8px", fontSize: 12.5, textAlign: align }} className="mf-field"
    />
  );
}

// ─── A line of the schedule ───────────────────────────────────────

/** What still has to be answered before this line can carry a price. */
function outstanding(line) {
  const gaps = [];
  const { config } = line;
  if (/^embracing/.test(config.frameId ?? "") && !config.wallThickness) {
    gaps.push({ field: "wallThickness", label: "Wall thickness" });
  }
  for (const g of hardwareGroupsFor(config)) {
    if (hardwareNeedsText(config[g.id]) && !Number.isFinite(Number(config[`${g.id}Price`]))) {
      gaps.push({ field: `${g.id}Price`, label: g.label });
    }
  }
  return gaps;
}

function Line({ line, onChange, onEdit, onRemove }) {
  const [open, setOpen] = useState(false);
  const resolution = resolveSteelDoor(line.config);
  const priced = line.priced;
  const gaps = outstanding(line);
  const qty = Number(line.quantity) || 0;

  const setConfig = (key, value) => onChange({ ...line, config: { ...line.config, [key]: value } });

  const unit = priced?.total ?? null;
  const lineTotal = unit == null ? null : unit * qty;

  return (
    <div style={{ borderBottom: `1px solid ${UI.rule}`, fontFamily: FONT }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "13px 0" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: UI.ink }}>{line.name}</div>
          <div style={{ fontSize: 12.5, color: UI.body, marginTop: 3, lineHeight: 1.45 }}>
            {resolution.type ? describeSteelDoor(resolution.type) : "Not a doorset we make"}
            {line.config.width && line.config.height && ` · ${line.config.width} × ${line.config.height} mm`}
            {resolution.frame && ` · ${resolution.frame.label} frame`}
          </div>
          <button
            type="button" onClick={() => setOpen(o => !o)}
            style={{
              background: "none", border: "none", padding: "5px 0 0", fontFamily: FONT,
              fontSize: 12.5, color: UI.accent, textDecoration: "underline", cursor: "pointer",
            }}
          >
            {open ? "Hide the breakdown" : "Show the breakdown"}
          </button>
        </div>

        <div style={{ flexShrink: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: UI.muted, marginBottom: 5 }}>
            Qty
          </div>
          <SmallInput
            id={`${line.id}-qty`} value={line.quantity} width={62} align="center"
            onChange={v => onChange({ ...line, quantity: v.replace(/\D/g, "").slice(0, 4) })}
          />
        </div>

        <div style={{ flexShrink: 0, width: 108, textAlign: "right" }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: UI.muted, marginBottom: 5 }}>
            Each
          </div>
          <div style={{ fontSize: 13.5, color: UI.ink, paddingTop: 5 }}>
            {line.pricing ? "…" : unit == null ? "—" : money.format(unit)}
          </div>
        </div>

        <div style={{ flexShrink: 0, width: 118, textAlign: "right" }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: UI.muted, marginBottom: 5 }}>
            Line
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: UI.ink, paddingTop: 4 }}>
            {lineTotal == null ? "on application" : money.format(lineTotal)}
          </div>
        </div>

        <div style={{ flexShrink: 0, marginTop: 22, display: "flex", gap: 6 }}>
          <button
            type="button" onClick={onEdit} aria-label={`Edit ${line.name}`}
            style={{
              padding: "5px 10px", fontSize: 12, fontFamily: FONT,
              border: `1px solid ${UI.ruleStrong}`, background: UI.surface, color: UI.body, cursor: "pointer",
            }}
          >
            Edit
          </button>
          <button
            type="button" onClick={onRemove} aria-label={`Remove ${line.name}`}
            style={{
              padding: "5px 10px", fontSize: 12, fontFamily: FONT,
              border: `1px solid ${UI.ruleStrong}`, background: UI.surface, color: UI.muted, cursor: "pointer",
            }}
          >
            Remove
          </button>
        </div>
      </div>

      {gaps.length > 0 && (
        <div style={{ padding: "0 0 14px", display: "flex", gap: 16, flexWrap: "wrap" }}>
          {gaps.map(g => (
            <div key={g.field}>
              <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: UI.warn, marginBottom: 5 }}>
                {g.label}{g.field === "wallThickness" ? " (mm)" : " price"}
              </div>
              <SmallInput
                id={`${line.id}-${g.field}`}
                value={line.config[g.field]}
                placeholder={g.field === "wallThickness" ? "200" : "0.00"}
                onChange={v => setConfig(g.field, v.replace(/[^\d.]/g, "").slice(0, 8))}
              />
            </div>
          ))}
        </div>
      )}

      {open && (
        <div style={{ padding: "0 0 16px" }}>
          {priced?.lines?.length ? priced.lines.map((l, i) => (
            <div key={`${l.label}-${i}`} style={{
              display: "flex", justifyContent: "space-between", gap: 14,
              padding: "5px 0", fontSize: 12.5, color: UI.body,
              borderBottom: `1px solid ${UI.rule}`,
            }}>
              <span>
                {l.label}
                {l.detail && <span style={{ color: UI.muted }}> · {l.detail}</span>}
              </span>
              <span style={{ fontWeight: 600, color: l.amount == null ? UI.warn : UI.ink, whiteSpace: "nowrap" }}>
                {l.amount == null ? "on application" : money.format(l.amount)}
              </span>
            </div>
          )) : (
            <p style={{ margin: 0, fontSize: 12.5, color: UI.muted }}>
              {line.error ?? "Nothing priced yet."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Configuring a doorset ────────────────────────────────────────

/** The same questions the specification tool asks, asked here, so the
 *  estimator never has to go somewhere else and come back. */
function DoorsetEditor({ initial, initialName, onCancel, onDone, existing, saveButton, onDraft }) {
  const { config, set, resolution } = useDoorsetConfig(initial ?? initialConfig());
  const [name, setName] = useState(initialName ?? "");
  const validation = validateSteelDoor(config);
  const ready = validation.isValid;

  // The quote's Save lives on this screen too, and it should save what
  // is being configured — so the draft is reported up as it changes.
  useEffect(() => {
    onDraft?.({ config, name: name.trim(), ready });
  }, [onDraft, config, name, ready]);

  return (
    <div style={{ fontFamily: FONT }}>
      <div style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
        gap: 16, flexWrap: "wrap", marginBottom: 20,
      }}>
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: "-0.015em", color: QS.ink }}>
          {existing ? "Edit doorset" : "New doorset"}
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {saveButton}
          <Button onClick={onCancel}>Cancel</Button>
        </div>
      </div>

      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ maxWidth: 340 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
            color: QS.muted, marginBottom: 6,
          }}>
            Reference
          </div>
          <input
            id="pricer-line-name" value={name} placeholder="e.g. D-01, ground floor plant room"
            onChange={e => setName(e.target.value)}
            style={{ ...fieldStyle, padding: "10px 12px", fontSize: 13 }} className="mf-field"
          />
        </div>
      </div>

      {/* The action bar is pinned to the foot of the window, so the
          form is given room to clear it rather than ending underneath. */}
      <div style={{ paddingBottom: 96 }}>
        <SteelDoorsetFields config={config} set={set} resolution={resolution} idPrefix="pr" cards />
      </div>

      <div style={{
        ...cardStyle, position: "sticky", bottom: 16, marginTop: -80,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
        padding: "16px 20px", flexWrap: "wrap",
        boxShadow: "0 6px 24px rgba(15, 23, 42, 0.12)",
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: UI.ink }}>
            {resolution.type ? describeSteelDoor(resolution.type) : "No doorset yet"}
          </div>
          <div style={{ fontSize: 12.5, color: UI.muted, marginTop: 2 }}>
            {ready
              ? `${config.width} × ${config.height} mm · ${resolution.frame?.label} frame`
              : validation.errors[0]?.message ?? "Answer the questions above."}
          </div>
        </div>
        <Button primary disabled={!ready} onClick={() => onDone({ config, name: name.trim() })}>
          {ready
            ? (existing ? "Save changes" : "Add to the quote")
            : `${validation.errors.length} to fix`}
        </Button>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────

export default function Pricer({ openProject, onSavedProject }) {
  const { user, isStaff, ready } = useAuth();
  const [lines, setLines] = useState([]);
  // Margin is fixed at 40% of the selling price — the estimators
  // asked for no input on screen (the Excel export keeps its editable
  // cell). The discount can never pass 5%; labour is men × days at €450.
  const [transport, setTransport] = useState("");
  const [labourMen, setLabourMen] = useState(String(MIN_MEN));
  const [labourDays, setLabourDays] = useState("");
  const [discount, setDiscount] = useState("");
  const [project, setProject] = useState("");
  const [exporting, setExporting] = useState(null);   // null | "pdf" | "xlsx"
  const [projects, setProjects] = useState(null);
  const [notice, setNotice] = useState(null);
  const [editing, setEditing] = useState(null);   // null | { lineId, config, name }
  const [hydrated, setHydrated] = useState(false);
  const priceRef = useRef(null);
  // What the doorset editor currently has on screen, for saves made
  // from inside it.
  const draftRef = useRef(null);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved.lines)) setLines(saved.lines);
        if (saved.transport) setTransport(saved.transport);
        if (saved.labourMen) setLabourMen(saved.labourMen);
        if (saved.labourDays) setLabourDays(saved.labourDays);
        if (saved.discount) setDiscount(saved.discount);
        if (saved.project) setProject(saved.project);
      }
    } catch { /* a corrupt quote is not worth breaking the tab over */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        lines, transport, labourMen, labourDays, discount, project,
      }));
    } catch { /* best-effort */ }
  }, [hydrated, lines, transport, labourMen, labourDays, discount, project]);

  // Whatever is open in the Specification Tool, described so the offer
  // to bring it across says what it actually is.
  const [fromTool, setFromTool] = useState(null);
  useEffect(() => {
    if (editing) return;
    let saved;
    try { saved = JSON.parse(window.sessionStorage.getItem(WORKING_KEY) || "null"); } catch { saved = null; }
    const config = saved?.config;
    const type = config ? resolveSteelDoor(config).type : null;
    setFromTool(type ? {
      config,
      name: saved.projectData?.projectName?.trim() || "",
      description: `${describeSteelDoor(type)}${config.width && config.height ? `, ${config.width} × ${config.height} mm` : ""}`,
    } : null);
  }, [editing]);

  useEffect(() => {
    if (!isStaff || !user) return;
    listProjects(user.uid)
      .then(all => setProjects(all.filter(p => p.selectionId === "steel-doors")))
      .catch(() => setProjects([]));
  }, [isStaff, user]);

  /** Ask the server what a line costs. The cost list stays up there. */
  const priceLine = useCallback(async line => {
    const idToken = await user.getIdToken();
    const res = await fetch("/api/price", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, config: line.config }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}));
      throw new Error(error || "Could not price that doorset.");
    }
    return res.json();
  }, [user]);

  // Re-price whatever has changed. Lines are priced one at a time and
  // the result is matched back by id, so an edit part-way through a
  // round cannot land on the wrong line.
  const signature = lines.map(l => `${l.id}:${JSON.stringify(l.config)}`).join("~");
  useEffect(() => {
    if (!hydrated || !isStaff || !user) return;
    const stale = lines.filter(l => l.signature !== JSON.stringify(l.config));
    if (!stale.length) return;
    let cancelled = false;
    priceRef.current = stale;

    (async () => {
      for (const line of stale) {
        setLines(cur => cur.map(l => (l.id === line.id ? { ...l, pricing: true } : l)));
        try {
          const priced = await priceLine(line);
          if (cancelled) return;
          setLines(cur => cur.map(l => (l.id === line.id
            ? { ...l, priced, error: null, pricing: false, signature: JSON.stringify(line.config) }
            : l)));
        } catch (err) {
          if (cancelled) return;
          setLines(cur => cur.map(l => (l.id === line.id
            ? { ...l, priced: null, error: err.message, pricing: false, signature: JSON.stringify(line.config) }
            : l)));
        }
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, hydrated, isStaff, user]);

  const flash = msg => { setNotice(msg); setTimeout(() => setNotice(null), 4000); };

  /** Take what the editor produced, as a new line or over an old one. */
  const commit = ({ config, name }) => {
    setLines(cur => {
      if (editing?.lineId) {
        return cur.map(l => (l.id === editing.lineId
          ? { ...l, config, name: name || l.name, signature: null }
          : l));
      }
      return [...cur, {
        id: lineId(), name: name || `Doorset ${cur.length + 1}`,
        config, quantity: "1", signature: null, priced: null,
      }];
    });
    setEditing(null);
  };

  const editLine = line => setEditing({ lineId: line.id, config: line.config, name: line.name, sessionKey: lineId() });

  const addFrom = (config, name) => {
    if (!resolveSteelDoor(config).type) { flash("That doorset is not complete enough to price."); return; }
    // Opened in the editor rather than dropped straight in, so it is
    // obvious what came across and it can be adjusted before it counts.
    setEditing({ lineId: null, config, name, sessionKey: lineId() });
  };

  if (!ready) return <Shell><div style={{ minHeight: 400 }} /></Shell>;
  if (!isStaff) {
    return (
      <Shell>
        <p style={{ margin: 0, fontSize: 14, color: UI.body }}>
          Pricing is for MF Services staff.
        </p>
      </Shell>
    );
  }

  // The screen shows the same quote the downloads render — one
  // computation in lib/quote.js, three views of it.
  const quoteInputs = { lines, margin: DEFAULT_MARGIN, transport, labourMen, labourDays, discount, project };
  const q = buildQuote(quoteInputs);

  // Both files are renderings of one quote, built at the moment of
  // download so they always match the screen. The generators are
  // loaded on demand — no reason for exceljs to travel with the page.
  const download = async kind => {
    setExporting(kind);
    try {
      const quote = buildQuote(quoteInputs);
      const generate = kind === "pdf"
        ? (await import("../lib/generateQuotePDF")).generateQuotePDF
        : (await import("../lib/generateQuoteXLSX")).generateQuoteXLSX;
      await generate(quote);
    } catch {
      flash("The download failed. Try again in a moment.");
    } finally {
      setExporting(null);
    }
  };

  // The Save on the editor screen must save the doorset being
  // configured, not the quote from before it was opened. The editor
  // reports its draft; prepare() folds a finished draft into the
  // quote as a real line — the editor session becomes an edit of that
  // line, so finishing it later cannot add a duplicate — and writes
  // the working state, so the save that follows reads what is on
  // screen. A draft that is not answerable yet stays on screen and
  // the rest of the quote saves without it.
  const onDraft = useCallback(d => { draftRef.current = d; }, []);

  const prepareQuoteSave = useCallback(() => {
    const draft = draftRef.current;
    let nextLines = lines;
    if (editing && draft?.ready) {
      const id = editing.lineId ?? lineId();
      nextLines = editing.lineId
        ? lines.map(l => (l.id === id
            ? { ...l, config: draft.config, name: draft.name || l.name, signature: null }
            : l))
        : [...lines, {
            id, name: draft.name || `Doorset ${lines.length + 1}`,
            config: draft.config, quantity: "1", signature: null, priced: null,
          }];
      setLines(nextLines);
      setEditing(e => (e ? { ...e, lineId: id } : e));
    }
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        lines: nextLines, transport, labourMen, labourDays, discount, project,
      }));
    } catch { /* best-effort — the effect writes it again anyway */ }
  }, [editing, lines, transport, labourMen, labourDays, discount, project]);

  const quoteSaveButton = (
    <SaveProjectButton
      kind="quote" selectionId="pricer"
      openProject={openProject} onSaved={onSavedProject}
      prepare={prepareQuoteSave}
    />
  );

  if (editing) {
    return (
      <Shell>
        <DoorsetEditor
          key={editing.sessionKey}
          initial={editing.config}
          initialName={editing.name}
          existing={!!editing.lineId}
          onCancel={() => setEditing(null)}
          onDone={commit}
          saveButton={quoteSaveButton}
          onDraft={onDraft}
        />
      </Shell>
    );
  }

  return (
    <Shell>

      <div style={{ marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: "-0.015em", color: QS.ink }}>
            Pricer
          </h2>
          <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.55, color: UI.body, maxWidth: 640 }}>
            Build a schedule of steel doorsets and price it. Figures are ex-works
            in euro, from the manufacturer&rsquo;s October 2025 list — the same
            numbers as the spreadsheet, without the spreadsheet.
          </p>
        </div>
        {quoteSaveButton}
      </div>

      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <CardTitle icon={ICONS.project}>Project</CardTitle>
        <div style={{ marginBottom: 20, maxWidth: 340 }}>
          <input
            id="pricer-project" value={project} placeholder="e.g. Docklands Block C"
            aria-label="Project"
            onChange={e => setProject(e.target.value)}
            style={{ ...fieldStyle, padding: "10px 12px", fontSize: 13 }} className="mf-field"
          />
        </div>

        <Button primary onClick={() => setEditing({ lineId: null, config: initialConfig(), name: "", sessionKey: lineId() })}>
          Add a doorset
        </Button>

        {(fromTool || (projects ?? []).length > 0) && (
          <div style={{ marginTop: 16 }}>
            <div style={{
              fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
              color: QS.muted, marginBottom: 8,
            }}>
              Or start from one you already have
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {fromTool && (
                <Button icon={ICONS.door} onClick={() => addFrom(fromTool.config, fromTool.name)}>
                  Open in the Specification Tool — {fromTool.description}
                </Button>
              )}
              {(projects ?? []).map(p => (
                <Button key={p.id} icon={ICONS.bookmark} onClick={() => addFrom(p.payload?.config ?? {}, p.name)}>
                  Saved project — {p.name}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      {notice && (
        <div style={{
          marginBottom: 16, padding: "10px 14px", fontSize: 13, borderRadius: 8,
          border: `1px solid ${UI.ruleStrong}`, borderLeft: `3px solid ${UI.warn}`,
          background: UI.surface, color: UI.body,
        }}>
          {notice}
        </div>
      )}

      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <CardTitle
          icon={ICONS.door}
          hint={lines.length === 0
            ? "Nothing on the quote yet. Add a doorset above and it will price itself."
            : undefined}
        >
          Schedule
        </CardTitle>

        {lines.length > 0 && (
          <div>
            {lines.map(line => (
              <Line
                key={line.id} line={line}
                onChange={next => setLines(cur => cur.map(l => (l.id === next.id ? next : l)))}
                onEdit={() => editLine(line)}
                onRemove={() => setLines(cur => cur.filter(l => l.id !== line.id))}
              />
            ))}
          </div>
        )}
      </div>

      {lines.length > 0 && (
        <div style={{
          ...cardStyle,
          padding: "18px 20px", maxWidth: 460, marginLeft: "auto",
        }}>
          {/* Costs first, ruled into a subtotal; the margin divides —
              40% of the sale, subtotal ÷ 0.6 — and the discount comes
              off the lot, never more than 5%. */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 14, padding: "6px 0" }}>
            <span style={{ fontSize: 13 }}>Doorsets (cost)</span>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: UI.ink }}>{money.format(q.doorsetsCost)}</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, padding: "6px 0" }}>
            <span style={{ fontSize: 13 }}>Transport (cost)</span>
            <SmallInput id="transport" value={transport} width={96} onChange={v => setTransport(pct(v))} placeholder="0.00" />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, padding: "6px 0" }}>
            <span style={{ fontSize: 13 }}>Labour</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <SmallInput
                id="labour-men" value={labourMen} width={44} align="center" placeholder={String(MIN_MEN)}
                onChange={v => setLabourMen(v.replace(/\D/g, "").slice(0, 2))}
              />
              <span style={{ fontSize: 12, color: UI.muted }}>men ×</span>
              <SmallInput
                id="labour-days" value={labourDays} width={44} align="center" placeholder="0"
                onChange={v => setLabourDays(v.replace(/[^\d.]/g, "").slice(0, 4))}
              />
              <span style={{ fontSize: 12, color: UI.muted }}>days</span>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: UI.ink, width: 82, textAlign: "right" }}>
                {money.format(q.labour.total)}
              </span>
            </span>
          </div>

          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 14,
            padding: "9px 0 6px", marginTop: 4, borderTop: `1px solid ${UI.rule}`,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: UI.ink }}>Subtotal</span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: UI.ink }}>{money.format(q.subtotal)}</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 14, padding: "6px 0" }}>
            <span style={{ fontSize: 13 }}>Margin</span>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: UI.ink }}>
              {money.format(q.marginAmount)}
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, padding: "6px 0" }}>
            <span style={{ fontSize: 13 }}>
              Discount
              <span style={{ display: "block", fontSize: 11, color: UI.muted }}>up to {MAX_DISCOUNT}%</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <SmallInput
                id="discount" value={discount} width={62} placeholder="0"
                onChange={v => {
                  const s = pct(v);
                  setDiscount(Number(s) > MAX_DISCOUNT ? String(MAX_DISCOUNT) : s);
                }}
              />
              <span style={{ fontSize: 13, color: UI.muted }}>%</span>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: UI.ink, width: 96, textAlign: "right" }}>
                {q.discountAmount > 0 ? `−${money.format(q.discountAmount)}` : money.format(0)}
              </span>
            </span>
          </div>

          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 14,
            padding: "12px 0 0", marginTop: 8, borderTop: `1px solid ${UI.ruleStrong}`,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: UI.ink }}>
              Total (ex. VAT)
            </span>
            <span style={{ fontSize: 19, fontWeight: 700, color: UI.ink }}>{money.format(q.total)}</span>
          </div>

          <div style={{
            display: "flex", gap: 8, marginTop: 16, paddingTop: 14,
            borderTop: `1px solid ${UI.ruleStrong}`,
          }}>
            <button
              type="button" onClick={() => download("pdf")} disabled={!!exporting}
              className="qs-download"
              style={{
                flex: 1, padding: "11px 14px", fontSize: 13, fontWeight: 600, fontFamily: FONT,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                border: `1px solid ${UI.accent}`, background: UI.accent, color: "#FFFFFF",
                cursor: exporting ? "progress" : "pointer",
              }}
            >
              {exporting === "pdf" ? "Generating" : "Download PDF"}
              {exporting !== "pdf" && ICONS.download}
            </button>
            <button
              type="button" onClick={() => download("xlsx")} disabled={!!exporting}
              title="Every component on its own row, with live formulas — fill a missing price in Excel and the totals recalculate"
              style={{
                flex: 1, padding: "11px 14px", fontSize: 13, fontWeight: 600, fontFamily: FONT,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                border: `1px solid ${UI.accent}`, background: UI.surface, color: UI.accent,
                cursor: exporting ? "progress" : "pointer",
              }}
            >
              {exporting === "xlsx" ? "Generating" : "Download Excel"}
              {exporting !== "xlsx" && ICONS.download}
            </button>
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 11.5, lineHeight: 1.45, color: UI.muted }}>
            Both carry the cost breakdown — internal use only.
          </p>
        </div>
      )}
    </Shell>
  );
}
