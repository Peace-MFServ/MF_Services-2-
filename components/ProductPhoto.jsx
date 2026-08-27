'use client'
import { useState } from "react";

// ─────────────────────────────────────────────────────────────────
// Gallery card photography
// ─────────────────────────────────────────────────────────────────
// Cards prefer a real photograph of the product and fall back to the
// line-art illustration until one exists — so photos can arrive one
// at a time, and a missing file never breaks a card.
//
// Files live in public/products/. To add or replace a photo, drop the
// file in under the name mapped below and it appears; nothing else to
// change. `position` steers the crop for portrait shots so the part
// that tells the story (an operator at the head, a handle) stays in
// frame inside the 4:3 card.
// ─────────────────────────────────────────────────────────────────

export const PRODUCT_PHOTOS = {
  "riser-doors":      { src: "/products/riser.jpg",       position: "center 55%" },
  "steel-doors":      { src: "/products/steel.jpg",       position: "center 14%" },
  "swing-automation": { src: "/products/swing.jpg",       position: "center top" },
  "sliding-options":  { src: "/products/sliding.jpg",     position: "center" },
};

export const CABLE_PHOTOS = {
  "ets73-single":     { src: "/products/cable-swing.jpg", position: "center 30%" },
  "ets73-double":     { src: "/products/cable-double.jpg", position: "center" },
  "hold-open":        { src: "/products/hold-open.jpg",   position: "center" },
  "sliding-operator": { src: "/products/sliding.jpg",     position: "center" },
};

export default function ProductPhoto({ photo, alt = "", fallback = null }) {
  const [failed, setFailed] = useState(false);
  if (!photo || failed) return fallback;
  return (
    <img
      src={photo.src} alt={alt}
      onError={() => setFailed(true)}
      style={{
        position: "absolute", inset: 0, width: "100%", height: "100%",
        objectFit: "cover", objectPosition: photo.position ?? "center",
      }}
    />
  );
}
