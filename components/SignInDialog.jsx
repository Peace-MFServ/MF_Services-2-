'use client'
import { useAuth } from "./AuthProvider";
import { AccountPanel } from "./AccountPanel";
import { UI } from "../lib/theme";

/** The sign-in panel, opened from anywhere via promptSignIn(). Lives
 *  at the top of the page so it can cover whatever is underneath. */
export default function SignInDialog() {
  const { promptOpen, closePrompt, signedIn } = useAuth();
  if (!promptOpen || signedIn) return null;

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Sign in"
      onClick={e => { if (e.target === e.currentTarget) closePrompt(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(16,25,34,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20,
      }}
    >
      <div style={{ background: UI.surface, padding: "28px 30px 30px", maxWidth: 440, width: "100%", position: "relative" }}>
        <button
          type="button" onClick={closePrompt} aria-label="Close"
          style={{
            position: "absolute", top: 12, right: 14, background: "none", border: "none",
            fontSize: 22, lineHeight: 1, color: UI.muted, cursor: "pointer", padding: 4,
          }}
        >
          ×
        </button>
        <AccountPanel onDone={closePrompt} />
      </div>
    </div>
  );
}
