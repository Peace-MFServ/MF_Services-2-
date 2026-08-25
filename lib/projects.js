import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, limit,
} from "firebase/firestore";
import { db } from "./firebase";

// ─────────────────────────────────────────────────────────────────
// Saved projects
// ─────────────────────────────────────────────────────────────────
// A saved project is the configuration a person had in front of them,
// kept so they can come back to it.
//
// Both configurators already persist their working state to session
// storage under a known key. Rather than thread a second copy through
// every component, saving reads that state and loading writes it back
// before the tool mounts — so the tools stay unaware that saving
// exists, and there is only ever one shape of configuration.
// ─────────────────────────────────────────────────────────────────

/** Where each kind of tool keeps its working state. */
export const WORKING_KEYS = {
  door: "mf-hardware-spec-v2",
};

const COLLECTION = "projects";
const MAX_PROJECTS = 200;

/** Read what the tool currently has in front of the user. */
export function readWorkingState(kind) {
  const key = WORKING_KEYS[kind];
  if (!key) return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Put a saved configuration back where the tool will find it. */
export function writeWorkingState(kind, payload) {
  const key = WORKING_KEYS[kind];
  if (!key || !payload) return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(payload));
  } catch { /* storage blocked — the project still opens, just unsaved */ }
}

/** A short description of a saved project for the list. */
export function describeProject(p) {
  const c = p?.payload?.config;
  if (!c?.width || !c?.height) return "No dimensions entered";
  const leaves = c.leaves || 1;
  return `${c.width} × ${c.height} mm · ${leaves} ${leaves === 1 ? "leaf" : "leaves"}${c.fireRating ? ` · ${c.fireRating}` : ""}`;
}

/**
 * Save the current configuration under a name. Returns the new id.
 * `ownerId` is written into the document because the security rules
 * check it — the rules, not this function, are what enforce ownership.
 */
export async function saveProject({ ownerId, name, kind, selectionId, payload }) {
  const ref = await addDoc(collection(db, COLLECTION), {
    ownerId,
    name: name.trim(),
    kind,
    selectionId,
    payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Overwrite an existing project the user already opened. */
export async function updateProject({ id, ownerId, name, payload }) {
  await updateDoc(doc(db, COLLECTION, id), {
    ownerId,
    ...(name ? { name: name.trim() } : {}),
    payload,
    updatedAt: serverTimestamp(),
  });
}

/** Everything this person has saved, most recently touched first. */
export async function listProjects(ownerId) {
  const snap = await getDocs(query(
    collection(db, COLLECTION),
    where("ownerId", "==", ownerId),
    orderBy("updatedAt", "desc"),
    limit(MAX_PROJECTS),
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function loadProject(id) {
  const snap = await getDoc(doc(db, COLLECTION, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function deleteProject(id) {
  await deleteDoc(doc(db, COLLECTION, id));
}
