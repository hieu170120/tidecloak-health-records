'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useHealthcareAuth } from '../../lib/auth/tidecloak-simulator'

export default function HomePage() {
  const { persona, allPersonas, switchPersona, token, doEncrypt, doDecrypt, hasRealmRole } = useHealthcareAuth()

  // E2EE Sandbox Note
  const [noteText, setNoteText] = useState('')
  const [noteCipher, setNoteCipher] = useState('')
  const [noteBusy, setNoteBusy] = useState(false)
  const [noteStatus, setNoteStatus] = useState('')

  useEffect(() => {
    // Restore encrypted note from localStorage for current persona
    const saved = localStorage.getItem(`tide_sandbox_note_${persona.id}`)
    if (saved) {
      setNoteCipher(saved)
      doDecrypt([{ encrypted: saved, tags: ['message'] }])
        .then((res) => setNoteText(String(res[0])))
        .catch(() => {})
    } else {
      setNoteText('')
      setNoteCipher('')
    }
  }, [persona.id, doDecrypt])

  async function handleSaveNote() {
    setNoteBusy(true)
    setNoteStatus('')
    try {
      const [encrypted] = await doEncrypt([{ data: noteText, tags: ['message'] }])
      setNoteCipher(encrypted)
      localStorage.setItem(`tide_sandbox_note_${persona.id}`, encrypted)
      setNoteStatus('✅ Record encrypted with Tide tag [message] and stored safely!')
    } catch (e: any) {
      alert(`Encryption error: ${e.message}`)
    } finally {
      setNoteBusy(false)
    }
  }

  return (
    <main style={{ maxWidth: 1180, margin: '2rem auto', padding: '0 1.5rem 5rem' }}>
      {/* Hero Security Overview */}
      <div style={heroBannerStyle}>
        <div style={{ maxWidth: 720 }}>
          <div style={securityBadgeStyle}>
            🛡️ PROTECTED BY TIDECLOAK & INEFFABLE CRYPTOGRAPHY
          </div>
          <h1 style={{ fontSize: '2.25rem', color: '#0f172a', margin: '0.75rem 0 0.5rem', fontWeight: 800, letterSpacing: '-0.025em' }}>
            High-Security Healthcare Records Management System
          </h1>
          <p style={{ color: '#475569', fontSize: '1.05rem', lineHeight: 1.6, margin: 0 }}>
            Powered by TideCloak decentralized zero-trust architecture: Clinical data is end-to-end encrypted on the client (Client-side E2EE), authorized via Cryptographic Role Tags, access-controlled with Time-To-Live (TTL) Consents, and recorded in an immutable Ed25519 hash-chain audit log.
          </p>
        </div>

        {/* Security Specs Card */}
        <div style={securitySpecCardStyle}>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a', marginBottom: '0.65rem' }}>
            🔐 System Security Status
          </div>
          <div style={specItemStyle}>
            <span style={{ color: '#10b981' }}>✓</span> <span>Identity Keys:</span> <strong>Tide Ineffable Key</strong>
          </div>
          <div style={specItemStyle}>
            <span style={{ color: '#10b981' }}>✓</span> <span>Token Protocol:</span> <strong>DPoP RFC 9449 Bound</strong>
          </div>
          <div style={specItemStyle}>
            <span style={{ color: '#10b981' }}>✓</span> <span>Encryption Standard:</span> <strong>AES-GCM-256 + Tag Roles</strong>
          </div>
          <div style={specItemStyle}>
            <span style={{ color: '#10b981' }}>✓</span> <span>Audit Verification:</span> <strong>Ed25519 Hash Chain</strong>
          </div>
        </div>
      </div>

      {/* Role Navigation Grid */}
      <h2 style={{ fontSize: '1.4rem', color: '#1e293b', margin: '2.5rem 0 1.25rem' }}>
        Clinical Workflows & System Portals
      </h2>

      <div style={portalGridStyle}>
        {/* Card 1: Emergency Capsule */}
        <div style={portalCardStyle}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💊</div>
          <h3 style={portalTitleStyle}>Emergency Capsule</h3>
          <p style={portalDescStyle}>
            Life-critical emergency profile (blood type, allergies, medications, contacts). Client-encrypted and decrypted via Tide tag <code>emergency_capsule</code>.
          </p>
          <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
            <Link href="/patient/emergency-capsule" style={portalBtnStyle('#0284c7')}>
              Open Emergency Capsule →
            </Link>
          </div>
        </div>

        {/* Card 2: Medical Records & Consents */}
        <div style={portalCardStyle}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
          <h3 style={portalTitleStyle}>Clinical Records & Consents</h3>
          <p style={portalDescStyle}>
            Patients manage health records, granting fine-grained clinical consent to physicians by scope and TTL duration. Immediate revocation supported.
          </p>
          <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
            <Link href="/patient/records" style={portalBtnStyle('#059669')}>
              Manage Records & Consents →
            </Link>
          </div>
        </div>

        {/* Card 3: Doctor Clinical Portal */}
        <div style={portalCardStyle}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🩺</div>
          <h3 style={portalTitleStyle}>Physician Clinical Portal</h3>
          <p style={portalDescStyle}>
            Physicians access authorized patient files and decrypt clinical notes within granted scope. Automatically restricted upon TTL expiration.
          </p>
          <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
            <Link href="/doctor/dashboard" style={portalBtnStyle('#0284c7')}>
              Launch Doctor Portal →
            </Link>
          </div>
        </div>

        {/* Card 4: Break-Glass Emergency */}
        <div style={portalCardStyle}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🚨</div>
          <h3 style={{ ...portalTitleStyle, color: '#dc2626' }}>Emergency Break-Glass</h3>
          <p style={portalDescStyle}>
            High-priority emergency protocol for EMT/paramedics when patient is unresponsive. Unlocks emergency capsule only with mandatory legal audit log.
          </p>
          <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
            <Link href="/emergency/break-glass" style={portalBtnStyle('#dc2626')}>
              Initiate Break-Glass →
            </Link>
          </div>
        </div>

        {/* Card 5: Tamper-Evident Audit */}
        <div style={portalCardStyle}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📜</div>
          <h3 style={portalTitleStyle}>Tamper-Evident Audit Trail</h3>
          <p style={portalDescStyle}>
            Health auditors and compliance officers verify cryptographic hash chains and Ed25519 digital signatures across all clinical access events.
          </p>
          <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
            <Link href="/audit/logs" style={portalBtnStyle('#7c3aed')}>
              View Audit Trail →
            </Link>
          </div>
        </div>
      </div>

      {/* Interactive Cryptographic Note Sandbox */}
      <div style={sandboxCardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>
              🧪 Personal Self-Encryption Sandbox
            </h3>
            <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.85rem' }}>
              Test client-side E2EE encryption using Tide tag <code>message</code> tied directly to <strong>{persona.name}</strong>'s cryptographic identity.
            </p>
          </div>
          <span style={{ fontSize: '0.78rem', backgroundColor: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: 4, fontFamily: 'monospace' }}>
            Tag: _tide_message.selfencrypt
          </span>
        </div>

        <textarea
          rows={3}
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Enter a secret note to verify client-side cryptographic encryption..."
          style={textareaStyle}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
          <button disabled={noteBusy} onClick={handleSaveNote} style={saveBtnStyle}>
            {noteBusy ? 'Encrypting…' : '🔒 Encrypt & Store'}
          </button>
          {noteStatus && <span style={{ color: '#059669', fontSize: '0.88rem', fontWeight: 600 }}>{noteStatus}</span>}
        </div>

        {noteCipher && (
          <div style={cipherPreviewBoxStyle}>
            <div style={{ fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>Client-Stored Ciphertext:</div>
            <code style={{ fontSize: '0.75rem', wordBreak: 'break-all', color: '#0284c7' }}>{noteCipher}</code>
          </div>
        )}
      </div>
    </main>
  )
}

const heroBannerStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '20px',
  padding: '2.5rem',
  border: '1px solid #e2e8f0',
  boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '2rem',
  flexWrap: 'wrap',
}

const securityBadgeStyle: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#ecfdf5',
  color: '#059669',
  fontSize: '0.75rem',
  fontWeight: 700,
  letterSpacing: '0.04em',
  padding: '0.3rem 0.65rem',
  borderRadius: '20px',
  border: '1px solid #a7f3d0',
}

const securitySpecCardStyle: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '16px',
  padding: '1.25rem 1.5rem',
  minWidth: 260,
}

const specItemStyle: React.CSSProperties = {
  fontSize: '0.82rem',
  color: '#334155',
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  marginBottom: '0.45rem',
}

const portalGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: '1.25rem',
}

const portalCardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '16px',
  padding: '1.75rem',
  border: '1px solid #e2e8f0',
  boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
  display: 'flex',
  flexDirection: 'column',
  transition: 'transform 0.15s ease',
}

const portalTitleStyle: React.CSSProperties = {
  margin: '0 0 0.5rem',
  fontSize: '1.2rem',
  color: '#0f172a',
}

const portalDescStyle: React.CSSProperties = {
  fontSize: '0.88rem',
  color: '#64748b',
  lineHeight: 1.5,
  margin: 0,
}

const portalBtnStyle = (color: string): React.CSSProperties => ({
  display: 'inline-block',
  color: color,
  textDecoration: 'none',
  fontSize: '0.9rem',
  fontWeight: 700,
})

const sandboxCardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '16px',
  padding: '1.75rem',
  border: '1px solid #e2e8f0',
  marginTop: '2.5rem',
  boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
}

const textareaStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  fontSize: '0.9rem',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const saveBtnStyle: React.CSSProperties = {
  backgroundColor: '#0f172a',
  color: '#ffffff',
  border: 'none',
  padding: '0.6rem 1.25rem',
  borderRadius: '8px',
  fontWeight: 600,
  fontSize: '0.88rem',
  cursor: 'pointer',
}

const cipherPreviewBoxStyle: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '0.75rem',
  marginTop: '0.85rem',
  fontSize: '0.8rem',
}
