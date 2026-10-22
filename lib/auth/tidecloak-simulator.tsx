'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'

export interface TidePersona {
  id: string
  name: string
  role: 'PATIENT' | 'DOCTOR' | 'EMERGENCY_DOCTOR' | 'AUDITOR'
  realmRoles: string[]
  sub: string
  vuid: string
  email: string
  title: string
  department: string
  avatarColor: string
}

export const TIDE_PERSONAS: Record<string, TidePersona> = {
  patient_an: {
    id: 'patient_an',
    name: 'Alex Nguyen',
    role: 'PATIENT',
    realmRoles: [
      'PATIENT',
      '_tide_emergency_capsule.selfencrypt',
      '_tide_emergency_capsule.selfdecrypt',
      '_tide_record.selfencrypt',
      '_tide_record.selfdecrypt',
      'default-roles-myrealm',
    ],
    sub: 'dc1460ce-3cad-43ed-8ea5-3e6179d524d3',
    vuid: 'vuid:tide:0x4f828a1c903b',
    email: 'alex.nguyen@patient.org',
    title: 'Individual Patient',
    department: 'Health Record & Emergency Capsule Owner',
    avatarColor: '#10b981',
  },
  doctor_mai: {
    id: 'doctor_mai',
    name: 'Dr. Emily Mai, MD',
    role: 'DOCTOR',
    realmRoles: ['DOCTOR', 'default-roles-myrealm'],
    sub: 'b74301a2-45e1-4cfa-9310-82a17fbb3011',
    vuid: 'vuid:tide:0x9812cc491f0a',
    email: 'emily.mai@hospital.org',
    title: 'Internal Medicine Specialist',
    department: 'General Internal Medicine - City Central Hospital',
    avatarColor: '#0ea5e9',
  },
  er_hung: {
    id: 'er_hung',
    name: 'Dr. James Tran, MD',
    role: 'EMERGENCY_DOCTOR',
    realmRoles: ['EMERGENCY_DOCTOR', '_tide_emergency_capsule.breakglass', 'default-roles-myrealm'],
    sub: 'c9918234-7712-42bb-a309-123456789abc',
    vuid: 'vuid:tide:0x3344a1b029ff',
    email: 'james.tran@emergency911.org',
    title: 'Emergency Response Lead',
    department: 'Emergency & Trauma Services (EMS / 911)',
    avatarColor: '#f43f5e',
  },
  auditor_minh: {
    id: 'auditor_minh',
    name: 'Marcus Vu',
    role: 'AUDITOR',
    realmRoles: ['AUDITOR', '_tide_audit.verify', 'default-roles-myrealm'],
    sub: 'e5522331-1122-4a00-9988-aabbccddeeff',
    vuid: 'vuid:tide:0x7721eedd33aa',
    email: 'marcus.vu@audit.gov',
    title: 'Digital Health Security Auditor',
    department: 'Health Data Integrity & Compliance Commission',
    avatarColor: '#8b5cf6',
  },
}

export interface TideCloakAuthContextType {
  authenticated: boolean
  isInitializing: boolean
  initError: Error | null
  persona: TidePersona
  allPersonas: TidePersona[]
  token: string
  switchPersona: (personaId: string) => void
  hasRealmRole: (role: string) => boolean
  hasClientRole: (role: string) => boolean
  getValueFromToken: (claim: string) => any
  getValueFromIdToken: (claim: string) => any
  getToken: () => Promise<string>
  doEncrypt: (items: { data: string | Uint8Array; tags: string[] }[], policy?: any) => Promise<string[]>
  doDecrypt: (items: { encrypted: string | Uint8Array; tags: string[] }[], policy?: any) => Promise<(string | Uint8Array)[]>
  secureFetch: (input: string | URL | RequestInfo, init?: RequestInit) => Promise<Response>
  login: (options?: any) => Promise<void>
  logout: (options?: any) => Promise<void>
  dpopActive: boolean
  isSimulated: boolean
  setSimulated: (sim: boolean) => void
}

const TideCloakAuthContext = createContext<TideCloakAuthContextType | null>(null)

// Client-side Web Cryptography key derivation from tag & identity
async function getTagCryptoKey(tag: string, identity: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(`tide-tag-secret:${tag}:${identity}:salt2026`),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(`tide-salt:${tag}`),
      iterations: 10000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

function safeBase64UrlEncode(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  }
  const utf8Bytes = new TextEncoder().encode(str)
  let binary = ''
  for (let i = 0; i < utf8Bytes.length; i++) {
    binary += String.fromCharCode(utf8Bytes[i])
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function TideCloakSimulatorProvider({ children }: { children: React.ReactNode }) {
  const [activePersonaId, setActivePersonaId] = useState<string>('patient_an')
  const [authenticated, setAuthenticated] = useState<boolean>(true)
  const [isInitializing, setIsInitializing] = useState<boolean>(false)
  const [initError, setInitError] = useState<Error | null>(null)
  const [isSimulated, setIsSimulated] = useState<boolean>(true)

  // Load saved persona from localStorage if available
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tide_active_persona')
      if (saved && TIDE_PERSONAS[saved]) {
        setActivePersonaId(saved)
      }
      const savedSim = localStorage.getItem('tide_use_simulated')
      if (savedSim !== null) {
        setIsSimulated(savedSim === 'true')
      }
    }
  }, [])

  const persona = useMemo(() => TIDE_PERSONAS[activePersonaId] || TIDE_PERSONAS.patient_an, [activePersonaId])

  const switchPersona = useCallback((personaId: string) => {
    if (TIDE_PERSONAS[personaId]) {
      setActivePersonaId(personaId)
      if (typeof window !== 'undefined') {
        localStorage.setItem('tide_active_persona', personaId)
      }
      console.log(`[TideCloak-Simulator] Switched persona to: ${TIDE_PERSONAS[personaId].name} (${TIDE_PERSONAS[personaId].role})`)
    }
  }, [])

  const token = useMemo(() => {
    // Generate simulated JWT structure with valid claims and header
    const header = safeBase64UrlEncode(JSON.stringify({ alg: 'EdDSA', typ: 'JWT', kid: 'tide-key-dev' }))
    const now = Math.floor(Date.now() / 1000)
    const payload = safeBase64UrlEncode(
      JSON.stringify({
        sub: persona.sub,
        vuid: persona.vuid,
        preferred_username: persona.id,
        email: persona.email,
        name: persona.name,
        realm_access: { roles: persona.realmRoles },
        resource_access: {
          'hackathon-rmit': { roles: persona.realmRoles },
        },
        iss: 'http://localhost:8080/realms/myrealm',
        aud: ['hackathon-rmit', 'account'],
        iat: now,
        exp: now + 3600,
        sid: `session-${persona.id}-${now}`,
      })
    )
    const signature = safeBase64UrlEncode('tide-simulated-signature-proof-eddsa-dpop')
    return `${header}.${payload}.${signature}`
  }, [persona])

  const hasRealmRole = useCallback(
    (role: string) => {
      return persona.realmRoles.includes(role)
    },
    [persona]
  )

  const hasClientRole = useCallback(
    (role: string) => {
      return persona.realmRoles.includes(role)
    },
    [persona]
  )

  const getValueFromToken = useCallback(
    (claim: string) => {
      if (claim === 'sub') return persona.sub
      if (claim === 'vuid') return persona.vuid
      if (claim === 'preferred_username') return persona.id
      if (claim === 'email') return persona.email
      if (claim === 'name') return persona.name
      if (claim === 'realm_access') return { roles: persona.realmRoles }
      return null
    },
    [persona]
  )

  const getValueFromIdToken = getValueFromToken

  const getToken = useCallback(async () => {
    return token
  }, [token])

  // Simulated Tide Tag-Based Encryption
  const doEncrypt = useCallback(
    async (items: { data: string | Uint8Array; tags: string[] }[]) => {
      const results: string[] = []
      for (const item of items) {
        const tag = item.tags[0] || 'default'
        const requiredRole = `_tide_${tag}.selfencrypt`
        const hasPerm = persona.realmRoles.includes(requiredRole) || persona.role === 'PATIENT'
        if (!hasPerm) {
          throw new Error(`[Tide Fabric] Denied by tag capability policy: missing role ${requiredRole}`)
        }

        const dataBytes =
          typeof item.data === 'string' ? new TextEncoder().encode(item.data) : item.data

        const cryptoKey = await getTagCryptoKey(tag, persona.sub)
        const iv = window.crypto.getRandomValues(new Uint8Array(12))
        const cipherBuffer = await window.crypto.subtle.encrypt(
          { name: 'AES-GCM', iv },
          cryptoKey,
          dataBytes
        )

        const combined = new Uint8Array(iv.length + cipherBuffer.byteLength)
        combined.set(iv, 0)
        combined.set(new Uint8Array(cipherBuffer), iv.length)

        results.push(bytesToBase64(combined))
      }
      return results
    },
    [persona]
  )

  // Simulated Tide Tag-Based Decryption
  const doDecrypt = useCallback(
    async (items: { encrypted: string | Uint8Array; tags: string[] }[]) => {
      const results: (string | Uint8Array)[] = []
      for (const item of items) {
        const tag = item.tags[0] || 'default'
        const canDecrypt =
          persona.realmRoles.includes(`_tide_${tag}.selfdecrypt`) ||
          persona.realmRoles.includes(`_tide_${tag}.decrypt`) ||
          persona.realmRoles.includes(`_tide_${tag}.breakglass`) ||
          persona.role === 'PATIENT' ||
          persona.role === 'EMERGENCY_DOCTOR'

        if (!canDecrypt) {
          throw new Error(`[Tide Fabric] Access Denied: Persona ${persona.name} lacks decryption role for tag '${tag}'`)
        }

        const rawBytes =
          typeof item.encrypted === 'string' ? base64ToBytes(item.encrypted) : item.encrypted

        if (rawBytes.length < 13) {
          throw new Error('Invalid ciphertext length')
        }

        const iv = rawBytes.slice(0, 12)
        const cipherData = rawBytes.slice(12)

        const ownerSub = TIDE_PERSONAS.patient_an.sub
        const cryptoKey = await getTagCryptoKey(tag, ownerSub)

        try {
          const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            cryptoKey,
            cipherData
          )
          results.push(new TextDecoder().decode(decryptedBuffer))
        } catch {
          const fallbackKey = await getTagCryptoKey(tag, persona.sub)
          const fallbackBuffer = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            fallbackKey,
            cipherData
          )
          results.push(new TextDecoder().decode(fallbackBuffer))
        }
      }
      return results
    },
    [persona]
  )

  const secureFetch = useCallback(
    async (input: string | URL | RequestInfo, init: RequestInit = {}): Promise<Response> => {
      let resolvedUrl: string
      if (typeof input === 'string') {
        if (input.startsWith('http://') || input.startsWith('https://')) {
          resolvedUrl = input
        } else if (typeof window !== 'undefined') {
          resolvedUrl = new URL(input, window.location.origin).toString()
        } else {
          resolvedUrl = input
        }
      } else if (input instanceof URL) {
        resolvedUrl = input.toString()
      } else {
        resolvedUrl = (input as Request).url
      }

      const headers = new Headers(init.headers || {})
      headers.set('Authorization', `Bearer ${token}`)
      headers.set('DPoP', `simulated-dpop-proof-${Date.now()}`)
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json')
      }

      console.log(`[TideCloak-Simulator] secureFetch -> ${resolvedUrl} (Role: ${persona.role})`)
      return fetch(resolvedUrl, { ...init, headers })
    },
    [token, persona]
  )

  const login = useCallback(async () => {
    setAuthenticated(true)
  }, [])

  const logout = useCallback(async () => {
    setAuthenticated(false)
  }, [])

  const value: TideCloakAuthContextType = {
    authenticated,
    isInitializing,
    initError,
    persona,
    allPersonas: Object.values(TIDE_PERSONAS),
    token,
    switchPersona,
    hasRealmRole,
    hasClientRole,
    getValueFromToken,
    getValueFromIdToken,
    getToken,
    doEncrypt,
    doDecrypt,
    secureFetch,
    login,
    logout,
    dpopActive: true,
    isSimulated,
    setSimulated: (sim: boolean) => {
      setIsSimulated(sim)
      if (typeof window !== 'undefined') {
        localStorage.setItem('tide_use_simulated', String(sim))
      }
    },
  }

  return <TideCloakAuthContext.Provider value={value}>{children}</TideCloakAuthContext.Provider>
}

export function useHealthcareAuth() {
  const context = useContext(TideCloakAuthContext)
  if (!context) {
    throw new Error('useHealthcareAuth must be used within a TideCloakSimulatorProvider')
  }
  return context
}
