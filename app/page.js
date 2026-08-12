'use client'
import { useState } from 'react'
import { FONT } from '../lib/theme'
import CablePlanConfigurator from '../components/CablePlanConfigurator'
import SpecGenerator from '../components/SpecGenerator'
import OverpressureCalculator from '../components/OverpressureCalculator'

const TABS = [
  { id: 'hardwareSpec', label: 'Hardware Spec' },
  { id: 'cablePlan',    label: 'Cable Plan' },
  { id: 'overpressure', label: 'Overpressure' },
]

// The hardware spec and cable plan are both two-pane workspaces — a
// configuration rail beside a persistent elevation — so they need the
// full width to be usable.
const CONTENT_MAX_WIDTH = {
  hardwareSpec: 1700,
  cablePlan:    1700,
  overpressure: 1400,
}

export default function Home() {
  const [activeTab, setActiveTab] = useState('hardwareSpec')

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FA', fontFamily: FONT }}>

      {/* ── GLOBAL HEADER ── */}
      <header style={{ background: '#00387B', borderBottom: '3px solid #ED6E02' }}>
        <div style={{ maxWidth: CONTENT_MAX_WIDTH[activeTab] ?? 1000, margin: '0 auto', padding: '0 32px', display: 'flex', alignItems: 'center', height: 60, gap: 14 }}>
          <img src="/linkedin.jpg" alt="MF Services" style={{ height: 34, width: 'auto', borderRadius: 3, flexShrink: 0 }} />
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em', lineHeight: 1.2 }}>MF Services</div>
            <div style={{ color: 'rgba(255,255,255,0.74)', fontSize: 11.5, letterSpacing: '0.03em' }}>Door Systems Toolbox</div>
          </div>
        </div>
      </header>

      {/* ── TAB NAV ── */}
      {/* Width tracks the active section so the tabs line up with the
          content beneath them rather than stopping short of it. */}
      <nav className="mf-nav" aria-label="Sections">
        <div className="mf-nav-inner" style={{ maxWidth: CONTENT_MAX_WIDTH[activeTab] ?? 1000 }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              className="mf-tab"
              aria-current={activeTab === tab.id ? 'page' : undefined}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ── CONTENT ── */}
      <div style={{
        maxWidth: CONTENT_MAX_WIDTH[activeTab] ?? 1000,
        margin: '0 auto',
        padding: '32px',
        transition: 'max-width 200ms ease',
      }}>
        {activeTab === 'hardwareSpec' && <SpecGenerator />}
        {activeTab === 'cablePlan'    && <CablePlanConfigurator />}
        {activeTab === 'overpressure' && <OverpressureCalculator />}
      </div>

    </div>
  )
}
