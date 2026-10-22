'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useHealthcareAuth } from '../../../lib/auth/tidecloak-simulator'

export default function PatientRecordsPage() {
  const { persona, hasRealmRole, secureFetch, doEncrypt, doDecrypt } = useHealthcareAuth()
  const isPatient = hasRealmRole('PATIENT')

  const [records, setRecords] = useState<any[]>([])
  const [consents, setConsents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddRecord, setShowAddRecord] = useState(false)
  const [showAddConsent, setShowAddConsent] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  // New Record Form State
  const [newTitle, setNewTitle] = useState('')
  const [newType, setNewType] = useState('DIAGNOSIS')
  const [newFacility, setNewFacility] = useState('University Medical Center')
  const [newContent, setNewContent] = useState('')

  // New Consent Form State
  const [consentDoctor, setConsentDoctor] = useState('b74301a2-45e1-4cfa-9310-82a17fbb3011')
  const [consentScope, setConsentScope] = useState<'ALL' | 'PRESCRIPTIONS_ONLY' | 'LABS_ONLY'>('ALL')
  const [consentHours, setConsentHours] = useState(72)

  async function loadData() {
    setLoading(true)
    try {
      const recRes = await secureFetch('/api/health/me/records')
      const recData = await recRes.json()
      setRecords(recData.records || [])

      const csRes = await secureFetch('/api/health/me/consents')
      const csData = await csRes.json()
      setConsents(csData.consents || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isPatient) {
      loadData()
    }
  }, [isPatient])

  async function handleCreateRecord(e: React.FormEvent) {
    e.preventDefault()
    try {
      // Encrypt record data with Tide tag
      const [encrypted] = await doEncrypt([
        { data: newContent, tags: ['clinical_record', `type_${newType.toLowerCase()}`] },
      ])

      const res = await secureFetch('/api/health/me/records', {
        method: 'POST',
        body: JSON.stringify({
          title: newTitle,
          recordType: newType,
          facility: newFacility,
          encryptedData: encrypted,
          tags: ['clinical_record'],
        }),
      })

      if (res.ok) {
        setStatusMsg('✅ E2EE encrypted and clinical record saved successfully!')
        setShowAddRecord(false)
        setNewTitle('')
        setNewContent('')
        loadData()
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
  }

  async function handleGrantConsent(e: React.FormEvent) {
    e.preventDefault()
    try {
      const res = await secureFetch('/api/health/me/consents', {
        method: 'POST',
        body: JSON.stringify({
          doctorId: consentDoctor,
          doctorName: 'Dr. Emily Mai, MD',
          scope: consentScope,
          ttlHours: Number(consentHours),
        }),
      })

      if (res.ok) {
        setStatusMsg('✅ Physician consent granted successfully (effective immediately)!')
        setShowAddConsent(false)
        loadData()
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
  }

  async function handleRevokeConsent(consentId: string) {
    if (!window.confirm('Are you sure you want to immediately revoke physician access?')) return
    try {
      const res = await secureFetch(`/api/health/me/consents/${consentId}`, { method: 'DELETE' })
      if (res.ok) {
        setStatusMsg('⚠️ Access revoked. Physician can no longer decrypt these records.')
        loadData()
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    }
  }

  if (!isPatient) {
    return (
      <main style={{ maxWidth: 640, margin: '4rem auto', padding: '2rem', textAlign: 'center', backgroundColor: '#fff', borderRadius: 16 }}>
        <h2 style={{ color: '#ef4444' }}>PATIENT Role Required</h2>
        <p>Your active role is <strong>{persona.role}</strong>. Please switch to <strong>Alex Nguyen (PATIENT)</strong> in the top switcher to manage clinical records and grant consents.</p>
        <Link href="/home" style={{ color: '#0284c7', fontWeight: 600 }}>Back to Home</Link>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: 1000, margin: '2rem auto', padding: '0 1.5rem 4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', color: '#0f172a' }}>Clinical Records & Consent Management</h1>
          <p style={{ color: '#64748b', margin: '0.25rem 0 0' }}>Zero-Trust clinical data protection. Patients retain sovereign cryptographic control over record decryption.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => setShowAddRecord(true)} style={primaryBtnStyle}>
            ➕ Add Record
          </button>
          <button onClick={() => setShowAddConsent(true)} style={accentBtnStyle}>
            🤝 Grant Doctor Consent
          </button>
        </div>
      </div>

      {statusMsg && <div style={successAlertStyle}>{statusMsg}</div>}

      {/* Consent Grants Section */}
      <div style={cardSectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.2rem', margin: 0, color: '#1e293b' }}>🤝 Active Consent Grants</h2>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Enforced by Tide Policy Engine</span>
        </div>

        {consents.length === 0 ? (
          <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>No active doctor consents granted.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
            {consents.map((cs) => {
              const isExpired = new Date(cs.expiresAt) < new Date()
              const isRevoked = cs.status === 'REVOKED'
              return (
                <div key={cs.id} style={consentCardStyle(isRevoked || isExpired)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>{cs.doctorName}</div>
                    <span style={statusBadgeStyle(isRevoked ? 'REVOKED' : isExpired ? 'EXPIRED' : 'ACTIVE')}>
                      {isRevoked ? 'Revoked' : isExpired ? 'Expired' : 'Active'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '0.5rem', lineHeight: 1.5 }}>
                    <div><strong>Scope:</strong> <code>{cs.scope}</code></div>
                    <div><strong>Expires:</strong> {new Date(cs.expiresAt).toLocaleString('en-US')}</div>
                  </div>
                  {!isRevoked && !isExpired && (
                    <button onClick={() => handleRevokeConsent(cs.id)} style={revokeBtnStyle}>
                      🚫 Revoke Access
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Clinical Records Section */}
      <div style={cardSectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.2rem', margin: 0, color: '#1e293b' }}>📋 E2EE Encrypted Clinical Records</h2>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Tag: <code>clinical_record</code></span>
        </div>

        {loading ? (
          <p>Loading clinical records...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {records.map((rec) => (
              <div key={rec.id} style={recordItemStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <span style={typeBadgeStyle(rec.recordType)}>{rec.recordType}</span>
                    <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>{rec.title}</strong>
                  </div>
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{new Date(rec.createdAt).toLocaleDateString('en-US')}</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: '0.5rem' }}>
                  🏥 Facility: <strong>{rec.facility}</strong>
                </div>
                <div style={recordCipherPreviewStyle}>
                  <strong>Server-Stored Ciphertext:</strong> <code>{rec.encryptedData.slice(0, 100)}...</code>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Add Record */}
      {showAddRecord && (
        <div style={modalBackdropStyle} onClick={() => setShowAddRecord(false)}>
          <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1rem' }}>➕ Add Clinical Record (Client-side Encrypted)</h3>
            <form onSubmit={handleCreateRecord}>
              <label style={labelStyle}>
                Record Title:
                <input required type="text" placeholder="e.g., Liver Function Panel (LFT)" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} style={inputStyle} />
              </label>
              <label style={labelStyle}>
                Record Type:
                <select value={newType} onChange={(e) => setNewType(e.target.value)} style={inputStyle}>
                  <option value="DIAGNOSIS">Diagnosis (DIAGNOSIS)</option>
                  <option value="LAB_RESULT">Lab Results (LAB_RESULT)</option>
                  <option value="PRESCRIPTION">Prescription (PRESCRIPTION)</option>
                  <option value="IMAGING">Imaging / Radiology (IMAGING)</option>
                </select>
              </label>
              <label style={labelStyle}>
                Healthcare Facility:
                <input required type="text" value={newFacility} onChange={(e) => setNewFacility(e.target.value)} style={inputStyle} />
              </label>
              <label style={labelStyle}>
                Detailed Clinical Notes (Client-encrypted via Tide):
                <textarea required rows={4} placeholder="Enter clinical findings, lab values, or prescription..." value={newContent} onChange={(e) => setNewContent(e.target.value)} style={inputStyle} />
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowAddRecord(false)} style={cancelBtnStyle}>Cancel</button>
                <button type="submit" style={primaryBtnStyle}>🔒 Encrypt & Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Add Consent */}
      {showAddConsent && (
        <div style={modalBackdropStyle} onClick={() => setShowAddConsent(false)}>
          <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1rem' }}>🤝 Grant Consent to Physician (Tide Policy Engine)</h3>
            <form onSubmit={handleGrantConsent}>
              <label style={labelStyle}>
                Select Physician:
                <select value={consentDoctor} onChange={(e) => setConsentDoctor(e.target.value)} style={inputStyle}>
                  <option value="b74301a2-45e1-4cfa-9310-82a17fbb3011">Dr. Emily Mai, MD (Internal Medicine)</option>
                </select>
              </label>
              <label style={labelStyle}>
                Consent Scope:
                <select value={consentScope} onChange={(e: any) => setConsentScope(e.target.value)} style={inputStyle}>
                  <option value="ALL">All Records (ALL)</option>
                  <option value="PRESCRIPTIONS_ONLY">Prescriptions Only (PRESCRIPTIONS_ONLY)</option>
                  <option value="LABS_ONLY">Lab Results Only (LABS_ONLY)</option>
                </select>
              </label>
              <label style={labelStyle}>
                Access TTL (Hours):
                <input type="number" min={1} max={720} value={consentHours} onChange={(e) => setConsentHours(Number(e.target.value))} style={inputStyle} />
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowAddConsent(false)} style={cancelBtnStyle}>Cancel</button>
                <button type="submit" style={accentBtnStyle}>✍️ Sign & Grant Consent</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}

const cardSectionStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '16px',
  padding: '1.75rem',
  border: '1px solid #e2e8f0',
  boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
  marginBottom: '2rem',
}

const consentCardStyle = (inactive: boolean): React.CSSProperties => ({
  backgroundColor: inactive ? '#f8fafc' : '#f0fdf4',
  border: `1px solid ${inactive ? '#e2e8f0' : '#bbf7d0'}`,
  borderRadius: '12px',
  padding: '1.25rem',
  opacity: inactive ? 0.75 : 1,
})

const statusBadgeStyle = (status: string): React.CSSProperties => {
  let bg = '#10b981'
  if (status === 'REVOKED') bg = '#f43f5e'
  if (status === 'EXPIRED') bg = '#94a3b8'
  return {
    backgroundColor: bg,
    color: '#fff',
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
  }
}

const typeBadgeStyle = (type: string): React.CSSProperties => {
  let bg = '#3b82f6'
  if (type === 'PRESCRIPTION') bg = '#8b5cf6'
  if (type === 'LAB_RESULT') bg = '#06b6d4'
  return {
    backgroundColor: bg,
    color: '#fff',
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
  }
}

const recordItemStyle: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  padding: '1.25rem',
}

const recordCipherPreviewStyle: React.CSSProperties = {
  marginTop: '0.75rem',
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '6px',
  padding: '0.5rem 0.75rem',
  fontSize: '0.75rem',
  color: '#64748b',
}

const revokeBtnStyle: React.CSSProperties = {
  marginTop: '0.85rem',
  backgroundColor: '#fee2e2',
  color: '#b91c1c',
  border: '1px solid #fca5a5',
  padding: '0.4rem 0.75rem',
  borderRadius: '6px',
  fontSize: '0.8rem',
  fontWeight: 600,
  cursor: 'pointer',
}

const primaryBtnStyle: React.CSSProperties = {
  backgroundColor: '#0284c7',
  color: '#ffffff',
  border: 'none',
  padding: '0.65rem 1.25rem',
  borderRadius: '8px',
  fontWeight: 600,
  cursor: 'pointer',
}

const accentBtnStyle: React.CSSProperties = {
  backgroundColor: '#059669',
  color: '#ffffff',
  border: 'none',
  padding: '0.65rem 1.25rem',
  borderRadius: '8px',
  fontWeight: 600,
  cursor: 'pointer',
}

const cancelBtnStyle: React.CSSProperties = {
  backgroundColor: '#f1f5f9',
  color: '#475569',
  border: '1px solid #cbd5e1',
  padding: '0.65rem 1.25rem',
  borderRadius: '8px',
  fontWeight: 600,
  cursor: 'pointer',
}

const successAlertStyle: React.CSSProperties = {
  backgroundColor: '#ecfdf5',
  border: '1px solid #a7f3d0',
  color: '#065f46',
  padding: '0.85rem 1rem',
  borderRadius: '8px',
  marginBottom: '1.5rem',
  fontSize: '0.9rem',
}

const modalBackdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(15, 23, 42, 0.7)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: '1rem',
}

const modalCardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '16px',
  maxWidth: 540,
  width: '100%',
  padding: '2rem',
  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  marginBottom: '1rem',
  fontSize: '0.88rem',
  fontWeight: 600,
  color: '#334155',
}

const inputStyle: React.CSSProperties = {
  padding: '0.6rem 0.75rem',
  borderRadius: '6px',
  border: '1px solid #cbd5e1',
  fontSize: '0.9rem',
}
