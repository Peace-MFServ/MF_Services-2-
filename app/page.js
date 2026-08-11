'use client'
import { useState } from 'react'
import CablePlanConfigurator from '../components/CablePlanConfigurator'
import SpecGenerator from '../components/SpecGenerator'
import OverpressureCalculator from '../components/OverpressureCalculator'

const TABS = [
  { id: 'hardwareSpec', label: 'Hardware Spec' },
  { id: 'cablePlan',    label: 'Cable Plan' },
  { id: 'overpressure', label: 'Overpressure' },
]

const CONTENT_MAX_WIDTH = {
  hardwareSpec: 1000,
  // The cable plan is a two-pane workspace — configuration rail plus a
  // persistent elevation — so it needs the full width to be usable.
  cablePlan:    1700,
  overpressure: 1400,
}

export default function Home() {
  const [activeTab, setActiveTab] = useState('hardwareSpec')

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FA', fontFamily: 'DM Sans, sans-serif' }}>

      {/* ── GLOBAL HEADER ── */}
      <header style={{ background: '#00387B', borderBottom: '3px solid #ED6E02' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 32px', display: 'flex', alignItems: 'center', height: 56, gap: 14 }}>
          <img src="/linkedin.jpg" alt="MF Services" style={{ height: 34, width: 'auto', borderRadius: 3, flexShrink: 0 }} />
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em', lineHeight: 1.2 }}>MF Services</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, letterSpacing: '0.03em' }}>Door Systems Toolbox</div>
          </div>
        </div>
      </header>

      {/* ── TAB NAV ── */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 32px', display: 'flex' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: `2px solid ${activeTab === tab.id ? '#ED6E02' : 'transparent'}`,
                padding: '13px 20px',
                fontSize: 14,
                fontWeight: activeTab === tab.id ? 600 : 400,
                color: activeTab === tab.id ? '#0F1C2E' : '#6B7280',
                cursor: 'pointer',
                fontFamily: 'DM Sans, sans-serif',
                transition: 'color 150ms',
                marginBottom: -1,
                whiteSpace: 'nowrap',
              }}
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
