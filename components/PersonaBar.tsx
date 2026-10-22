'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useHealthcareAuth } from '../lib/auth/tidecloak-simulator'

export default function PersonaBar() {
  const { persona, allPersonas, switchPersona, token, dpopActive } = useHealthcareAuth()
  const [showTokenDetails, setShowTokenDetails] = useState(false)

  return (
    <>
      <header style={headerStyle}>
        <div style={containerStyle}>
          {/* Brand & Security Status */}
          <div style={brandSectionStyle}>
            <Link href="/home" style={logoLinkStyle}>
              <span style={shieldIconStyle}>🛡️</span>
              <div>
                <div style={logoTextStyle}>TideCloak Health</div>
                <div style={badgeRowStyle}>
                  <span style={liveDotStyle} />
                  <span style={securityTagStyle}>TideCloak Protected • DPoP RFC 9449</span>
                </div>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav style={navLinksStyle}>
            <Link href="/home" style={navItemStyle}>🏠 Home</Link>
            <Link href="/patient/emergency-capsule" style={navItemStyle}>💊 Emergency Capsule</Link>
            <Link href="/patient/records" style={navItemStyle}>📋 Records & Consents</Link>
            <Link href="/doctor/dashboard" style={navItemStyle}>🩺 Doctor Portal</Link>
            <Link href="/emergency/break-glass" style={navItemStyle}>🚨 Emergency (911)</Link>
            <Link href="/audit/logs" style={navItemStyle}>📜 Audit Trail</Link>
          </nav>

          {/* Persona Switcher & Active Role */}
          <div style={personaSectionStyle}>
            <div style={currentPersonaCardStyle}>
              <div style={{ ...avatarCircleStyle, backgroundColor: persona.avatarColor }}>
                {persona.name.charAt(0)}
              </div>
              <div>
                <div style={personaNameStyle}>{persona.name}</div>
                <div style={roleBadgeStyle(persona.role)}>{persona.role}</div>
              </div>
            </div>

            {/* Persona Switch Selector */}
            <div style={selectorGroupStyle}>
              <span style={selectLabelStyle}>Simulate Role:</span>
              <select
                value={persona.id}
                onChange={(e) => switchPersona(e.target.value)}
                style={selectStyle}
                aria-label="Select TideCloak Simulated Role"
              >
                {allPersonas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Token Inspector Toggle */}
            <button
              onClick={() => setShowTokenDetails(!showTokenDetails)}
              style={inspectorBtnStyle}
              title="View Token & Cryptographic Key Details"
            >
              🔑 Token
            </button>
          </div>
        </div>
      </header>

      {/* Token & Cryptographic Inspector Modal */}
      {showTokenDetails && (
        <div style={modalBackdropStyle} onClick={() => setShowTokenDetails(false)}>
          <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>
                🔐 TideCloak Identity & Cryptographic Grants (Active Session)
              </h3>
              <button onClick={() => setShowTokenDetails(false)} style={closeBtnStyle}>
                ✕
              </button>
            </div>

            <div style={modalBodyStyle}>
              <div style={infoGridStyle}>
                <div style={infoItemStyle}>
                  <strong>Current User:</strong> {persona.name}
                </div>
                <div style={infoItemStyle}>
                  <strong>Title / Department:</strong> {persona.title}
                </div>
                <div style={infoItemStyle}>
                  <strong>Subject ID (sub):</strong> <code style={codeSnippetStyle}>{persona.sub}</code>
                </div>
                <div style={infoItemStyle}>
                  <strong>Tide VUID:</strong> <code style={codeSnippetStyle}>{persona.vuid}</code>
                </div>
                <div style={infoItemStyle}>
                  <strong>Email:</strong> {persona.email}
                </div>
                <div style={infoItemStyle}>
                  <strong>DPoP Token Binding:</strong>{' '}
                  <span style={{ color: '#10b981', fontWeight: 600 }}>Active (RFC 9449 Proof)</span>
                </div>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <strong>Realm Roles & Cryptographic Tag Grants:</strong>
                <div style={rolesPillContainerStyle}>
                  {persona.realmRoles.map((r) => (
                    <span key={r} style={rolePillStyle}>
                      {r}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <strong>Tide JWT Access Token (Sender-Constrained):</strong>
                <textarea
                  readOnly
                  value={token}
                  style={tokenTextAreaStyle}
                  rows={4}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Modern Healthcare Visual Styles
const headerStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 100,
  backgroundColor: 'rgba(15, 23, 42, 0.94)',
  backdropFilter: 'blur(12px)',
  borderBottom: '1px solid rgba(51, 65, 85, 0.6)',
  color: '#f8fafc',
  padding: '0.6rem 1.5rem',
  boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.25)',
}

const containerStyle: React.CSSProperties = {
  maxWidth: 1280,
  margin: '0 auto',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: '1rem',
}

const brandSectionStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
}

const logoLinkStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.65rem',
  textDecoration: 'none',
  color: 'inherit',
}

const shieldIconStyle: React.CSSProperties = {
  fontSize: '1.75rem',
}

const logoTextStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: '1.15rem',
  letterSpacing: '-0.02em',
  color: '#ffffff',
}

const badgeRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.35rem',
}

const liveDotStyle: React.CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: '50%',
  backgroundColor: '#10b981',
  boxShadow: '0 0 8px #10b981',
}

const securityTagStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const navLinksStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  flexWrap: 'wrap',
}

const navItemStyle: React.CSSProperties = {
  color: '#cbd5e1',
  textDecoration: 'none',
  fontSize: '0.88rem',
  fontWeight: 500,
  padding: '0.35rem 0.65rem',
  borderRadius: '6px',
  transition: 'all 0.15s ease',
  backgroundColor: 'rgba(30, 41, 59, 0.6)',
}

const personaSectionStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.85rem',
}

const currentPersonaCardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  backgroundColor: 'rgba(30, 41, 59, 0.9)',
  padding: '0.3rem 0.75rem',
  borderRadius: '24px',
  border: '1px solid rgba(71, 85, 105, 0.4)',
}

const avatarCircleStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: '50%',
  color: '#ffffff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 700,
  fontSize: '0.85rem',
}

const personaNameStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 600,
  lineHeight: 1.2,
}

const roleBadgeStyle = (role: string): React.CSSProperties => {
  let bg = '#10b981'
  if (role === 'DOCTOR') bg = '#0ea5e9'
  if (role === 'EMERGENCY_DOCTOR') bg = '#f43f5e'
  if (role === 'AUDITOR') bg = '#8b5cf6'

  return {
    fontSize: '0.65rem',
    fontWeight: 700,
    color: '#ffffff',
    backgroundColor: bg,
    padding: '0.1rem 0.4rem',
    borderRadius: '4px',
    display: 'inline-block',
    textTransform: 'uppercase',
  }
}

const selectorGroupStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
}

const selectLabelStyle: React.CSSProperties = {
  fontSize: '0.78rem',
  color: '#94a3b8',
}

const selectStyle: React.CSSProperties = {
  backgroundColor: '#1e293b',
  color: '#f8fafc',
  border: '1px solid #475569',
  padding: '0.35rem 0.65rem',
  borderRadius: '6px',
  fontSize: '0.85rem',
  cursor: 'pointer',
  outline: 'none',
}

const inspectorBtnStyle: React.CSSProperties = {
  backgroundColor: '#334155',
  color: '#e2e8f0',
  border: 'none',
  padding: '0.35rem 0.65rem',
  borderRadius: '6px',
  fontSize: '0.8rem',
  fontWeight: 600,
  cursor: 'pointer',
}

const modalBackdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.75)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: '1rem',
}

const modalCardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  maxWidth: '680px',
  width: '100%',
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
  overflow: 'hidden',
}

const modalHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '1.25rem 1.5rem',
  borderBottom: '1px solid #e2e8f0',
  backgroundColor: '#f8fafc',
}

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: '1.25rem',
  cursor: 'pointer',
  color: '#64748b',
}

const modalBodyStyle: React.CSSProperties = {
  padding: '1.5rem',
  fontSize: '0.9rem',
  color: '#334155',
  maxHeight: '75vh',
  overflowY: 'auto',
}

const infoGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: '0.75rem',
}

const infoItemStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  backgroundColor: '#f1f5f9',
  borderRadius: '6px',
}

const codeSnippetStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: '0.8rem',
  backgroundColor: '#e2e8f0',
  padding: '0.1rem 0.3rem',
  borderRadius: '3px',
  wordBreak: 'break-all',
}

const rolesPillContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.4rem',
  marginTop: '0.4rem',
}

const rolePillStyle: React.CSSProperties = {
  backgroundColor: '#e0e7ff',
  color: '#3730a3',
  padding: '0.2rem 0.5rem',
  borderRadius: '12px',
  fontSize: '0.75rem',
  fontWeight: 600,
}

const tokenTextAreaStyle: React.CSSProperties = {
  width: '100%',
  marginTop: '0.4rem',
  fontFamily: 'monospace',
  fontSize: '0.75rem',
  backgroundColor: '#0f172a',
  color: '#38bdf8',
  padding: '0.5rem',
  borderRadius: '6px',
  border: '1px solid #334155',
  boxSizing: 'border-box',
}
