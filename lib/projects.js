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

// Where each tool keeps its working state. Most kinds have one key;
// a product with its own configurator gets its own, looked up first
// as "<kind>:<selectionId>".
export const WORKING_KEYS = {
  "door:steel-doors": "mf-steel-spec-v1",
  door: "mf-hardware-spec-v2",
  cable: "mf-cable-plan-v1",
  // The pricer's schedule of doorsets — a quote in progress. Only
  // staff ever see the pricer, so only staff ever own one of these.
  quote: "mf-pricer-v1",
};

export function workingKeyFor(kind, selectionId) {
  return WORKING_KEYS[`${kind}:${selectionId}`] ?? WORKING_KEYS[kind] ?? null;
}

const COLLECTION = "projects";
const MAX_PROJECTS = 200;

/** Read what the tool currently has in front of the user. */
export function readWorkingState(kind, selectionId) {
  const key = workingKeyFor(kind, selectionId);
  if (!key) return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Put a saved configuration back where the tool will find it. */
export function writeWorkingState(kind, selectionId, payload) {
  const key = workingKeyFor(kind, selectionId);
  if (!key || !payload) return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(payload));
  } catch { /* storage blocked — the project still opens, just unsaved */ }
}

/** A short description of a saved project for the list. */
export function describeProject(p) {
  // A quote is a schedule of doorsets, not a single opening.
  if (p?.kind === "quote") {
    const n = p?.payload?.lines?.length ?? 0;
    const proj = p?.payload?.project?.trim();
    return `Quote · ${n} ${n === 1 ? "doorset" : "doorsets"}${proj ? ` · ${proj}` : ""}`;
  }

  // A cable plan is a checklist, not an opening — describe the work
  // done rather than dimensions it does not have.
  if (p?.kind === "cable") {
    const states = p?.payload?.componentStates ?? {};
    const included = Object.values(states).filter(s => s?.included).length;
    const door = p?.payload?.projectData?.doorNumberOrNaming?.trim();
    return `Cable plan · ${included} ${included === 1 ? "position" : "positions"}${door ? ` · ${door}` : ""}`;
  }

  const c = p?.payload?.config;
  if (!c?.width || !c?.height) return "No dimensions entered";
  const leaves = c.leaves || 1;
  // Riser doors carry a fire rating label; steel doorsets carry the
  // minutes the answers derived it from.
  const rating = c.fireRating
    ?? (c.minutes == null ? null : c.minutes === 0 ? "Not fire rated" : `${c.minutes} minutes`);
  return `${c.width} × ${c.height} mm · ${leaves} ${leaves === 1 ? "leaf" : "leaves"}${rating ? ` · ${rating}` : ""}`;
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
