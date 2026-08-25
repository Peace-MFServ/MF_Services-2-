'use client'
import { useAuth } from "./AuthProvider";
import { useProjects } from "./ProjectsProvider";
import { SavedProjectList } from "./SavedProjects";
import { UI, FONT } from "../lib/theme";

/** Saved projects, opened from the top bar. */
export default function ProjectsDialog() {
  const { signedIn } = useAuth();
  const { panelOpen, closePanel, requestOpen } = useProjects();
  if (!panelOpen || !signedIn) return null;

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Your projects"
      onClick={e => { if (e.target === e.currentTarget) closePanel(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(16,25,34,0.55)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        zIndex: 100, padding: "70px 20px 20px", overflowY: "auto",
      }}
    >
      <div style={{
        background: UI.surface, padding: "26px 30px 20px", maxWidth: 640, width: "100%",
        position: "relative", fontFamily: FONT,
      }}>
        <button
          type="button" onClick={closePanel} aria-label="Close"
          style={{
            position: "absolute", top: 12, right: 14, background: "none", border: "none",
            fontSize: 22, lineHeight: 1, color: UI.muted, cursor: "pointer", padding: 4,
          }}
        >
          ×
        </button>
        <SavedProjectList onOpen={requestOpen} showEmpty />
      </div>
    </div>
  );
}
