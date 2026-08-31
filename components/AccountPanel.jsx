'use client'
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthProvider";
import { useProjects } from "./ProjectsProvider";
import { authErrorMessage } from "../lib/firebase";
import { UI, FONT, fieldStyle } from "../lib/theme";

// Sign in, sign up and password reset — one panel, three modes, so
// nobody is sent off to a separate page and back.

const MODES = {
  SIGN_IN: "sign-in",
  SIGN_UP: "sign-up",
  RESET: "reset",
};

function Field({ id, label, type = "text", value, onChange, autoComplete, required }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label htmlFor={id} style={{
        display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
        textTransform: "uppercase", color: UI.muted, marginBottom: 6, fontFamily: FONT,
      }}>
        {label}
        {required && <span aria-hidden="true" style={{ color: UI.warn, marginLeft: 4 }}>*</span>}
      </label>
      <input
        id={id} type={type} value={value} autoComplete={autoComplete} required={required}
        onChange={e => onChange(e.target.value)}
        style={{ ...fieldStyle, padding: "9px 11px", fontSize: 13.5 }} className="mf-field"
      />
    </div>
  );
}

export function AccountPanel({ onDone, initialMode = MODES.SIGN_IN }) {
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const submit = useCallback(async e => {
    e.preventDefault();
    setBusy(true); setError(null); setNotice(null);
    try {
      if (mode === MODES.SIGN_UP) {
        await signUp({ email, password, name, businessName });
        onDone?.();
      } else if (mode === MODES.SIGN_IN) {
        await signIn({ email, password });
        onDone?.();
      } else {
        await resetPassword(email);
        setNotice("If that address has an account, a reset link is on its way.");
      }
    } catch (err) {
      setError(authErrorMessage(err?.code));
    } finally {
      setBusy(false);
    }
  }, [mode, email, password, name, businessName, signIn, signUp, resetPassword, onDone]);

  const heading =
    mode === MODES.SIGN_UP ? "Create an account"
    : mode === MODES.RESET ? "Reset your password"
    : "Sign in";

  const blurb =
    mode === MODES.SIGN_UP
      ? "An account gives you the quick layout and lets you save a project and come back to it."
      : mode === MODES.RESET
        ? "Enter the address you signed up with and we will email you a link."
        : "Signing in gives you the quick layout and your saved projects.";

  const link = { background: "none", border: "none", padding: 0, fontFamily: FONT,
    fontSize: 13, color: UI.accent, textDecoration: "underline", cursor: "pointer" };

  return (
    <form onSubmit={submit} style={{ fontFamily: FONT, maxWidth: 380 }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em", color: UI.ink }}>
        {heading}
      </h2>
      <p style={{ margin: "8px 0 20px", fontSize: 13.5, lineHeight: 1.55, color: UI.body }}>
        {blurb}
      </p>

      {mode === MODES.SIGN_UP && (
        <>
          <Field id="ac-name" label="Your name" value={name} onChange={setName} autoComplete="name" />
          <Field id="ac-business" label="Company" value={businessName} onChange={setBusinessName} autoComplete="organization" />
        </>
      )}

      <Field
        id="ac-email" label="Email" type="email" value={email} onChange={setEmail}
        autoComplete="email" required
      />

      {mode !== MODES.RESET && (
        <Field
          id="ac-password" label="Password" type="password" value={password} onChange={setPassword}
          autoComplete={mode === MODES.SIGN_UP ? "new-password" : "current-password"} required
        />
      )}

      {error && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <span aria-hidden="true" style={{ width: 3, background: UI.warn, flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, lineHeight: 1.45, color: UI.warn }}>{error}</span>
        </div>
      )}
      {notice && (
        <p style={{ margin: "0 0 14px", fontSize: 12.5, lineHeight: 1.45, color: UI.body }}>{notice}</p>
      )}

      <button
        type="submit" disabled={busy}
        style={{
          width: "100%", padding: "12px 20px", border: `1px solid ${UI.accent}`,
          background: UI.accent, color: "#FFFFFF",
          fontSize: 14, fontWeight: 600, fontFamily: FONT,
          cursor: busy ? "progress" : "pointer", opacity: busy ? 0.75 : 1,
        }}
      >
        {busy ? "Working" : mode === MODES.SIGN_UP ? "Create account" : mode === MODES.RESET ? "Send reset link" : "Sign in"}
      </button>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 16 }}>
        {mode !== MODES.SIGN_IN && (
          <button type="button" style={link} onClick={() => { setMode(MODES.SIGN_IN); setError(null); setNotice(null); }}>
            Sign in instead
          </button>
        )}
        {mode !== MODES.SIGN_UP && (
          <button type="button" style={link} onClick={() => { setMode(MODES.SIGN_UP); setError(null); setNotice(null); }}>
            Create an account
          </button>
        )}
        {mode === MODES.SIGN_IN && (
          <button type="button" style={link} onClick={() => { setMode(MODES.RESET); setError(null); setNotice(null); }}>
            Forgotten password
          </button>
        )}
      </div>
    </form>
  );
}

// Small line icons for the header chips, drawn in currentColor so
// they read in white on the navy bar.
const chipStroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" };
const FOLDER_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
    <path {...chipStroke} d="M3.5 6.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V6.5z" />
  </svg>
);
const SIGN_OUT_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
    <path {...chipStroke} d="M13.5 8V5.5h-8v13h8V16 M9.5 12h11 M17.5 9l3 3-3 3" />
  </svg>
);
const SIGN_IN_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
    <path {...chipStroke} d="M10.5 8V5.5h8v13h-8V16 M3.5 12h10 M10.5 9l3 3-3 3" />
  </svg>
);

/** Sign out, with one beat of hesitation — a stray click on a header
 *  button should not dump anyone out of their session. */
export function SignOutButton({ chip, signOut }) {
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (!confirm) return;
    const onKey = e => { if (e.key === "Escape") setConfirm(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirm]);

  return (
    <div style={{ position: "relative" }}>
      <button type="button" style={chip} onClick={() => setConfirm(c => !c)}>
        <span aria-hidden="true" style={{ display: "inline-flex" }}>{SIGN_OUT_ICON}</span>
        Sign out
      </button>
      {confirm && (
        <div style={{
          position: "absolute", top: "calc(100% + 10px)", right: 0, zIndex: 60,
          background: "#FFFFFF", border: `1px solid ${UI.ruleStrong}`,
          padding: 14, width: 228, boxShadow: "0 6px 20px rgba(16,25,34,0.13)",
          fontFamily: FONT,
        }}>
          <p style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.5, color: UI.body }}>
            Sign out of your account?
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button" onClick={() => { setConfirm(false); signOut(); }}
              style={{
                flex: 1, padding: "8px 12px", border: `1px solid ${UI.accent}`,
                background: UI.accent, color: "#FFFFFF",
                fontSize: 12.5, fontWeight: 600, fontFamily: FONT, cursor: "pointer",
              }}
            >
              Sign out
            </button>
            <button
              type="button" onClick={() => setConfirm(false)} autoFocus
              style={{
                flex: 1, padding: "8px 12px", border: `1px solid ${UI.ruleStrong}`,
                background: "#FFFFFF", color: UI.body,
                fontSize: 12.5, fontFamily: FONT, cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** The account control in the page header. */
export function AccountBar() {
  const { ready, signedIn, user, role, signOut, promptSignIn } = useAuth();
  const { openPanel } = useProjects();

  const chip = {
    display: "inline-flex", alignItems: "center", gap: 7,
    padding: "6px 12px", fontSize: 12.5, fontFamily: FONT, fontWeight: 500,
    border: "1px solid rgba(255,255,255,0.45)", background: "transparent",
    borderRadius: 6,
    color: "#FFFFFF", cursor: "pointer", whiteSpace: "nowrap",
  };

  if (!ready) return <div style={{ width: 150 }} />;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
      {signedIn ? (
        <>
          <div style={{ textAlign: "right", lineHeight: 1.25, minWidth: 0 }}>
            <div style={{ color: "#FFFFFF", fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>
              {user.displayName || user.email}
            </div>
            <div style={{ color: "rgba(255,255,255,0.72)", fontSize: 11, letterSpacing: "0.04em" }}>
              {role === "staff" ? "MF Services" : "Signed in"}
            </div>
          </div>
          <button type="button" style={chip} onClick={openPanel}>
            <span aria-hidden="true" style={{ display: "inline-flex" }}>{FOLDER_ICON}</span>
            Your projects
          </button>
          <SignOutButton chip={chip} signOut={signOut} />
        </>
      ) : (
        <button type="button" style={chip} onClick={promptSignIn}>
          <span aria-hidden="true" style={{ display: "inline-flex" }}>{SIGN_IN_ICON}</span>
          Sign in
        </button>
      )}

    </div>
  );
}
