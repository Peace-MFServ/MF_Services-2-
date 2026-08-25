import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ─────────────────────────────────────────────────────────────────
// Firebase — accounts and saved projects
// ─────────────────────────────────────────────────────────────────
// These values are not secret. A web app's Firebase config ships in
// the browser bundle by design and is readable by anyone using the
// site; it identifies the project rather than granting access to it.
// What actually protects the data is Firebase Authentication and the
// Firestore security rules, not the secrecy of these strings.
//
// Environment variables win where they are set, so a second
// environment (staging, a fork) can point elsewhere without a code
// change.
// ─────────────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY            ?? "AIzaSyAnFi-YFJ8Ofm6UYg8z10kR7aFqkCa1r8M",
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN        ?? "mf-specification-tool.firebaseapp.com",
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID         ?? "mf-specification-tool",
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET     ?? "mf-specification-tool.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_SENDER_ID          ?? "759138575291",
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID             ?? "1:759138575291:web:0a282fbc3e3e3e73e5da9e",
};

// Next renders components more than once; reuse the app rather than
// initialising it again.
export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

/** Firebase's error codes, in words a person can act on. */
export function authErrorMessage(code) {
  switch (code) {
    case "auth/invalid-email":            return "That email address does not look right.";
    case "auth/missing-password":         return "Enter a password.";
    case "auth/weak-password":            return "Passwords need to be at least six characters.";
    case "auth/email-already-in-use":     return "There is already an account for that email address. Try signing in.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":           return "That email address and password do not match an account.";
    case "auth/too-many-requests":        return "Too many attempts. Wait a few minutes and try again.";
    case "auth/network-request-failed":   return "Could not reach the server. Check your connection and try again.";
    default:                              return "Something went wrong. Please try again.";
  }
}
