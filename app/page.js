'use client'
import { useState } from 'react'
import { FONT } from '../lib/theme'
import SpecificationTool from '../components/SpecificationTool'
import OverpressureCalculator from '../components/OverpressureCalculator'
import AuthProvider from '../components/AuthProvider'
import { AccountBar } from '../components/AccountPanel'
import SignInDialog from '../components/SignInDialog'
import ProjectsProvider from '../components/ProjectsProvider'
import ProjectsDialog from '../components/ProjectsDialog'

const TABS = [
  { id: 'specification', label: 'Specification Tool' },
  { id: 'overpressure',  label: 'Overpressure' },
]

// The specification tool is a two-pane workspace — a configuration
// rail beside a persistent elevation — and it runs full-bleed: the
// whole browser width is its own. Only the calculator keeps a reading
// width.
const CONTENT_MAX_WIDTH = {
  overpressure: 1400,
}
const FULL_BLEED = new Set(["specification"])

export default function Home() {
  const [activeTab, setActiveTab] = useState('specification')

  return (
    <AuthProvider>
    <ProjectsProvider>
    <SignInDialog />
    <ProjectsDialog />
    <div style={{ minHeight: '100vh', background: '#F8F9FA', fontFamily: FONT }}>

      {/* ── GLOBAL HEADER ── */}
      <header style={{ background: '#00387B', borderBottom: '3px solid #ED6E02' }}>
        <div style={{ margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', height: 60, gap: 14 }}>
          <img src="/linkedin.jpg" alt="MF Services" style={{ height: 34, width: 'auto', borderRadius: 3, flexShrink: 0 }} />
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em', lineHeight: 1.2 }}>MF Services</div>
            <div style={{ color: 'rgba(255,255,255,0.74)', fontSize: 11.5, letterSpacing: '0.03em' }}>Door Systems Toolbox</div>
          </div>
          <div style={{ marginLeft: 'auto' }}><AccountBar /></div>
        </div>
      </header>

      {/* ── TAB NAV ── */}
      <nav className="mf-nav" aria-label="Sections">
        <div className="mf-nav-inner" style={{ maxWidth: 'none' }}>
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
      <div style={FULL_BLEED.has(activeTab) ? { width: '100%' } : {
        maxWidth: CONTENT_MAX_WIDTH[activeTab] ?? 1000,
        margin: '0 auto',
        padding: '32px',
      }}>
        {activeTab === 'specification' && <SpecificationTool />}
        {activeTab === 'overpressure'  && <OverpressureCalculator />}
      </div>

    </div>
    </ProjectsProvider>
    </AuthProvider>
  )
}
