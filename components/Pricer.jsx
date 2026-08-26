'use client'
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./AuthProvider";
import { listProjects } from "../lib/projects";
import { resolveSteelDoor, describeSteelDoor, hardwareGroupsFor, hardwareNeedsText } from "../lib/steelDoor";
import { UI, FONT, fieldStyle, focusField, blurField } from "../lib/theme";

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

function Heading({ children, note }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h2 style={{
        margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em",
        textTransform: "uppercase", color: UI.ink, fontFamily: FONT,
      }}>
        {children}
      </h2>
      {note && <p style={{ margin: "5px 0 0", fontSize: 12.5, lineHeight: 1.45, color: UI.muted }}>{note}</p>}
    </div>
  );
}

function Button({ onClick, children, primary, disabled }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      style={{
        padding: primary ? "11px 20px" : "8px 14px",
        fontSize: primary ? 13.5 : 12.5, fontWeight: primary ? 600 : 400, fontFamily: FONT,
        border: `1px solid ${disabled ? UI.ruleStrong : primary ? UI.accent : UI.ruleStrong}`,
        background: disabled ? UI.sunken : primary ? UI.accent : UI.surface,
        color: disabled ? UI.muted : primary ? "#FFFFFF" : UI.body,
        cursor: disabled ? "not-allowed" : "pointer", whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

function SmallInput({ id, value, onChange, width = 78, align = "right", placeholder }) {
  return (
    <input
      id={id} value={value ?? ""} placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      style={{ ...fieldStyle, width, padding: "6px 8px", fontSize: 12.5, textAlign: align }}
      onFocus={focusField} onBlur={blurField}
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

function Line({ line, onChange, onRemove }) {
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

        <button
          type="button" onClick={onRemove} aria-label={`Remove ${line.name}`}
          style={{
            flexShrink: 0, marginTop: 22, padding: "5px 10px", fontSize: 12, fontFamily: FONT,
            border: `1px solid ${UI.ruleStrong}`, background: UI.surface, color: UI.muted, cursor: "pointer",
          }}
        >
          Remove
        </button>
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

// ─── Main ─────────────────────────────────────────────────────────

export default function Pricer() {
  const { user, isStaff, ready } = useAuth();
  const [lines, setLines] = useState([]);
  const [markup, setMarkup] = useState("");
  const [transport, setTransport] = useState("");
  const [projects, setProjects] = useState(null);
  const [notice, setNotice] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const priceRef = useRef(null);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved.lines)) setLines(saved.lines);
        if (saved.markup) setMarkup(saved.markup);
        if (saved.transport) setTransport(saved.transport);
      }
    } catch { /* a corrupt quote is not worth breaking the tab over */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ lines, markup, transport }));
    } catch { /* best-effort */ }
  }, [hydrated, lines, markup, transport]);

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

  const addLine = (config, name) => {
    const resolution = resolveSteelDoor(config);
    if (!resolution.type) { flash("That doorset is not complete enough to price."); return; }
    setLines(cur => [...cur, {
      id: lineId(), name: name || `Doorset ${cur.length + 1}`,
      config, quantity: "1", signature: null, priced: null,
    }]);
  };

  const addFromTool = () => {
    let saved;
    try { saved = JSON.parse(window.sessionStorage.getItem(WORKING_KEY) || "null"); } catch { saved = null; }
    if (!saved?.config) { flash("Nothing in the Specification Tool yet."); return; }
    addLine(saved.config, saved.projectData?.projectName?.trim() || null);
  };

  if (!ready) return <div style={{ minHeight: 400 }} />;
  if (!isStaff) {
    return (
      <div style={{ padding: "40px 0", fontFamily: FONT }}>
        <p style={{ margin: 0, fontSize: 14, color: UI.body }}>
          Pricing is for MF Services staff.
        </p>
      </div>
    );
  }

  const priceable = lines.filter(l => l.priced && !l.priced.onApplication);
  const cost = priceable.reduce((sum, l) => sum + l.priced.total * (Number(l.quantity) || 0), 0);
  const markupPct = Number(markup) || 0;
  const withMarkup = cost * (1 + markupPct / 100);
  const carriage = Number(transport) || 0;
  const total = withMarkup + carriage;
  const unpriced = lines.length - priceable.length;

  return (
    <div style={{ padding: "28px 0 60px", fontFamily: FONT, color: UI.body }}>

      <div style={{ marginBottom: 26 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", color: UI.ink }}>
          Pricer
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.55, color: UI.body, maxWidth: 640 }}>
          Build a schedule of steel doorsets and price it. Figures are ex-works
          in euro, from the manufacturer&rsquo;s October 2025 list — the same
          numbers as the spreadsheet, without the spreadsheet.
        </p>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 28 }}>
        <Button onClick={addFromTool}>Add the doorset from the Specification Tool</Button>
        {(projects ?? []).map(p => (
          <Button key={p.id} onClick={() => addLine(p.payload?.config ?? {}, p.name)}>
            Add “{p.name}”
          </Button>
        ))}
      </div>

      {notice && (
        <div style={{
          marginBottom: 20, padding: "10px 14px", fontSize: 13,
          border: `1px solid ${UI.ruleStrong}`, borderLeft: `3px solid ${UI.warn}`,
          background: UI.surface, color: UI.body,
        }}>
          {notice}
        </div>
      )}

      <Heading note={lines.length === 0 ? "Nothing on the quote yet." : undefined}>Schedule</Heading>

      {lines.length > 0 && (
        <div style={{ marginBottom: 30 }}>
          {lines.map(line => (
            <Line
              key={line.id} line={line}
              onChange={next => setLines(cur => cur.map(l => (l.id === next.id ? next : l)))}
              onRemove={() => setLines(cur => cur.filter(l => l.id !== line.id))}
            />
          ))}
        </div>
      )}

      {lines.length > 0 && (
        <div style={{
          border: `1px solid ${UI.ruleStrong}`, background: UI.sunken,
          padding: "18px 20px", maxWidth: 460, marginLeft: "auto",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 14, padding: "6px 0" }}>
            <span style={{ fontSize: 13 }}>Doorsets</span>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: UI.ink }}>{money.format(cost)}</span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, padding: "6px 0" }}>
            <span style={{ fontSize: 13 }}>Margin</span>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <SmallInput id="markup" value={markup} width={62} onChange={v => setMarkup(pct(v))} placeholder="0" />
              <span style={{ fontSize: 13, color: UI.muted }}>%</span>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: UI.ink, width: 96, textAlign: "right" }}>
                {money.format(withMarkup - cost)}
              </span>
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, padding: "6px 0" }}>
            <span style={{ fontSize: 13 }}>Transport</span>
            <SmallInput id="transport" value={transport} width={96} onChange={v => setTransport(pct(v))} placeholder="0.00" />
          </div>

          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 14,
            padding: "12px 0 0", marginTop: 8, borderTop: `1px solid ${UI.ruleStrong}`,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: UI.ink }}>
              Total
            </span>
            <span style={{ fontSize: 19, fontWeight: 700, color: UI.ink }}>{money.format(total)}</span>
          </div>

          {unpriced > 0 && (
            <p style={{ margin: "12px 0 0", fontSize: 12.5, lineHeight: 1.5, color: UI.warn }}>
              {unpriced} {unpriced === 1 ? "line is" : "lines are"} on application and
              {unpriced === 1 ? " is" : " are"} not in this total.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
