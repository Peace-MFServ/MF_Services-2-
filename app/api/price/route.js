import { resolveSteelDoor } from "../../../lib/steelDoor";
import { priceSteelDoor } from "../../../lib/server/steelPrice";

// ─────────────────────────────────────────────────────────────────
// POST /api/price — MF staff only
// ─────────────────────────────────────────────────────────────────
// The prices are worked out here and only the answer goes back, so the
// cost list never reaches a browser.
//
// Who is asking is settled by Firestore rather than by this route: the
// caller's own sign-in token is used to read their profile, so Google
// verifies the token and the security rules decide what may be read. A
// forged token gets nowhere near the prices, and a real one belonging
// to someone who is not staff reads back a role that is not "staff".
// Nothing here has to be trusted for that to hold.
// ─────────────────────────────────────────────────────────────────

const PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "mf-specification-tool";

export const dynamic = "force-dynamic";

/** The subject a token claims to be. Unverified — Firestore checks it. */
function claimedUid(idToken) {
  try {
    const payload = idToken.split(".")[1];
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(json).user_id ?? JSON.parse(json).sub ?? null;
  } catch {
    return null;
  }
}

async function roleOf(idToken) {
  const uid = claimedUid(idToken);
  if (!uid) return null;
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users/${uid}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const doc = await res.json();
  return doc?.fields?.role?.stringValue ?? null;
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Malformed request." }, { status: 400 });
  }

  const { idToken, config } = body ?? {};
  if (typeof idToken !== "string" || !idToken) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  let role;
  try {
    role = await roleOf(idToken);
  } catch {
    return Response.json({ error: "Could not confirm your account." }, { status: 503 });
  }
  if (!role) return Response.json({ error: "Not signed in." }, { status: 401 });
  if (role !== "staff") {
    return Response.json({ error: "Pricing is for MF Services staff." }, { status: 403 });
  }

  const resolution = resolveSteelDoor(config ?? {});
  if (!resolution.type) {
    return Response.json({ error: "That is not a doorset we make." }, { status: 422 });
  }

  const priced = priceSteelDoor({ type: resolution.type, config });
  return Response.json(priced, { headers: { "Cache-Control": "no-store" } });
}
