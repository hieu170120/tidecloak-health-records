'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useHealthcareAuth } from '../lib/auth/tidecloak-simulator'

export default function LoginPage() {
  const { allPersonas, persona, switchPersona, login, authenticated, isInitializing, initError } = useHealthcareAuth()
  const router = useRouter()
  const [selectedPersonaId, setSelectedPersonaId] = useState(persona.id)

  useEffect(() => {
    console.log('[auth-debug] login:state', { authenticated, isInitializing, hasInitError: !!initError })
  }, [authenticated, isInitializing, initError])

  const handleSelectAndEnter = useCallback((personaId: string) => {
    console.log('[auth-debug] login:click', { isInitializing, hasInitError: !!initError })
    switchPersona(personaId)
    void login()
      .then(() => {
        router.push('/home')
      })
      .catch(() => console.error('[auth-debug] login:failed'))
  }, [initError, isInitializing, login, router, switchPersona])

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🛡️</div>
        <h1 style={{ margin: 0, fontSize: '1.6rem', color: '#0f172a' }}>
          TideCloak Healthcare Security
        </h1>
        <p style={{ margin: '0.5rem 0 1.5rem', color: '#64748b', fontSize: '0.9rem', lineHeight: 1.5 }}>
          Sign in via TideCloak decentralized zero-trust architecture. Select a simulated persona to begin:
        </p>

        {/* Persona Select Grid */}
        <div style={personaListStyle}>
          {allPersonas.map((p) => (
            <div
              key={p.id}
              onClick={() => handleSelectAndEnter(p.id)}
              style={personaItemStyle(p.avatarColor)}
            >
              <div style={{ ...avatarIconStyle, backgroundColor: p.avatarColor }}>
                {p.name.charAt(0)}
              </div>
              <div style={{ textAlign: 'left', flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>{p.name}</div>
                <div style={{ fontSize: '0.75rem', color: '#475569' }}>{p.title}</div>
              </div>
              <span style={roleBadgeStyle(p.role)}>{p.role}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '1.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
          <button onClick={() => handleSelectAndEnter(selectedPersonaId)} style={primaryBtnStyle}>
            🚀 Enter Workspace ({persona.name})
          </button>
        </div>
      </div>
    </div>
  )
}

const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#0f172a',
  backgroundImage: 'radial-gradient(at 0% 0%, rgba(2, 132, 199, 0.25) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(16, 185, 129, 0.2) 0px, transparent 50%)',
  padding: '1.5rem',
}

const cardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '24px',
  padding: '2.5rem',
  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
  maxWidth: 480,
  width: '100%',
  textAlign: 'center',
}

const personaListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
}

const personaItemStyle = (color: string): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.75rem 1rem',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  backgroundColor: '#f8fafc',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
})

const avatarIconStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: '50%',
  color: '#ffffff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 700,
  fontSize: '1rem',
}

const roleBadgeStyle = (role: string): React.CSSProperties => {
  let bg = '#10b981'
  if (role === 'DOCTOR') bg = '#0284c7'
  if (role === 'EMERGENCY_DOCTOR') bg = '#dc2626'
  if (role === 'AUDITOR') bg = '#7c3aed'
  return {
    backgroundColor: bg,
    color: '#fff',
    fontSize: '0.68rem',
    fontWeight: 700,
    padding: '0.15rem 0.45rem',
    borderRadius: '4px',
  }
}

const primaryBtnStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#0284c7',
  color: '#ffffff',
  border: 'none',
  padding: '0.85rem',
  borderRadius: '10px',
  fontSize: '1rem',
  fontWeight: 700,
  cursor: 'pointer',
}
