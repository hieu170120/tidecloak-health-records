'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useHealthcareAuth } from '../../../lib/auth/tidecloak-simulator'

export default function DoctorDashboardPage() {
  const { persona, hasRealmRole, secureFetch } = useHealthcareAuth()
  const isDoctor = hasRealmRole('DOCTOR')

  const [patients, setPatients] = useState<any[]>([])
  const [selectedPatient, setSelectedPatient] = useState<any>(null)
  const [patientRecords, setPatientRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (isDoctor) {
      loadPatients()
    }
  }, [isDoctor])

  async function loadPatients() {
    try {
      const res = await secureFetch('/api/health/doctor/patients')
      const data = await res.json()
      setPatients(data.patients || [])
      if (data.patients && data.patients.length > 0) {
        loadPatientRecords(data.patients[0].patientId)
      }
    } catch (e: any) {
      setErrorMsg(e.message)
    }
  }

  async function loadPatientRecords(patientId: string) {
    setLoading(true)
    setErrorMsg('')
    try {
      const res = await secureFetch(`/api/health/doctor/patient/${patientId}`)
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error || 'Access Denied')
        setPatientRecords([])
      } else {
        setPatientRecords(data.records || [])
        setSelectedPatient(patients.find((p) => p.patientId === patientId) || { patientId })
      }
    } catch (e: any) {
      setErrorMsg(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isDoctor) {
    return (
      <main style={{ maxWidth: 640, margin: '4rem auto', padding: '2rem', textAlign: 'center', backgroundColor: '#fff', borderRadius: 16 }}>
        <h2 style={{ color: '#ef4444' }}>DOCTOR Role Required</h2>
        <p>Your active role is <strong>{persona.role}</strong> ({persona.name}). You do not have permission to access the physician portal.</p>
        <p style={{ color: '#64748b' }}>
          💡 <em>Tip: Use the persona switcher above to switch to <strong>Dr. Emily Mai, MD (DOCTOR)</strong>.</em>
        </p>
        <Link href="/home" style={{ color: '#0284c7', fontWeight: 600 }}>Back to Home</Link>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: 1100, margin: '2rem auto', padding: '0 1.5rem 4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', color: '#0f172a' }}>Physician Clinical Portal</h1>
          <p style={{ color: '#64748b', margin: '0.25rem 0 0' }}>Physician: <strong>{persona.name}</strong> • Internal Medicine</p>
        </div>
        <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '0.4rem 0.85rem', borderRadius: 20, fontSize: '0.85rem', fontWeight: 600 }}>
          🔒 Tide DPoP Bound Session
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem' }}>
        {/* Left: Consented Patients list */}
        <div style={sidebarCardStyle}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', color: '#1e293b' }}>Consented Patients</h3>
          {patients.length === 0 ? (
            <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>No patients have granted consent.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {patients.map((p) => {
                const isSelected = selectedPatient?.patientId === p.patientId
                const consent = p.activeConsent
                return (
                  <div
                    key={p.patientId}
                    onClick={() => loadPatientRecords(p.patientId)}
                    style={patientSelectCardStyle(isSelected)}
                  >
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{p.patientName}</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
                      DOB: {p.dob}
                    </div>
                    <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={scopeBadgeStyle}>{consent?.scope || 'CONSENT'}</span>
                      <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>
                        {consent ? 'Active' : 'Revoked'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right: Decrypted Records within Consent Scope */}
        <div style={mainContentCardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#0f172a' }}>
                Authorized Clinical Records
              </h2>
              {selectedPatient && (
                <div style={{ fontSize: '0.88rem', color: '#64748b', marginTop: '0.25rem' }}>
                  Patient: <strong>{selectedPatient.patientName || 'Alex Nguyen'}</strong> • ID: <code>{selectedPatient.patientId}</code>
                </div>
              )}
            </div>
            <button onClick={() => selectedPatient && loadPatientRecords(selectedPatient.patientId)} style={refreshBtnStyle}>
              🔄 Refresh
            </button>
          </div>

          {errorMsg && (
            <div style={errorBannerStyle}>
              <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>🚫 Access Denied by Tide Policy Engine</div>
              <div>{errorMsg}</div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: '#991b1b' }}>
                Notice: If the patient has revoked consent, the physician can immediately no longer retrieve or decrypt these records.
              </div>
            </div>
          )}

          {loading ? (
            <p>Authorizing access & decrypting clinical records...</p>
          ) : patientRecords.length === 0 && !errorMsg ? (
            <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>No clinical records match the granted consent scope.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {patientRecords.map((r) => (
                <div key={r.id} style={recordCardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span style={recordTypeBadgeStyle(r.recordType)}>{r.recordType}</span>
                      <strong style={{ fontSize: '1.05rem', color: '#0f172a' }}>{r.title}</strong>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{new Date(r.createdAt).toLocaleDateString('en-US')}</span>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: '#475569', margin: '0.4rem 0' }}>
                    Facility: <strong>{r.facility}</strong>
                  </div>

                  {/* Decrypted Clinical Plaintext View */}
                  <div style={decryptedBoxStyle}>
                    <div style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 700, marginBottom: '0.25rem' }}>
                      ✓ Decrypted Clinical Findings (Doctor Session):
                    </div>
                    <div style={{ color: '#1e293b', fontSize: '0.9rem', lineHeight: 1.5 }}>
                      {r.encryptedData.replace(/^TIDE:ENC:GCM:[^.]+.../, '') || r.encryptedData}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

const sidebarCardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '16px',
  padding: '1.5rem',
  border: '1px solid #e2e8f0',
  boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
  height: 'fit-content',
}

const mainContentCardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '16px',
  padding: '1.75rem',
  border: '1px solid #e2e8f0',
  boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
}

const patientSelectCardStyle = (selected: boolean): React.CSSProperties => ({
  backgroundColor: selected ? '#f0f9ff' : '#f8fafc',
  border: `1px solid ${selected ? '#0284c7' : '#e2e8f0'}`,
  borderRadius: '10px',
  padding: '0.85rem',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
})

const scopeBadgeStyle: React.CSSProperties = {
  backgroundColor: '#e0f2fe',
  color: '#0369a1',
  fontSize: '0.72rem',
  fontWeight: 700,
  padding: '0.15rem 0.45rem',
  borderRadius: '4px',
}

const refreshBtnStyle: React.CSSProperties = {
  backgroundColor: '#f1f5f9',
  border: '1px solid #cbd5e1',
  padding: '0.4rem 0.75rem',
  borderRadius: '6px',
  fontSize: '0.85rem',
  cursor: 'pointer',
  fontWeight: 600,
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

const recordCardStyle: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  padding: '1.25rem',
}

const recordTypeBadgeStyle = (type: string): React.CSSProperties => {
  let bg = '#0284c7'
  if (type === 'PRESCRIPTION') bg = '#7c3aed'
  if (type === 'LAB_RESULT') bg = '#0891b2'
  return {
    backgroundColor: bg,
    color: '#fff',
    fontSize: '0.72rem',
    fontWeight: 700,
    padding: '0.15rem 0.45rem',
    borderRadius: '4px',
  }
}

const decryptedBoxStyle: React.CSSProperties = {
  backgroundColor: '#ecfdf5',
  border: '1px solid #a7f3d0',
  borderRadius: '8px',
  padding: '0.75rem 1rem',
  marginTop: '0.75rem',
}
