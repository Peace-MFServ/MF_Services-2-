'use client'
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthProvider";
import {
  readWorkingState, listProjects, saveProject, updateProject,
  deleteProject, describeProject,
} from "../lib/projects";
import { UI, FONT, fieldStyle, focusField, blurField } from "../lib/theme";

// Saving and reopening work. The tools themselves stay unaware of any
// of this — see lib/projects.js for why.

function when(ts) {
  if (!ts?.toDate) return "";
  const d = ts.toDate();
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" });
}

/** Save button for the configurator chrome. */
export function SaveProjectButton({ kind, selectionId, openProject, onSaved, style }) {
  const { signedIn, user, promptSignIn } = useAuth();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const buttonStyle = style ?? {
    padding: "7px 14px", fontSize: 12.5, fontFamily: FONT, fontWeight: 400,
    border: `1px solid ${UI.ruleStrong}`, background: UI.surface, color: UI.body,
    cursor: "pointer", whiteSpace: "nowrap",
  };

  const doSave = useCallback(async overwrite => {
    const payload = readWorkingState(kind);
    if (!payload) { setNotice({ text: "Nothing to save yet.", error: true }); return; }
    setBusy(true); setNotice(null);
    try {
      if (overwrite && openProject) {
        await updateProject({ id: openProject.id, ownerId: user.uid, payload });
        setNotice({ text: `Saved to “${openProject.name}”.` });
      } else {
        const id = await saveProject({
          ownerId: user.uid,
          name: name.trim() || "Untitled project",
          kind, selectionId, payload,
        });
        setNotice({ text: "Project saved." });
        onSaved?.({ id, name: name.trim() || "Untitled project" });
      }
      setNaming(false);
      setName("");
    } catch {
      setNotice({ text: "Could not save. Please try again.", error: true });
    } finally {
      setBusy(false);
    }
  }, [kind, selectionId, name, user, openProject, onSaved]);

  if (!signedIn) {
    return (
      <button type="button" style={buttonStyle} onClick={promptSignIn} title="Sign in to save a project">
        Save
      </button>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 8 }}>
        {openProject && (
          <button type="button" style={buttonStyle} disabled={busy} onClick={() => doSave(true)}>
            {busy ? "Saving" : "Save"}
          </button>
        )}
        <button type="button" style={buttonStyle} onClick={() => setNaming(v => !v)}>
          {openProject ? "Save as new" : "Save project"}
        </button>
      </div>

      {naming && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 40,
          background: UI.surface, border: `1px solid ${UI.ruleStrong}`,
          padding: 14, width: 280, boxShadow: "0 6px 20px rgba(16,25,34,0.13)",
        }}>
          <label htmlFor="proj-name" style={{
            display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
            textTransform: "uppercase", color: UI.muted, marginBottom: 6, fontFamily: FONT,
          }}>
            Project name
          </label>
          <input
            id="proj-name" value={name} autoFocus
            placeholder="e.g. Kildare Street, level 3"
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") doSave(false); if (e.key === "Escape") setNaming(false); }}
            style={{ ...fieldStyle, padding: "8px 10px", fontSize: 13 }}
            onFocus={focusField} onBlur={blurField}
          />
          <button
            type="button" onClick={() => doSave(false)} disabled={busy}
            style={{
              width: "100%", marginTop: 10, padding: "9px 14px",
              border: `1px solid ${UI.accent}`, background: UI.accent, color: "#FFFFFF",
              fontSize: 13, fontWeight: 600, fontFamily: FONT,
              cursor: busy ? "progress" : "pointer",
            }}
          >
            {busy ? "Saving" : "Save"}
          </button>
        </div>
      )}

      {notice && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 30,
          background: UI.surface, border: `1px solid ${notice.error ? UI.warn : UI.ruleStrong}`,
          padding: "8px 12px", fontSize: 12.5, fontFamily: FONT,
          color: notice.error ? UI.warn : UI.body, whiteSpace: "nowrap",
        }}>
          {notice.text}
        </div>
      )}
    </div>
  );
}

/** The list of saved projects, shown above the gallery. */
export function SavedProjectList({ onOpen }) {
  const { signedIn, user } = useAuth();
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      setProjects(await listProjects(user.uid));
    } catch {
      setError(true);
    }
  }, [user]);

  useEffect(() => { if (signedIn) refresh(); }, [signedIn, refresh]);

  const remove = async id => {
    try {
      await deleteProject(id);
      setProjects(p => p.filter(x => x.id !== id));
    } catch { setError(true); }
  };

  if (!signedIn || error) return null;
  if (!projects || projects.length === 0) return null;

  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{
        margin: "0 0 4px", fontSize: 13, fontWeight: 700, letterSpacing: "0.07em",
        textTransform: "uppercase", color: UI.ink, fontFamily: FONT,
      }}>
        Your projects
      </h2>
      <p style={{ margin: "0 0 18px", fontSize: 13.5, lineHeight: 1.5, color: UI.body, maxWidth: 620 }}>
        Pick up where you left off.
      </p>

      <div style={{ border: `1px solid ${UI.rule}`, background: UI.surface }}>
        {projects.map((p, i) => (
          <div key={p.id} style={{
            display: "flex", alignItems: "center", gap: 14, padding: "13px 16px",
            borderTop: i === 0 ? "none" : `1px solid ${UI.rule}`,
          }}>
            <button
              type="button"
              onClick={() => onOpen(p)}
              style={{
                flex: 1, minWidth: 0, textAlign: "left", background: "none",
                border: "none", padding: 0, cursor: "pointer", fontFamily: FONT,
              }}
            >
              <div style={{ fontSize: 14.5, fontWeight: 600, color: UI.ink }}>{p.name}</div>
              <div style={{ fontSize: 12.5, color: UI.body, marginTop: 3 }}>
                {describeProject(p)}
                <span style={{ color: UI.muted }}> · saved {when(p.updatedAt)}</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => remove(p.id)}
              aria-label={`Delete ${p.name}`}
              style={{
                padding: "6px 12px", fontSize: 12.5, fontFamily: FONT,
                border: `1px solid ${UI.ruleStrong}`, background: UI.surface,
                color: UI.muted, cursor: "pointer", flexShrink: 0,
              }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
