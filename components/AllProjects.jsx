'use client'
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "./AuthProvider";
import { useProjects } from "./ProjectsProvider";
import { listAllProjects, listAccounts, describeProject, projectType } from "../lib/projects";
import { UI, FONT, fieldStyle, cardStyle } from "../lib/theme";

// ─────────────────────────────────────────────────────────────────
// All projects — the admin's view
// ─────────────────────────────────────────────────────────────────
// Every project saved by anyone, with who saved it and when. Only the
// admin sees the tab, and the security rules refuse the read to anyone
// else whatever the interface does. Opening someone else's project
// opens a copy: saving it keeps it as the admin's own, and theirs is
// never touched.
// ─────────────────────────────────────────────────────────────────

const TYPES = ["Steel doors", "Riser doors", "Cable plan", "Quote"];

const at = ts => {
  const d = ts?.toDate?.();
  return d
    ? d.toLocaleString("en-IE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
};

function Count({ label, value }) {
  return (
    <div style={{ ...cardStyle, padding: "14px 16px", minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: UI.muted }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: UI.ink, marginTop: 4 }}>{value}</div>
    </div>
  );
}

export default function AllProjects() {
  const { user, isAdmin } = useAuth();
  const { requestOpen } = useProjects();
  const [projects, setProjects] = useState(null);
  const [accounts, setAccounts] = useState({});
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("All");

  const load = useCallback(async () => {
    setError(null);
    try {
      const [all, people] = await Promise.all([listAllProjects(), listAccounts()]);
      setProjects(all);
      setAccounts(Object.fromEntries(people.map(p => [p.id, p])));
    } catch (e) {
      setError(e?.code === "permission-denied" ? "rules" : "other");
    }
  }, []);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  const owner = useCallback(p => {
    const a = accounts[p.ownerId];
    return {
      name: a?.name || a?.email || "Unknown account",
      detail: [a?.businessName, a?.name ? a?.email : null].filter(Boolean).join(" · "),
    };
  }, [accounts]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (projects ?? []).filter(p => {
      if (type !== "All" && projectType(p) !== type) return false;
      if (!q) return true;
      const o = owner(p);
      return [p.name, describeProject(p), o.name, o.detail].some(v => v?.toLowerCase().includes(q));
    });
  }, [projects, search, type, owner]);

  const counts = useMemo(() => {
    const list = projects ?? [];
    const monthAgo = Date.now() - 30 * 86400000;
    return {
      total: list.length,
      recent: list.filter(p => (p.createdAt?.toDate?.()?.getTime() ?? 0) >= monthAgo).length,
      people: new Set(list.map(p => p.ownerId)).size,
      ...Object.fromEntries(TYPES.map(t => [t, list.filter(p => projectType(p) === t).length])),
    };
  }, [projects]);

  if (!isAdmin) return null;

  // Someone else's project opens as a copy, so saving it can never
  // write over theirs.
  const open = p => requestOpen(p.ownerId === user?.uid
    ? p
    : { ...p, id: null, name: `${p.name} (copy)` });

  return (
    <div style={{ padding: "28px 0 48px", fontFamily: FONT }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: UI.ink }}>All projects</h2>
        <button
          type="button" onClick={load}
          style={{
            padding: "7px 14px", fontSize: 12.5, fontFamily: FONT, cursor: "pointer",
            border: `1px solid ${UI.ruleStrong}`, background: UI.surface, color: UI.body,
          }}
        >
          Refresh
        </button>
      </div>
      <p style={{ margin: "6px 0 20px", fontSize: 13.5, lineHeight: 1.5, color: UI.body, maxWidth: 680 }}>
        Every project saved by anyone. Only you can see this page. Opening someone
        else&rsquo;s project opens a copy — saving it keeps it in your projects, and theirs is left as it is.
      </p>

      {error && (
        <div style={{ ...cardStyle, padding: 16, borderColor: UI.warn, color: UI.warn, fontSize: 13.5, lineHeight: 1.55 }}>
          {error === "rules"
            ? "The database refused this — the updated security rules have not been published yet, or this account is not marked as admin."
            : "Could not load the projects. Check the connection and press Refresh."}
        </div>
      )}

      {!error && projects == null && <p style={{ fontSize: 13.5, color: UI.muted }}>Loading…</p>}

      {projects && (
        <>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 20,
          }}>
            <Count label="Saved projects" value={counts.total} />
            <Count label="Last 30 days" value={counts.recent} />
            <Count label="People" value={counts.people} />
            {TYPES.map(t => <Count key={t} label={t === "Quote" ? "Quotes" : t === "Cable plan" ? "Cable plans" : t} value={counts[t]} />)}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by project, person or company"
              aria-label="Search projects"
              style={{ ...fieldStyle, flex: "1 1 260px", maxWidth: 420, padding: "9px 12px", fontSize: 13 }}
              className="mf-field"
            />
            <div role="radiogroup" aria-label="Type" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["All", ...TYPES].map(t => (
                <button
                  key={t} type="button" role="radio" aria-checked={type === t} onClick={() => setType(t)}
                  style={{
                    padding: "7px 12px", fontSize: 12.5, fontFamily: FONT, cursor: "pointer",
                    border: `1px solid ${type === t ? UI.accent : UI.ruleStrong}`,
                    background: type === t ? UI.accent : UI.surface,
                    color: type === t ? "#FFFFFF" : UI.body,
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <p style={{ margin: "0 0 8px", fontSize: 12.5, color: UI.muted }}>
            {shown.length} of {projects.length} shown · most recently updated first
          </p>

          <div style={{ border: `1px solid ${UI.rule}`, background: UI.surface }}>
            {shown.length === 0 && (
              <p style={{ margin: 0, padding: 16, fontSize: 13.5, color: UI.muted }}>No projects match.</p>
            )}
            {shown.map((p, i) => {
              const o = owner(p);
              return (
                <div key={p.id} style={{
                  display: "flex", alignItems: "center", gap: "10px 18px", padding: "13px 16px", flexWrap: "wrap",
                  borderTop: i === 0 ? "none" : `1px solid ${UI.rule}`,
                }}>
                  <div style={{ flex: "2 1 260px", minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: UI.ink }}>
                      {p.name}
                      <span style={{
                        marginLeft: 8, padding: "2px 7px", fontSize: 11, fontWeight: 600, verticalAlign: 2,
                        background: UI.sunken, color: UI.body, border: `1px solid ${UI.rule}`,
                      }}>
                        {projectType(p)}
                      </span>
                    </div>
                    <div style={{ fontSize: 12.5, color: UI.body, marginTop: 3 }}>{describeProject(p)}</div>
                  </div>
                  <div style={{ flex: "1 1 200px", minWidth: 0, fontSize: 12.5 }}>
                    <div style={{ color: UI.ink, fontWeight: 600 }}>{o.name}{p.ownerId === user?.uid ? " (you)" : ""}</div>
                    {o.detail && <div style={{ color: UI.muted, marginTop: 2 }}>{o.detail}</div>}
                  </div>
                  <div style={{ flex: "1 1 170px", fontSize: 12, color: UI.muted, lineHeight: 1.5 }}>
                    <div>Saved {at(p.createdAt)}</div>
                    <div>Updated {at(p.updatedAt)}</div>
                  </div>
                  <button
                    type="button" onClick={() => open(p)} aria-label={`Open ${p.name}`}
                    style={{
                      padding: "7px 16px", fontSize: 12.5, fontWeight: 600, fontFamily: FONT, cursor: "pointer",
                      border: `1px solid ${UI.accent}`, background: UI.accent, color: "#FFFFFF", flexShrink: 0,
                    }}
                  >
                    Open
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
