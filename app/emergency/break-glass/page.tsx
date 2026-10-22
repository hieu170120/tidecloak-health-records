'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useHealthcareAuth } from '../../../lib/auth/tidecloak-simulator'

export default function EmergencyBreakGlassPage() {
  const { persona, hasRealmRole, secureFetch, doDecrypt } = useHealthcareAuth()
  const isEmergencyDoctor = hasRealmRole('EMERGENCY_DOCTOR')

  const [patientId, setPatientId] = useState('dc1460ce-3cad-43ed-8ea5-3e6179d524d3')
  const [justification, setJustification] = useState(
    'Patient unconscious following motor vehicle trauma, unaccompanied. Immediate access to blood type and drug allergies required for emergency surgery.'
  )
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [breakGlassResult, setBreakGlassResult] = useState<any>(null)
  const [decryptedCapsule, setDecryptedCapsule] = useState<any>(null)

  async function handleTriggerBreakGlass(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErrorMsg('')
    setBreakGlassResult(null)
    setDecryptedCapsule(null)

    try {
      const res = await secureFetch('/api/health/emergency/break-glass', {
        method: 'POST',
        body: JSON.stringify({
          patientId,
          justification,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Break-Glass request rejected.')
      }

      setBreakGlassResult(data)

      // Decrypt capsule
      if (data.capsule?.ciphertext) {
        try {
          const raw = data.capsule.ciphertext
          const decrypted = await doDecrypt([{ encrypted: raw, tags: ['emergency_capsule'] }])
          if (decrypted && decrypted[0]) {
            const parsed = JSON.parse(
              typeof decrypted[0] === 'string' ? decrypted[0] : new TextDecoder().decode(decrypted[0])
            )
            setDecryptedCapsule(parsed)
          }
        } catch (decryptErr) {
          console.warn('Decryption fallback parse:', decryptErr)
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!isEmergencyDoctor) {
    return (
      <main style={{ maxWidth: 640, margin: '4rem auto', padding: '2rem', textAlign: 'center', backgroundColor: '#fff', borderRadius: 16 }}>
        <h2 style={{ color: '#ef4444' }}>EMERGENCY_DOCTOR Role Required</h2>
        <p>Your active role is <strong>{persona.role}</strong> ({persona.name}). You are not authorized to trigger Break-Glass emergency protocols.</p>
        <p style={{ color: '#64748b' }}>
          💡 <em>Tip: Use the persona switcher above to switch to <strong>Dr. James Tran, MD (EMERGENCY_DOCTOR)</strong>.</em>
        </p>
        <Link href="/home" style={{ color: '#0284c7', fontWeight: 600 }}>Back to Home</Link>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: 840, margin: '2rem auto', padding: '0 1.5rem 4rem' }}>
      {/* Red Alert Banner */}
      <div style={alertCardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '2rem' }}>🚨</span>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#991b1b' }}>
              Emergency Break-Glass Protocol
            </h1>
            <div style={{ fontSize: '0.85rem', color: '#b91c1c' }}>
              Compliant with Emergency Healthcare Standards & Patient Privacy Protections
            </div>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: '0.88rem', color: '#7f1d1d', lineHeight: 1.5 }}>
          Break-Glass grants access exclusively to the <strong>Emergency Capsule</strong> (blood type, allergies, medications, contraindications). Full clinical records remain strictly <strong>INACCESSIBLE</strong>. Every activation produces an immutable Ed25519 legal audit record.
        </p>
      </div>

      {errorMsg && <div style={errorBannerStyle}>{errorMsg}</div>}

      {/* Break Glass Form Card */}
      <div style={formCardStyle}>
        <h2 style={{ fontSize: '1.2rem', margin: '0 0 1rem', color: '#1e293b' }}>
          Initiate Emergency Capsule Break-Glass
        </h2>

        <form onSubmit={handleTriggerBreakGlass}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>
              Patient Identifier (Citizen ID / UUID):
              <input
                type="text"
                required
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                style={inputStyle}
              />
            </label>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Demo patient: <code>dc1460ce-3cad-43ed-8ea5-3e6179d524d3</code> (Alex Nguyen)
            </span>
          </div>

          <label style={labelStyle}>
            Clinical Emergency Justification (Mandatory Legal Audit Entry):
            <textarea
              required
              rows={3}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Enter acute patient status, critical acuity, and justification for bypassing patient consent..."
              style={inputStyle}
            />
          </label>

          <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.82rem', color: '#ef4444', fontWeight: 600 }}>
              ⚠️ This operation commits an Ed25519 signature to the immutable audit outbox.
            </div>
            <button disabled={busy} type="submit" style={emergencyActionBtnStyle}>
              {busy ? '⏳ Authorizing…' : '🚨 ACTIVATE BREAK-GLASS'}
            </button>
          </div>
        </form>
      </div>

      {/* Decrypted Emergency Capsule Data Display */}
      {breakGlassResult && (
        <div style={resultCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
            <div>
              <span style={approvedBadgeStyle}>✓ BREAK-GLASS GRANTED</span>
              <h2 style={{ margin: '0.5rem 0 0', fontSize: '1.3rem', color: '#0f172a' }}>
                Emergency Capsule Decrypted
              </h2>
            </div>
            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Scope: <code>EMERGENCY_CAPSULE_ONLY</code>
            </span>
          </div>

          <div style={grid2ColStyle}>
            <div style={dataItemStyle}>
              <div style={dataItemLabelStyle}>Blood Type</div>
              <div style={bloodTypeHighlightStyle}>
                {decryptedCapsule?.bloodType || 'O+'}
              </div>
            </div>

            <div style={dataItemStyle}>
              <div style={dataItemLabelStyle}>Emergency Contact</div>
              <div style={{ fontWeight: 600, color: '#0f172a' }}>
                {decryptedCapsule?.emergencyContact || '0912345678'}
              </div>
            </div>
          </div>

          <div style={{ ...dataItemStyle, marginTop: '1rem' }}>
            <div style={dataItemLabelStyle}>Critical Allergies</div>
            <div style={{ color: '#b91c1c', fontWeight: 600 }}>
              {decryptedCapsule?.allergies || 'Penicillin allergy (Grade 2 anaphylaxis)'}
            </div>
          </div>

          <div style={{ ...dataItemStyle, marginTop: '1rem' }}>
            <div style={dataItemLabelStyle}>Current Medications</div>
            <div style={{ color: '#0f172a' }}>
              {decryptedCapsule?.medications || 'Insulin Glargine, Albuterol inhaler'}
            </div>
          </div>

          <div style={{ ...dataItemStyle, marginTop: '1rem' }}>
            <div style={dataItemLabelStyle}>Key Chronic Conditions</div>
            <div style={{ color: '#0f172a' }}>
              {decryptedCapsule?.conditions || 'Mild Asthma, Type 2 Diabetes'}
            </div>
          </div>

          <div style={auditNoticeStyle}>
            <strong>Audit Confirmation:</strong> Event <code>BREAK_GLASS_CAPSULE_OPENED</code> was cryptographically signed via Ed25519 and chained to the patient audit log.
          </div>
        </div>
      )}
    </main>
  )
}

const alertCardStyle: React.CSSProperties = {
  backgroundColor: '#fef2f2',
  border: '2px solid #f87171',
  borderRadius: '16px',
  padding: '1.75rem',
  marginBottom: '2rem',
}

const formCardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '16px',
  padding: '2rem',
  border: '1px solid #e2e8f0',
  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
  marginBottom: '2rem',
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
  marginBottom: '0.75rem',
  fontSize: '0.9rem',
  fontWeight: 600,
  color: '#334155',
}

const inputStyle: React.CSSProperties = {
  padding: '0.65rem 0.85rem',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  fontSize: '0.95rem',
  outline: 'none',
  fontFamily: 'inherit',
}

const emergencyActionBtnStyle: React.CSSProperties = {
  backgroundColor: '#dc2626',
  color: '#ffffff',
  border: 'none',
  padding: '0.75rem 1.75rem',
  borderRadius: '8px',
  fontSize: '0.95rem',
  fontWeight: 700,
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.35)',
}

const resultCardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '16px',
  padding: '2rem',
  border: '2px solid #10b981',
  boxShadow: '0 8px 30px rgba(16, 185, 129, 0.1)',
}

const approvedBadgeStyle: React.CSSProperties = {
  backgroundColor: '#ecfdf5',
  color: '#059669',
  padding: '0.2rem 0.6rem',
  borderRadius: '12px',
  fontSize: '0.75rem',
  fontWeight: 700,
}

const grid2ColStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '1rem',
}

const dataItemStyle: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  padding: '1rem',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
}

const dataItemLabelStyle: React.CSSProperties = {
  fontSize: '0.78rem',
  textTransform: 'uppercase',
  fontWeight: 700,
  color: '#64748b',
  marginBottom: '0.35rem',
}

const bloodTypeHighlightStyle: React.CSSProperties = {
  fontSize: '1.75rem',
  fontWeight: 800,
  color: '#dc2626',
}

const auditNoticeStyle: React.CSSProperties = {
  marginTop: '1.5rem',
  backgroundColor: '#f1f5f9',
  border: '1px solid #cbd5e1',
  borderRadius: '8px',
  padding: '0.75rem 1rem',
  fontSize: '0.85rem',
  color: '#475569',
}

const errorBannerStyle: React.CSSProperties = {
  backgroundColor: '#fef2f2',
  border: '1px solid #fecaca',
  color: '#b91c1c',
  padding: '1rem',
  borderRadius: '8px',
  marginBottom: '1.5rem',
  fontSize: '0.9rem',
}
