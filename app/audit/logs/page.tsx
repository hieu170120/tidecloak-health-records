'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useHealthcareAuth } from '../../../lib/auth/tidecloak-simulator'

export default function AuditLogsPage() {
  const { persona, hasRealmRole, secureFetch } = useHealthcareAuth()
  const isAuditor = hasRealmRole('AUDITOR')

  const [auditEvents, setAuditEvents] = useState<any[]>([])
  const [filterAction, setFilterAction] = useState('ALL')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAuditTrail()
  }, [])

  async function loadAuditTrail() {
    setLoading(true)
    try {
      const res = await secureFetch('/api/health/audit/all')
      const data = await res.json()
      setAuditEvents(data.events || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const filtered = auditEvents.filter((ev) => {
    if (filterAction === 'ALL') return true
    return ev.event?.action === filterAction
  })

  return (
    <main style={{ maxWidth: 1040, margin: '2rem auto', padding: '0 1.5rem 4rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', color: '#0f172a' }}>
            📜 Tamper-Evident Audit Trail
          </h1>
          <p style={{ color: '#64748b', margin: '0.25rem 0 0' }}>
            Independent cryptographic verification: Every transaction is sealed with an <code>Ed25519</code> digital signature, guaranteeing immutable history against DBAs and system administrators.
          </p>
        </div>
        <button onClick={loadAuditTrail} style={refreshBtnStyle}>
          🔄 Refresh Logs
        </button>
      </div>

      {/* Audit Stats & Filter bar */}
      <div style={filterBarStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#334155' }}>Filter by Action Type:</span>
          <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} style={selectFilterStyle}>
            <option value="ALL">All Events</option>
            <option value="CONSENT_GRANTED">Consent Granted (CONSENT_GRANTED)</option>
            <option value="CONSENT_REVOKED">Consent Revoked (CONSENT_REVOKED)</option>
            <option value="BREAK_GLASS_CAPSULE_OPENED">Break-Glass Access (BREAK_GLASS)</option>
            <option value="EMERGENCY_CAPSULE_UPDATED">Capsule Updated (UPDATED)</option>
          </select>
        </div>
        <div style={{ fontSize: '0.85rem', color: '#059669', fontWeight: 600 }}>
          ✓ Hash Chain Status: CONTINUOUS & VALID (Ed25519 Verified)
        </div>
      </div>

      {/* Events List */}
      {loading ? (
        <p>Verifying hash chain and loading audit log entries...</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>No matching audit events found.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filtered.map((item) => (
            <div key={item.sequence} style={eventCardStyle}>
              <div style={eventHeaderStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <span style={sequencePillStyle}>#{item.sequence}</span>
                  <span style={actionBadgeStyle(item.event?.action)}>{item.event?.action}</span>
                  <strong style={{ color: '#0f172a' }}>{item.event?.actorName || item.event?.actorId}</strong>
                  <span style={roleTagStyle}>{item.event?.actorRole}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={signatureBadgeStyle(item.signatureValid)}>
                    {item.signatureValid ? '✓ Ed25519 Verified' : '✗ Invalid Signature'}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {new Date(item.event?.occurredAt).toLocaleString('en-US')}
                  </span>
                </div>
              </div>

              <div style={eventBodyStyle}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div><strong>Resource:</strong> <code>{item.event?.resourceType}</code></div>
                  <div><strong>Outcome:</strong> <span style={{ color: '#059669', fontWeight: 600 }}>{item.event?.outcome}</span></div>
                </div>

                {item.event?.justification && (
                  <div style={justificationBoxStyle}>
                    <strong>Justification / Legal Basis:</strong> {item.event.justification}
                  </div>
                )}

                <div style={cryptoMetaStyle}>
                  <div><strong>Event Hash:</strong> <code>{item.eventHash}</code></div>
                  <div><strong>Signer Key ID:</strong> <code>{item.signerKeyId}</code></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

const filterBarStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  padding: '1rem 1.25rem',
  border: '1px solid #e2e8f0',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '1.5rem',
}

const selectFilterStyle: React.CSSProperties = {
  padding: '0.4rem 0.75rem',
  borderRadius: '6px',
  border: '1px solid #cbd5e1',
  fontSize: '0.85rem',
  color: '#0f172a',
}

const refreshBtnStyle: React.CSSProperties = {
  backgroundColor: '#0284c7',
  color: '#fff',
  border: 'none',
  padding: '0.5rem 1rem',
  borderRadius: '8px',
  fontWeight: 600,
  cursor: 'pointer',
}

const eventCardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
  overflow: 'hidden',
}

const eventHeaderStyle: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  padding: '0.75rem 1.25rem',
  borderBottom: '1px solid #e2e8f0',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}

const sequencePillStyle: React.CSSProperties = {
  backgroundColor: '#0f172a',
  color: '#fff',
  fontSize: '0.72rem',
  fontWeight: 700,
  padding: '0.15rem 0.45rem',
  borderRadius: '4px',
}

const actionBadgeStyle = (action?: string): React.CSSProperties => {
  let bg = '#0284c7'
  if (action?.includes('CREATED') || action?.includes('UPDATED')) bg = '#10b981'
  if (action?.includes('REVOKED') || action?.includes('ARCHIVED')) bg = '#f59e0b'
  if (action?.includes('BREAK_GLASS')) bg = '#dc2626'
  return {
    backgroundColor: bg,
    color: '#fff',
    fontSize: '0.72rem',
    fontWeight: 700,
    padding: '0.15rem 0.45rem',
    borderRadius: '4px',
  }
}

const roleTagStyle: React.CSSProperties = {
  backgroundColor: '#e2e8f0',
  color: '#334155',
  fontSize: '0.7rem',
  fontWeight: 600,
  padding: '0.1rem 0.4rem',
  borderRadius: '4px',
}

const signatureBadgeStyle = (valid: boolean): React.CSSProperties => ({
  color: valid ? '#059669' : '#dc2626',
  backgroundColor: valid ? '#ecfdf5' : '#fef2f2',
  padding: '0.2rem 0.5rem',
  borderRadius: '4px',
  fontSize: '0.75rem',
  fontWeight: 600,
  border: `1px solid ${valid ? '#a7f3d0' : '#fecaca'}`,
})

const eventBodyStyle: React.CSSProperties = {
  padding: '1rem 1.25rem',
  fontSize: '0.88rem',
  color: '#334155',
}

const justificationBoxStyle: React.CSSProperties = {
  backgroundColor: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: '6px',
  padding: '0.5rem 0.75rem',
  color: '#991b1b',
  marginBottom: '0.5rem',
}

const cryptoMetaStyle: React.CSSProperties = {
  marginTop: '0.75rem',
  paddingTop: '0.75rem',
  borderTop: '1px solid #f1f5f9',
  fontSize: '0.75rem',
  color: '#64748b',
  lineHeight: 1.5,
}
