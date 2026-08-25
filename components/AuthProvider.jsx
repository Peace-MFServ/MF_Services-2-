'use client'
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

// ─────────────────────────────────────────────────────────────────
// Who is using the tool
// ─────────────────────────────────────────────────────────────────
// Three levels of access:
//
//   public  not signed in — the guided tool and a PDF, as now
//   trade   signed in     — the quick layout and saved projects
//   staff   MF Services   — everything, plus the estimator
//
// The role lives on a user document in Firestore rather than being
// inferred in the browser, so the security rules can enforce it. A new
// account is always "trade"; staff is granted deliberately, and the
// rules stop anyone promoting themselves.
// ─────────────────────────────────────────────────────────────────

const AuthContext = createContext(null);

export const ROLES = { PUBLIC: "public", TRADE: "trade", STAFF: "staff" };

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(ROLES.PUBLIC);
  // Until Firebase has reported in we do not know whether anyone is
  // signed in, and painting the signed-out state first makes the page
  // flicker for people who are.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stop = onAuthStateChanged(auth, async current => {
      setUser(current);
      if (!current) {
        setRole(ROLES.PUBLIC);
        setReady(true);
        return;
      }
      try {
        const snap = await getDoc(doc(db, "users", current.uid));
        setRole(snap.exists() ? (snap.data().role ?? ROLES.TRADE) : ROLES.TRADE);
      } catch {
        // A missing or unreadable profile should not lock someone out
        // of what any signed-in user can do.
        setRole(ROLES.TRADE);
      }
      setReady(true);
    });
    return stop;
  }, []);

  const signUp = useCallback(async ({ email, password, name, businessName }) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name?.trim()) {
      await updateProfile(cred.user, { displayName: name.trim() });
    }
    // The profile carries the role; everyone starts as trade.
    await setDoc(doc(db, "users", cred.user.uid), {
      email: cred.user.email,
      name: name?.trim() ?? "",
      businessName: businessName?.trim() ?? "",
      role: ROLES.TRADE,
      createdAt: serverTimestamp(),
    });
    setRole(ROLES.TRADE);
    return cred.user;
  }, []);

  const signIn = useCallback(
    ({ email, password }) => signInWithEmailAndPassword(auth, email, password),
    [],
  );

  const signOut = useCallback(() => fbSignOut(auth), []);

  const resetPassword = useCallback(email => sendPasswordResetEmail(auth, email), []);

  const value = {
    user, role, ready,
    signedIn: !!user,
    isStaff: role === ROLES.STAFF,
    signUp, signIn, signOut, resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
