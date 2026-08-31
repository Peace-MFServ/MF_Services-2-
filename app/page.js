'use client'
import { useState, useEffect } from 'react'
import { FONT } from '../lib/theme'
import SpecificationTool from '../components/SpecificationTool'
import OverpressureCalculator from '../components/OverpressureCalculator'
import Pricer from '../components/Pricer'
import AuthProvider from '../components/AuthProvider'
import { AccountBar } from '../components/AccountPanel'
import SignInDialog from '../components/SignInDialog'
import ProjectsProvider from '../components/ProjectsProvider'
import ProjectsDialog from '../components/ProjectsDialog'
import { useAuth } from '../components/AuthProvider'

const TABS = [
  { id: 'specification', label: 'Specification Tool' },
  { id: 'overpressure',  label: 'Overpressure' },
  // The estimator is ours. It is not shown to anyone else, and the
  // endpoint behind it refuses anyone else regardless.
  { id: 'pricer', label: 'Pricer', staffOnly: true },
]

// The specification tool and the pricer paint their own canvas edge
// to edge and centre their own content. Only the calculator keeps a
// reading width here.
const CONTENT_MAX_WIDTH = {
  overpressure: 1400,
}
const FULL_BLEED = new Set(["specification", "pricer"])

export default function Home() {
  return (
    <AuthProvider>
    <ProjectsProvider>
    <SignInDialog />
    <ProjectsDialog />
    <Toolbox />
    </ProjectsProvider>
    </AuthProvider>
  )
}

function Toolbox() {
  const [activeTab, setActiveTab] = useState('specification')
  const { isStaff } = useAuth()
  const tabs = TABS.filter(t => !t.staffOnly || isStaff)

  // Losing the role mid-session should not leave you looking at a tab
  // that is no longer yours.
  useEffect(() => {
    if (!tabs.some(t => t.id === activeTab)) setActiveTab('specification')
  }, [tabs, activeTab])

  return (
    <div style={{ minHeight: '100vh', background: '#F8F9FA', fontFamily: FONT }}>

      {/* ── HEADER — one slim navy bar: identity, sections, account ──
          The masthead and the tab bar used to stack and cost ~136px
          of every screen; the workspace gets that height back, and
          the brand keeps its navy with the orange ruled beneath. */}
      <header className="mf-nav">
        <div className="mf-nav-inner">
          <img src="/linkedin.jpg" alt="MF Services" width={925} height={184} style={{ height: 30, width: 'auto', borderRadius: 3, flexShrink: 0 }} />
          <div style={{ flexShrink: 0 }}>
            <h1 style={{ color: '#FFFFFF', fontWeight: 700, fontSize: 13.5, letterSpacing: '-0.01em', lineHeight: 1.2 }}>MF Services</h1>
            <div style={{ color: 'rgba(255,255,255,0.74)', fontSize: 10.5, letterSpacing: '0.03em' }}>Door Systems Toolbox</div>
          </div>
          <nav aria-label="Sections" style={{ display: 'flex', gap: 6, marginLeft: 18, minWidth: 0, overflowX: 'auto' }}>
            {tabs.map(tab => (
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
          </nav>
          <div style={{ marginLeft: 'auto' }}><AccountBar /></div>
        </div>
      </header>

      {/* ── CONTENT ── */}
      <div style={FULL_BLEED.has(activeTab) ? { width: '100%' } : {
        maxWidth: CONTENT_MAX_WIDTH[activeTab] ?? 1000,
        margin: '0 auto',
        padding: '32px',
      }}>
        {activeTab === 'specification' && <SpecificationTool />}
        {activeTab === 'overpressure'  && <OverpressureCalculator />}
        {activeTab === 'pricer'        && <Pricer />}
      </div>

    </div>
  )
}
