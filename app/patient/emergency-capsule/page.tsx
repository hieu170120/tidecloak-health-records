'use client'

import { useHealthcareAuth } from '../../../lib/auth/tidecloak-simulator'
import { useEffect, useState } from 'react'
import Link from 'next/link'

const TAG = 'emergency_capsule'
const empty = { bloodType: '', allergies: '', medications: '', conditions: '', emergencyContact: '' }

function toBase64(bytes: Uint8Array) {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function fromBase64(text: string) {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0))
}

export default function CapsulePage() {
  const {
    authenticated,
    isInitializing,
    initError,
    login,
    hasRealmRole,
    hasClientRole,
    getValueFromToken,
    getToken,
    secureFetch,
    doEncrypt,
    doDecrypt,
    persona,
  } = useHealthcareAuth()

  const subject = String(getValueFromToken('sub') ?? '')
  const patient = hasRealmRole('PATIENT') || hasClientRole('PATIENT')

  useEffect(() => {
    console.log('[auth-debug] capsule:state', {
      authenticated,
      isInitializing,
      hasInitError: !!initError,
      hasPatientRole: patient,
    })
  }, [authenticated, isInitializing, initError, patient])

  const [sessionOwner, setSessionOwner] = useState('')
  function checkSession() {
    if (String(getValueFromToken('sub') ?? '') !== subject)
      throw Error('Active session changed; please reload.')
  }

  const [form, setForm] = useState(empty)
  const [version, setVersion] = useState(0)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [audit, setAudit] = useState<any>(null)
  const [lastSavedCiphertext, setLastSavedCiphertext] = useState('')

  async function api(path: string, method = 'GET', body?: unknown) {
    checkSession()
    const token = await getToken()
    if (!token) throw Error('Please re-authenticate to continue.')
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/api/health/${path}`
        : `/api/health/${path}`
    const response = await secureFetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    console.log('[auth-debug] capsule:api', { path, method, status: response.status })
    const data = await response.json()
    checkSession()
    if (!response.ok)
      throw Error(typeof data.message === 'string' ? data.message : data.error ?? `API ${response.status}`)
    return data
  }

  async function load() {
    setBusy(true)
    setError('')
    setReady(false)
    setForm(empty)
    setAudit(null)
    setStatus('')
    setVersion(0)
    setSessionOwner(subject)
    try {
      await api('me')
      const result = await api('me/emergency-capsule')
      checkSession()
      setVersion(result.latestVersion)
      if (result.capsule) {
        setLastSavedCiphertext(result.capsule.ciphertext)
        const bytes = fromBase64(result.capsule.ciphertext)
        const value =
          result.capsule.ciphertextFormat === 'TIDE_STRING' ? new TextDecoder().decode(bytes) : bytes
        const decrypted = await doDecrypt([{ encrypted: value, tags: [TAG] }])
        if (!decrypted || decrypted.length !== 1) throw Error('Tide returned no decrypted data.')
        checkSession()
        const decoded = JSON.parse(
          typeof decrypted[0] === 'string' ? decrypted[0] : new TextDecoder().decode(decrypted[0])
        )
        if (Object.keys(empty).some((k) => typeof decoded[k] !== 'string'))
          throw Error('Invalid capsule format.')
        setForm(Object.fromEntries(Object.keys(empty).map((k) => [k, decoded[k]])) as typeof empty)
      } else {
        setForm(empty)
        setLastSavedCiphertext('')
      }
      setReady(true)
      setAudit(await api('me/audit'))
    } catch (e) {
      if (String(getValueFromToken('sub') ?? '') !== subject) return
      setError(e instanceof Error ? e.message : 'Failed to read capsule.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    setForm(empty)
    setAudit(null)
    setReady(false)
    setStatus('')
    if (authenticated && patient) void load()
  }, [authenticated, subject, patient])

  async function save() {
    setBusy(true)
    setError('')
    setStatus('')
    if (form.emergencyContact && form.emergencyContact.length !== 10) {
      setError('Emergency contact phone number must be exactly 10 digits (e.g. 0912345678).')
      setBusy(false)
      return
    }
    try {
      const values = await doEncrypt([{ data: JSON.stringify(form), tags: [TAG] }])
      checkSession()
      const encrypted = values?.[0]
      if (!encrypted || typeof encrypted !== 'string')
        throw Error('Tide did not return valid ciphertext.')
      const ctBase64 =
        typeof encrypted === 'string'
          ? toBase64(new TextEncoder().encode(encrypted))
          : toBase64(encrypted)
      const result = await api('me/emergency-capsule', 'PUT', {
        expectedVersion: version,
        ciphertext: ctBase64,
        ciphertextFormat: typeof encrypted === 'string' ? 'TIDE_STRING' : 'TIDE_BYTES',
      })
      setVersion(result.version)
      setLastSavedCiphertext(ctBase64)
      setStatus(`✅ Encrypted with Tide and saved version ${result.version}. Hash-chain audit event recorded.`)
      setAudit(await api('me/audit'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save capsule.')
    } finally {
      setBusy(false)
    }
  }

  async function archive() {
    setBusy(true)
    setError('')
    try {
      await api('me/emergency-capsule', 'DELETE', { expectedVersion: version })
      setForm(empty)
      setLastSavedCiphertext('')
      setStatus('⚠️ Current capsule archived; ciphertext history is preserved in audit logs.')
      setAudit(await api('me/audit'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to archive capsule.')
    } finally {
      setBusy(false)
    }
  }

  if (isInitializing) {
    return (
      <main style={centerContainerStyle}>
        <div style={loadingCardStyle}>Initializing TideCloak Enclave…</div>
      </main>
    )
  }

  if (!authenticated) {
    return (
      <main style={centerContainerStyle}>
        <div style={cardStyle}>
          <h1>Emergency Capsule</h1>
          <button style={primaryBtnStyle} onClick={() => {
            console.log('[auth-debug] capsule:login-click', { isInitializing, hasInitError: !!initError })
            void login().catch(() => console.error('[auth-debug] capsule:login-failed'))
          }}>
            Sign in via TideCloak
          </button>
        </div>
      </main>
    )
  }

  if (!patient) {
    return (
      <main style={centerContainerStyle}>
        <div style={cardStyle}>
          <h1 style={{ color: '#ef4444' }}>PATIENT Role Required</h1>
          <p>
            The active account ({persona.name} - <code>{persona.role}</code>) does not possess patient permissions.
          </p>
          <p style={{ color: '#64748b' }}>
            💡 <em>Tip: Use the persona switcher above to switch to <strong>Alex Nguyen (PATIENT)</strong>.</em>
          </p>
          <Link href="/home" style={linkBtnStyle}>
            Back to Home
          </Link>
        </div>
      </main>
    )
  }

  if (sessionOwner !== subject) {
    return (
      <main style={centerContainerStyle}>
        <div style={cardStyle}>Synchronizing TideCloak session…</div>
      </main>
    )
  }

  return (
    <main style={pageContainerStyle}>
      {/* Header Breadcrumb */}
      <div style={breadcrumbRowStyle}>
        <Link href="/home" style={backLinkStyle}>
          ← Back to Home
        </Link>
        <span style={securityPillStyle}>🔐 Tide E2EE Tag: {TAG}</span>
      </div>

      <div style={headerCardStyle}>
        <h1 style={{ margin: 0, fontSize: '1.75rem', color: '#0f172a' }}>
          Personal Emergency Capsule
        </h1>
        <p style={{ color: '#475569', marginTop: '0.5rem', lineHeight: 1.5 }}>
          Emergency clinical data is end-to-end encrypted (E2EE) under your sovereign decentralized identity. The server stores only raw <code>bytea</code> ciphertext and cannot access plaintext.
        </p>
        <div style={tagRequirementStyle}>
          <strong>Required TideCloak Grants:</strong>{' '}
          <code style={codePillStyle}>_tide_emergency_capsule.selfencrypt</code>{' '}
          <code style={codePillStyle}>_tide_emergency_capsule.selfdecrypt</code>
        </div>
      </div>

      {error && <div style={errorAlertStyle}>⚠️ {error}</div>}
      {status && <div style={successAlertStyle}>{status}</div>}

      {/* Main Capsule Form Card */}
      <div style={formCardStyle}>
        <div style={formHeaderStyle}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b' }}>Emergency Medical Profile</h2>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Current Stored Version: #{version}</div>
          </div>
          <button
            disabled={busy}
            onClick={() => void load()}
            style={secondaryBtnStyle}
            title="Fetch from server and decrypt using Tide keys"
          >
            🔄 {busy ? 'Decrypting…' : 'Reload & Decrypt'}
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <div style={grid2ColStyle}>
            <label style={labelStyle}>
              <span>Blood Type (Required):</span>
              <input
                type="text"
                required
                placeholder="e.g., O+, A+, B-, AB+..."
                value={form.bloodType}
                onChange={(e) => setForm({ ...form, bloodType: e.target.value })}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              <span>Emergency Contact (10-digit Phone):</span>
              <input
                type="tel"
                placeholder="e.g., 0912345678"
                maxLength={10}
                pattern="[0-9]{10}"
                title="Enter exactly 10 digits"
                value={form.emergencyContact}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/\D/g, '').slice(0, 10)
                  setForm({ ...form, emergencyContact: cleaned })
                }}
                style={inputStyle}
              />
            </label>
          </div>

          <label style={labelStyle}>
            <span>Allergies (Medications & Food):</span>
            <textarea
              maxLength={8000}
              placeholder="e.g., Penicillin, Aspirin, Shellfish, Peanuts..."
              value={form.allergies}
              onChange={(e) => setForm({ ...form, allergies: e.target.value })}
              style={textareaStyle}
            />
          </label>

          <label style={labelStyle}>
            <span>Current Daily Medications:</span>
            <textarea
              maxLength={8000}
              placeholder="e.g., Insulin Glargine 10 IU/day, Amlodipine 5mg..."
              value={form.medications}
              onChange={(e) => setForm({ ...form, medications: e.target.value })}
              style={textareaStyle}
            />
          </label>

          <label style={labelStyle}>
            <span>Chronic Conditions & Medical History:</span>
            <textarea
              maxLength={8000}
              placeholder="e.g., Chronic Asthma, Stage 2 Hypertension..."
              value={form.conditions}
              onChange={(e) => setForm({ ...form, conditions: e.target.value })}
              style={textareaStyle}
            />
          </label>

          {/* Action buttons */}
          <div style={actionRowStyle}>
            <button disabled={busy} type="submit" style={primaryBtnStyle}>
              {busy ? '⏳ Encrypting & saving…' : '🔒 Encrypt with Tide & Save'}
            </button>
            <button
              disabled={busy || version === 0}
              type="button"
              onClick={() => {
                if (window.confirm('Archive current capsule? Ciphertext history remains preserved in audit logs.'))
                  void archive()
              }}
              style={dangerBtnStyle}
            >
              📦 Archive Capsule
            </button>
          </div>
        </form>

        {/* Live Ciphertext Inspector */}
        {lastSavedCiphertext && (
          <div style={ciphertextBoxStyle}>
            <div style={{ fontWeight: 600, marginBottom: '0.3rem', fontSize: '0.8rem', color: '#0f172a' }}>
              🔒 Server-Stored Ciphertext (Zero-Knowledge Storage):
            </div>
            <div style={cipherSnippetStyle}>{lastSavedCiphertext.slice(0, 180)}... [protected via AES-GCM-256]</div>
          </div>
        )}
      </div>

      {/* Audit Trail Section */}
      <div style={auditSectionCardStyle}>
        <h2 style={{ fontSize: '1.25rem', margin: '0 0 0.5rem', color: '#1e293b' }}>
          📜 Access Audit Trail & Digital Signatures
        </h2>
        <p style={{ color: '#64748b', fontSize: '0.88rem', margin: '0 0 1rem' }}>
          Every read, write, update, or Break-Glass emergency access is cryptographically signed via <code>Ed25519</code> and linked into an immutable hash chain.
        </p>

        {audit?.events && audit.events.length > 0 ? (
          <div style={auditListStyle}>
            {audit.events.map((entry: any) => (
              <div key={entry.sequence} style={auditItemCardStyle}>
                <div style={auditItemHeaderStyle}>
                  <span style={actionBadgeStyle(entry.event?.action)}>
                    {entry.event?.action}
                  </span>
                  <span style={signatureBadgeStyle(entry.signatureValid)}>
                    {entry.signatureValid ? '✓ Ed25519 Signature Verified' : '✗ Verification Failed'}
                  </span>
                </div>
                <div style={auditItemBodyStyle}>
                  <div><strong>Timestamp:</strong> {new Date(entry.event?.occurredAt).toLocaleString('en-US')}</div>
                  <div><strong>Actor:</strong> {entry.event?.actorName || entry.event?.actorId} ({entry.event?.actorRole})</div>
                  {entry.event?.justification && (
                    <div style={{ color: '#b91c1c' }}><strong>Justification:</strong> {entry.event?.justification}</div>
                  )}
                  <div style={hashRowStyle}>
                    <strong>Event Hash:</strong> <code style={{ fontSize: '0.75rem' }}>{entry.eventHash}</code>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>No audit events recorded yet.</div>
        )}
      </div>
    </main>
  )
}

// Styling Tokens
const centerContainerStyle: React.CSSProperties = {
  minHeight: '70vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '2rem',
}

const loadingCardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  padding: '2rem 3rem',
  borderRadius: '12px',
  boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
  fontSize: '1.1rem',
  color: '#334155',
}

const cardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  padding: '2.5rem',
  borderRadius: '16px',
  boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
  maxWidth: 500,
  textAlign: 'center',
}

const pageContainerStyle: React.CSSProperties = {
  maxWidth: 820,
  margin: '2rem auto',
  padding: '0 1.5rem 4rem',
}

const breadcrumbRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '1rem',
}

const backLinkStyle: React.CSSProperties = {
  color: '#475569',
  textDecoration: 'none',
  fontSize: '0.9rem',
  fontWeight: 500,
}

const securityPillStyle: React.CSSProperties = {
  backgroundColor: '#ecfdf5',
  color: '#059669',
  padding: '0.25rem 0.65rem',
  borderRadius: '16px',
  fontSize: '0.8rem',
  fontWeight: 600,
  border: '1px solid #a7f3d0',
}

const headerCardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '16px',
  padding: '1.75rem',
  boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
  border: '1px solid #e2e8f0',
  marginBottom: '1.5rem',
}

const tagRequirementStyle: React.CSSProperties = {
  marginTop: '0.75rem',
  fontSize: '0.85rem',
  color: '#64748b',
}

const codePillStyle: React.CSSProperties = {
  backgroundColor: '#f1f5f9',
  padding: '0.15rem 0.4rem',
  borderRadius: '4px',
  color: '#0f172a',
  fontFamily: 'monospace',
  fontSize: '0.8rem',
}

const formCardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '16px',
  padding: '2rem',
  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
  border: '1px solid #e2e8f0',
  marginBottom: '2rem',
}

const formHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '1.5rem',
  paddingBottom: '1rem',
  borderBottom: '1px solid #f1f5f9',
}

const grid2ColStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: '1rem',
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.4rem',
  marginBottom: '1rem',
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
}

const textareaStyle: React.CSSProperties = {
  padding: '0.65rem 0.85rem',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  fontSize: '0.95rem',
  minHeight: 70,
  outline: 'none',
  fontFamily: 'inherit',
  resize: 'vertical',
}

const actionRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '1rem',
  marginTop: '1.5rem',
  paddingTop: '1rem',
  borderTop: '1px solid #f1f5f9',
}

const primaryBtnStyle: React.CSSProperties = {
  backgroundColor: '#0284c7',
  color: '#ffffff',
  border: 'none',
  padding: '0.75rem 1.75rem',
  borderRadius: '8px',
  fontSize: '0.95rem',
  fontWeight: 600,
  cursor: 'pointer',
}

const secondaryBtnStyle: React.CSSProperties = {
  backgroundColor: '#f1f5f9',
  color: '#334155',
  border: '1px solid #cbd5e1',
  padding: '0.5rem 1rem',
  borderRadius: '8px',
  fontSize: '0.88rem',
  fontWeight: 600,
  cursor: 'pointer',
}

const dangerBtnStyle: React.CSSProperties = {
  backgroundColor: '#fef2f2',
  color: '#dc2626',
  border: '1px solid #fecaca',
  padding: '0.75rem 1.25rem',
  borderRadius: '8px',
  fontSize: '0.95rem',
  fontWeight: 600,
  cursor: 'pointer',
}

const linkBtnStyle: React.CSSProperties = {
  display: 'inline-block',
  marginTop: '1.5rem',
  backgroundColor: '#0284c7',
  color: '#ffffff',
  textDecoration: 'none',
  padding: '0.65rem 1.25rem',
  borderRadius: '8px',
  fontWeight: 600,
}

const ciphertextBoxStyle: React.CSSProperties = {
  marginTop: '1.5rem',
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '0.85rem',
}

const cipherSnippetStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: '0.75rem',
  color: '#64748b',
  wordBreak: 'break-all',
}

const errorAlertStyle: React.CSSProperties = {
  backgroundColor: '#fef2f2',
  border: '1px solid #fecaca',
  color: '#b91c1c',
  padding: '0.85rem 1rem',
  borderRadius: '8px',
  marginBottom: '1rem',
  fontSize: '0.9rem',
}

const successAlertStyle: React.CSSProperties = {
  backgroundColor: '#ecfdf5',
  border: '1px solid #a7f3d0',
  color: '#065f46',
  padding: '0.85rem 1rem',
  borderRadius: '8px',
  marginBottom: '1rem',
  fontSize: '0.9rem',
}

const auditSectionCardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '16px',
  padding: '2rem',
  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
  border: '1px solid #e2e8f0',
}

const auditListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
}

const auditItemCardStyle: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '1rem',
}

const auditItemHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '0.5rem',
}

const actionBadgeStyle = (action?: string): React.CSSProperties => {
  let bg = '#3b82f6'
  if (action?.includes('CREATED') || action?.includes('UPDATED')) bg = '#10b981'
  if (action?.includes('ARCHIVED')) bg = '#f59e0b'
  if (action?.includes('BREAK_GLASS')) bg = '#ef4444'

  return {
    backgroundColor: bg,
    color: '#ffffff',
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '0.15rem 0.5rem',
    borderRadius: '4px',
  }
}

const signatureBadgeStyle = (valid: boolean): React.CSSProperties => ({
  color: valid ? '#059669' : '#dc2626',
  fontSize: '0.8rem',
  fontWeight: 600,
})

const auditItemBodyStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  color: '#334155',
  lineHeight: 1.6,
}

const hashRowStyle: React.CSSProperties = {
  marginTop: '0.35rem',
  color: '#64748b',
  wordBreak: 'break-all',
}
