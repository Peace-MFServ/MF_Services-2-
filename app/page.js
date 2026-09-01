'use client'
import { useState, useEffect } from 'react'
import { FONT } from '../lib/theme'
import SpecificationTool from '../components/SpecificationTool'
import OverpressureCalculator from '../components/OverpressureCalculator'
import Pricer from '../components/Pricer'
import AuthProvider from '../components/AuthProvider'
import { AccountBar } from '../components/AccountPanel'
import SignInDialog from '../components/SignInDialog'
import ProjectsProvider, { useProjects } from '../components/ProjectsProvider'
import ProjectsDialog from '../components/ProjectsDialog'
import { useAuth } from '../components/AuthProvider'
import { writeWorkingState } from '../lib/projects'

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
  // Bumped when the logo is clicked: remounts the specification tool
  // so it forgets its selection and shows the front door again.
  const [homeNonce, setHomeNonce] = useState(0)
  const { isStaff } = useAuth()
  const { pendingOpen, consumeOpen } = useProjects()
  // The saved quote currently open in the pricer, so its Save can
  // overwrite rather than copy. Remounted via nonce when one opens.
  const [openQuote, setOpenQuote] = useState(null)
  const [pricerNonce, setPricerNonce] = useState(0)
  const tabs = TABS.filter(t => !t.staffOnly || isStaff)

  // Route an opened project to the tool that owns it. Quotes belong
  // to the pricer; everything else belongs to the specification tool,
  // which consumes the request itself once its tab is showing.
  useEffect(() => {
    if (!pendingOpen) return
    if (pendingOpen.kind === 'quote') {
      writeWorkingState(pendingOpen.kind, pendingOpen.selectionId, pendingOpen.payload)
      setOpenQuote({ id: pendingOpen.id, name: pendingOpen.name })
      setPricerNonce(n => n + 1)
      setActiveTab('pricer')
      consumeOpen()
    } else if (activeTab !== 'specification') {
      setActiveTab('specification')
    }
  }, [pendingOpen, activeTab, consumeOpen])

  const goHome = () => {
    try { window.sessionStorage.removeItem('mf-specification-tool-selection') } catch { /* best-effort */ }
    setActiveTab('specification')
    setHomeNonce(n => n + 1)
  }

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
          <button
            type="button" onClick={goHome} aria-label="Home"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0, display: 'flex' }}
          >
            <img src="/linkedin.jpg" alt="MF Services" width={925} height={184} style={{ height: 30, width: 'auto', borderRadius: 3 }} />
          </button>
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
        {activeTab === 'specification' && <SpecificationTool key={homeNonce} />}
        {activeTab === 'overpressure'  && <OverpressureCalculator />}
        {activeTab === 'pricer'        && (
          <Pricer key={pricerNonce} openProject={openQuote} onSavedProject={setOpenQuote} />
        )}
      </div>

    </div>
  )
}
