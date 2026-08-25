'use client'

// Product-type illustrations for the selection gallery.
//
// Line drawings rather than photography — consistent with the
// elevations the tool produces, and they stay legible at any size.
// Each one leads with the single feature that tells the types apart at
// a glance: narrow multi-leaf panels, a heavy frame, a swing arc, a
// slide track.

const EDGE   = "#3C4956"
const FRAME  = "#8895A3"
const LEAF   = "#CBD5DF"
const DEEP   = "#6D7A88"
const MOTION = "#57646F"
const ACCENT = "#00387B"
const GLASS  = "#E4EBF1"

const VB = "0 0 240 180"

function Ground() {
  return <line x1="10" y1="164" x2="230" y2="164" stroke={EDGE} strokeWidth="1.6" />
}

/** Riser doors — tall narrow access panels, services behind. */
export function RiserDoorArt() {
  return (
    <svg viewBox={VB} width="100%" height="100%" role="img" aria-label="Riser door illustration">
      <rect x="26" y="18" width="188" height="146" fill="#F4F6F8" />
      {/* Services behind */}
      <g stroke={DEEP} strokeWidth="3" fill="none" opacity="0.55">
        <line x1="52" y1="30" x2="52" y2="158" />
        <line x1="64" y1="30" x2="64" y2="158" />
        <circle cx="52" cy="70" r="5" fill="#F4F6F8" />
        <circle cx="64" cy="112" r="5" fill="#F4F6F8" />
      </g>
      {/* Frame */}
      <rect x="78" y="26" width="118" height="138" fill={FRAME} stroke={EDGE} strokeWidth="1.6" />
      {/* Two narrow leaves */}
      <rect x="85" y="33" width="51" height="124" fill={LEAF} stroke={EDGE} strokeWidth="1.3" />
      <rect x="138" y="33" width="51" height="124" fill={LEAF} stroke={EDGE} strokeWidth="1.3" />
      {/* Square-key locks */}
      <rect x="128" y="90" width="5" height="11" rx="1" fill={DEEP} stroke={EDGE} strokeWidth="0.8" />
      <rect x="181" y="90" width="5" height="11" rx="1" fill={DEEP} stroke={EDGE} strokeWidth="0.8" />
      {/* Fire rating tag */}
      <rect x="88" y="40" width="30" height="12" fill={ACCENT} />
      <text x="103" y="49" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#FFFFFF"
        fontFamily="Inter, Arial, sans-serif">FD</text>
      <Ground />
    </svg>
  )
}

/** Steel doors — heavy frame, vision panel, kick plate. */
export function SteelDoorArt() {
  return (
    <svg viewBox={VB} width="100%" height="100%" role="img" aria-label="Steel door illustration">
      <rect x="26" y="18" width="188" height="146" fill="#F4F6F8" />
      {/* Deep frame */}
      <rect x="72" y="22" width="112" height="142" fill={FRAME} stroke={EDGE} strokeWidth="1.6" />
      <rect x="82" y="32" width="92" height="132" fill={LEAF} stroke={EDGE} strokeWidth="1.4" />
      {/* Vision panel */}
      <rect x="98" y="46" width="60" height="34" fill={GLASS} stroke={EDGE} strokeWidth="1.2" />
      <line x1="98" y1="63" x2="158" y2="63" stroke={EDGE} strokeWidth="0.7" opacity="0.5" />
      {/* Lever and cylinder */}
      <circle cx="164" cy="104" r="4.5" fill={DEEP} stroke={EDGE} strokeWidth="1" />
      <rect x="146" y="102" width="18" height="4" rx="2" fill={DEEP} stroke={EDGE} strokeWidth="1" />
      <rect x="160" y="116" width="8" height="12" rx="1.5" fill={DEEP} stroke={EDGE} strokeWidth="0.9" />
      {/* Kick plate */}
      <rect x="86" y="138" width="84" height="20" fill={DEEP} stroke={EDGE} strokeWidth="1" opacity="0.85" />
      {/* Hinges */}
      {[50, 96, 142].map(hy => (
        <rect key={hy} x="77" y={hy} width="10" height="16" fill={DEEP} stroke={EDGE} strokeWidth="0.9" />
      ))}
      <Ground />
    </svg>
  )
}

/** Swing automation — header operator and swing arc. */
export function SwingAutomationArt() {
  return (
    <svg viewBox={VB} width="100%" height="100%" role="img" aria-label="Swing door operator illustration">
      <rect x="26" y="18" width="188" height="146" fill="#F4F6F8" />
      {/* Operator on the header */}
      <rect x="66" y="26" width="124" height="20" fill="#FFFFFF" stroke={EDGE} strokeWidth="1.5" />
      <line x1="74" y1="40" x2="182" y2="40" stroke={EDGE} strokeWidth="0.9" strokeDasharray="4 3" />
      <circle cx="128" cy="36" r="2.6" fill={ACCENT} />
      {/* Frame and leaf */}
      <rect x="66" y="46" width="124" height="118" fill={FRAME} stroke={EDGE} strokeWidth="1.6" />
      <rect x="76" y="52" width="104" height="112" fill={LEAF} stroke={EDGE} strokeWidth="1.3" />
      {/* Slide rail */}
      <rect x="86" y="58" width="84" height="6" rx="1" fill={DEEP} stroke={EDGE} strokeWidth="0.8" />
      {/* Lever */}
      <circle cx="170" cy="108" r="4.5" fill={DEEP} stroke={EDGE} strokeWidth="1" />
      <rect x="152" y="106" width="18" height="4" rx="2" fill={DEEP} stroke={EDGE} strokeWidth="1" />
      {/* Swing arc */}
      <path d="M76 164 A 88 88 0 0 1 164 76" fill="none" stroke={MOTION} strokeWidth="1.3" strokeDasharray="6 4" />
      <path d="M158 82 L166 74 L168 86 Z" fill={MOTION} />
      <Ground />
    </svg>
  )
}

/** Sliding options — track above, two panels, side screens. */
export function SlidingDoorArt() {
  return (
    <svg viewBox={VB} width="100%" height="100%" role="img" aria-label="Automatic sliding door illustration">
      <rect x="18" y="18" width="204" height="146" fill="#F4F6F8" />
      {/* Track / header */}
      <rect x="18" y="24" width="204" height="18" fill="#FFFFFF" stroke={EDGE} strokeWidth="1.5" />
      <line x1="26" y1="38" x2="214" y2="38" stroke={EDGE} strokeWidth="0.9" strokeDasharray="4 3" />
      {/* Fixed side screens */}
      <rect x="18" y="42" width="46" height="122" fill={GLASS} stroke={EDGE} strokeWidth="1.3" />
      <rect x="176" y="42" width="46" height="122" fill={GLASS} stroke={EDGE} strokeWidth="1.3" />
      {/* Moving panels */}
      <rect x="66" y="42" width="54" height="122" fill={LEAF} stroke={EDGE} strokeWidth="1.4" />
      <rect x="120" y="42" width="54" height="122" fill={LEAF} stroke={EDGE} strokeWidth="1.4" />
      <line x1="120" y1="42" x2="120" y2="164" stroke={EDGE} strokeWidth="1.4" />
      {/* Direction arrows */}
      <g stroke={MOTION} strokeWidth="1.4" fill="none">
        <line x1="98" y1="104" x2="76" y2="104" />
        <line x1="142" y1="104" x2="164" y2="104" />
      </g>
      <path d="M74 104 L82 100 L82 108 Z" fill={MOTION} />
      <path d="M166 104 L158 100 L158 108 Z" fill={MOTION} />
      <Ground />
    </svg>
  )
}

/** Cable plan, single leaf — operator on the head, cable to the wall. */
export function CableSingleArt() {
  return (
    <svg viewBox={VB} width="100%" height="100%" role="img" aria-label="Single-leaf cable plan illustration">
      <rect x="26" y="18" width="188" height="146" fill="#F4F6F8" />
      {/* Radar above the header */}
      <g stroke={EDGE} strokeWidth="1.2" fill={GLASS}>
        <rect x="112" y="20" width="26" height="11" />
      </g>
      <g stroke={MOTION} strokeWidth="1" opacity="0.7">
        <line x1="118" y1="31" x2="114" y2="39" />
        <line x1="125" y1="31" x2="125" y2="41" />
        <line x1="132" y1="31" x2="136" y2="39" />
      </g>
      {/* Operator across the head */}
      <rect x="72" y="44" width="106" height="17" fill={FRAME} stroke={EDGE} strokeWidth="1.5" />
      <line x1="78" y1="52" x2="172" y2="52" stroke={EDGE} strokeWidth="0.8" opacity="0.6" />
      {/* Frame and leaf */}
      <rect x="72" y="61" width="9" height="103" fill={FRAME} stroke={EDGE} strokeWidth="1.4" />
      <rect x="169" y="61" width="9" height="103" fill={FRAME} stroke={EDGE} strokeWidth="1.4" />
      <rect x="81" y="61" width="88" height="103" fill={LEAF} stroke={EDGE} strokeWidth="1.3" />
      {/* Sensor strip along the leaf head */}
      <rect x="85" y="65" width="80" height="5" fill={EDGE} />
      <rect x="160" y="105" width="5" height="12" rx="1" fill={DEEP} stroke={EDGE} strokeWidth="0.8" />
      {/* Cable to a wall-mounted switch */}
      <rect x="36" y="96" width="17" height="23" fill="#FFFFFF" stroke={EDGE} strokeWidth="1.2" />
      <line x1="41" y1="112" x2="48" y2="112" stroke={EDGE} strokeWidth="1" />
      <polyline points="44.5,96 44.5,52 72,52" fill="none" stroke={ACCENT} strokeWidth="1.8"
        strokeLinejoin="round" strokeLinecap="round" />
      <Ground />
    </svg>
  )
}

/** Cable plan, double leaf — twin operators either side of a mullion. */
export function CableDoubleArt() {
  return (
    <svg viewBox={VB} width="100%" height="100%" role="img" aria-label="Double-leaf cable plan illustration">
      <rect x="26" y="18" width="188" height="146" fill="#F4F6F8" />
      {/* Radars above the header */}
      <g stroke={EDGE} strokeWidth="1.2" fill={GLASS}>
        <rect x="92" y="20" width="24" height="11" />
        <rect x="134" y="20" width="24" height="11" />
      </g>
      <g stroke={MOTION} strokeWidth="1" opacity="0.7">
        <line x1="104" y1="31" x2="104" y2="40" />
        <line x1="146" y1="31" x2="146" y2="40" />
      </g>
      {/* Twin operators, split at the middle */}
      <rect x="60" y="44" width="62" height="17" fill={FRAME} stroke={EDGE} strokeWidth="1.5" />
      <rect x="126" y="44" width="62" height="17" fill={FRAME} stroke={EDGE} strokeWidth="1.5" />
      {/* System cable bridging the drives */}
      <line x1="122" y1="52" x2="126" y2="52" stroke={ACCENT} strokeWidth="2" />
      {/* Frame, mullion and two leaves */}
      <rect x="60" y="61" width="9" height="103" fill={FRAME} stroke={EDGE} strokeWidth="1.4" />
      <rect x="179" y="61" width="9" height="103" fill={FRAME} stroke={EDGE} strokeWidth="1.4" />
      <rect x="69" y="61" width="55" height="103" fill={LEAF} stroke={EDGE} strokeWidth="1.3" />
      <rect x="124" y="61" width="55" height="103" fill={LEAF} stroke={EDGE} strokeWidth="1.3" />
      {/* Sensor strips, one per leaf */}
      <rect x="73" y="65" width="47" height="5" fill={EDGE} />
      <rect x="128" y="65" width="47" height="5" fill={EDGE} />
      <rect x="116" y="105" width="5" height="12" rx="1" fill={DEEP} stroke={EDGE} strokeWidth="0.8" />
      {/* Cable to a wall-mounted switch */}
      <rect x="30" y="96" width="17" height="23" fill="#FFFFFF" stroke={EDGE} strokeWidth="1.2" />
      <line x1="35" y1="112" x2="42" y2="112" stroke={EDGE} strokeWidth="1" />
      <polyline points="38.5,96 38.5,52 60,52" fill="none" stroke={ACCENT} strokeWidth="1.8"
        strokeLinejoin="round" strokeLinecap="round" />
      <Ground />
    </svg>
  )
}

export const CABLE_ART = {
  "ets73-single": CableSingleArt,
  "ets73-double": CableDoubleArt,
}

export const PRODUCT_ART = {
  "riser-doors": RiserDoorArt,
  "steel-doors": SteelDoorArt,
  "swing-automation": SwingAutomationArt,
  "sliding-options": SlidingDoorArt,
}
