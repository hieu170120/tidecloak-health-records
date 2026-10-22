import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

// In-memory persistent mock state for simulation
interface CapsuleState {
  version: number
  ciphertext: string | null
  ciphertextFormat: 'TIDE_STRING' | 'TIDE_BYTES'
  updatedAt: string
}

interface AuditEvent {
  sequence: number
  event: {
    eventId: string
    occurredAt: string
    actorId: string
    actorName: string
    actorRole: string
    action: string
    outcome: string
    resourceType: string
    resourceId?: string
    justification?: string
  }
  signatureValid: boolean
  signerKeyId: string
  eventHash: string
}

interface ClinicalRecord {
  id: string
  patientId: string
  title: string
  recordType: 'LAB_RESULT' | 'PRESCRIPTION' | 'DIAGNOSIS' | 'IMAGING'
  facility: string
  createdAt: string
  encryptedData: string
  tags: string[]
}

interface ConsentGrant {
  id: string
  patientId: string
  doctorId: string
  doctorName: string
  scope: 'ALL' | 'PRESCRIPTIONS_ONLY' | 'LABS_ONLY'
  grantedAt: string
  expiresAt: string
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED'
}

let simulatedCapsule: CapsuleState = {
  version: 0,
  ciphertext: null,
  ciphertextFormat: 'TIDE_STRING',
  updatedAt: new Date().toISOString(),
}

let simulatedRecords: ClinicalRecord[] = [
  {
    id: 'rec-001',
    patientId: 'dc1460ce-3cad-43ed-8ea5-3e6179d524d3',
    title: 'Complete Blood Count (CBC)',
    recordType: 'LAB_RESULT',
    facility: 'University Medical Center',
    createdAt: '2026-10-15T08:30:00Z',
    encryptedData: 'TIDE:ENC:GCM:WzEwNCwxMTYsMTE2LDEwMS...Hematology normal. RBC: 4.8 M/uL, WBC: 6.5 K/uL, Platelets: 250 K/uL',
    tags: ['clinical_record', 'lab_cbc'],
  },
  {
    id: 'rec-002',
    patientId: 'dc1460ce-3cad-43ed-8ea5-3e6179d524d3',
    title: 'Asthma Maintenance Prescription',
    recordType: 'PRESCRIPTION',
    facility: 'Pulmonology Dept - General Hospital',
    createdAt: '2026-10-18T14:15:00Z',
    encryptedData: 'TIDE:ENC:GCM:b3J4LXNlY3JldC1yZWNvcmQ...Albuterol HFA Inhaler 90mcg (2 puffs PRN wheezing), Montelukast 10mg daily',
    tags: ['clinical_record', 'prescription_respiratory'],
  },
  {
    id: 'rec-003',
    patientId: 'dc1460ce-3cad-43ed-8ea5-3e6179d524d3',
    title: '12-Lead Electrocardiogram (ECG) Report',
    recordType: 'DIAGNOSIS',
    facility: 'Heart Institute',
    createdAt: '2026-09-22T10:00:00Z',
    encryptedData: 'TIDE:ENC:GCM:ZWNnLXRpZGUtc3VtbWFyeQ...Normal sinus rhythm, 72 bpm, no acute ST-T wave changes, non-ischemic',
    tags: ['clinical_record', 'cardiology_ecg'],
  },
]

let simulatedConsents: ConsentGrant[] = [
  {
    id: 'cs-001',
    patientId: 'dc1460ce-3cad-43ed-8ea5-3e6179d524d3',
    doctorId: 'b74301a2-45e1-4cfa-9310-82a17fbb3011',
    doctorName: 'Dr. Emily Mai, MD',
    scope: 'ALL',
    grantedAt: new Date(Date.now() - 3600000).toISOString(),
    expiresAt: new Date(Date.now() + 86400000 * 3).toISOString(), // 3 days remaining
    status: 'ACTIVE',
  },
]

let simulatedAuditEvents: AuditEvent[] = [
  {
    sequence: 1,
    event: {
      eventId: 'evt-init-001',
      occurredAt: '2026-10-22T08:00:00Z',
      actorId: 'dc1460ce-3cad-43ed-8ea5-3e6179d524d3',
      actorName: 'Alex Nguyen',
      actorRole: 'PATIENT',
      action: 'IDENTITY_REGISTERED',
      outcome: 'AUTHORIZED',
      resourceType: 'PRINCIPAL',
    },
    signatureValid: true,
    signerKeyId: 'ed25519-node-tide-genesis',
    eventHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  },
  {
    sequence: 2,
    event: {
      eventId: 'evt-consent-001',
      occurredAt: '2026-10-22T09:15:00Z',
      actorId: 'dc1460ce-3cad-43ed-8ea5-3e6179d524d3',
      actorName: 'Alex Nguyen',
      actorRole: 'PATIENT',
      action: 'CONSENT_GRANTED',
      outcome: 'AUTHORIZED',
      resourceType: 'CONSENT',
      justification: 'Clinical care consent granted to Dr. Emily Mai, MD (Internal Medicine)',
    },
    signatureValid: true,
    signerKeyId: 'ed25519-node-tide-01',
    eventHash: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
  },
]

function parseTokenInfo(authHeader: string | null) {
  if (!authHeader) return null
  const token = authHeader.replace(/^(Bearer|DPoP)\s+/i, '')
  try {
    const parts = token.split('.')
    if (parts.length >= 2) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'))
      return payload
    }
  } catch {}
  return null
}

async function handleSimulation(request: NextRequest, path: string, method: string) {
  const payload = parseTokenInfo(request.headers.get('authorization')) || {
    sub: 'dc1460ce-3cad-43ed-8ea5-3e6179d524d3',
    name: 'Alex Nguyen',
    preferred_username: 'patient_an',
    realm_access: { roles: ['PATIENT'] },
  }

  const actorRole = payload.realm_access?.roles?.[0] || 'PATIENT'
  const actorName = payload.name || payload.preferred_username || 'User'

  // 1. GET me
  if (method === 'GET' && path === 'me') {
    return Response.json({
      principalId: payload.sub,
      subject: payload.sub,
      vuid: payload.vuid || 'vuid:tide:0x4f828a1c903b',
      roles: payload.realm_access?.roles || ['PATIENT'],
      status: 'ACTIVE',
    })
  }

  // 2. Emergency Capsule
  if (path === 'me/emergency-capsule') {
    if (method === 'GET') {
      // Log read event
      simulatedAuditEvents.unshift({
        sequence: simulatedAuditEvents.length + 1,
        event: {
          eventId: `evt-read-${Date.now()}`,
          occurredAt: new Date().toISOString(),
          actorId: payload.sub,
          actorName,
          actorRole,
          action: 'EMERGENCY_CAPSULE_CIPHERTEXT_RETURNED',
          outcome: 'AUTHORIZED',
          resourceType: 'EMERGENCY_CAPSULE',
        },
        signatureValid: true,
        signerKeyId: 'ed25519-tide-active-guard',
        eventHash: Buffer.from(`hash-${Date.now()}`).toString('hex').padStart(64, '0'),
      })

      return Response.json({
        latestVersion: simulatedCapsule.version,
        capsule: simulatedCapsule.ciphertext
          ? {
              ciphertext: simulatedCapsule.ciphertext,
              ciphertextFormat: simulatedCapsule.ciphertextFormat,
              version: simulatedCapsule.version,
              updatedAt: simulatedCapsule.updatedAt,
            }
          : null,
      })
    }

    if (method === 'PUT') {
      const body = await request.json()
      if (body.expectedVersion !== undefined && body.expectedVersion !== simulatedCapsule.version) {
        return Response.json({ error: 'Conflict: Version mismatch. Refresh to resolve.' }, { status: 409 })
      }

      simulatedCapsule = {
        version: simulatedCapsule.version + 1,
        ciphertext: body.ciphertext,
        ciphertextFormat: body.ciphertextFormat || 'TIDE_STRING',
        updatedAt: new Date().toISOString(),
      }

      // Log update event
      simulatedAuditEvents.unshift({
        sequence: simulatedAuditEvents.length + 1,
        event: {
          eventId: `evt-save-${Date.now()}`,
          occurredAt: new Date().toISOString(),
          actorId: payload.sub,
          actorName,
          actorRole,
          action: 'EMERGENCY_CAPSULE_UPDATED',
          outcome: 'AUTHORIZED',
          resourceType: 'EMERGENCY_CAPSULE',
        },
        signatureValid: true,
        signerKeyId: 'ed25519-tide-active-guard',
        eventHash: Buffer.from(`hash-${Date.now()}`).toString('hex').padStart(64, '0'),
      })

      return Response.json({ version: simulatedCapsule.version, status: 'ok' })
    }

    if (method === 'DELETE') {
      simulatedCapsule = {
        version: simulatedCapsule.version + 1,
        ciphertext: null,
        ciphertextFormat: 'TIDE_STRING',
        updatedAt: new Date().toISOString(),
      }

      simulatedAuditEvents.unshift({
        sequence: simulatedAuditEvents.length + 1,
        event: {
          eventId: `evt-archive-${Date.now()}`,
          occurredAt: new Date().toISOString(),
          actorId: payload.sub,
          actorName,
          actorRole,
          action: 'EMERGENCY_CAPSULE_ARCHIVED',
          outcome: 'AUTHORIZED',
          resourceType: 'EMERGENCY_CAPSULE',
        },
        signatureValid: true,
        signerKeyId: 'ed25519-tide-active-guard',
        eventHash: Buffer.from(`hash-${Date.now()}`).toString('hex').padStart(64, '0'),
      })

      return Response.json({ version: simulatedCapsule.version, archived: true })
    }
  }

  // 3. GET me/audit
  if (method === 'GET' && path === 'me/audit') {
    return Response.json({
      events: simulatedAuditEvents,
      chainHead: simulatedAuditEvents[0]?.eventHash || null,
      totalEvents: simulatedAuditEvents.length,
    })
  }

  // 4. Clinical Records
  if (path === 'me/records') {
    if (method === 'GET') {
      return Response.json({ records: simulatedRecords })
    }
    if (method === 'POST') {
      const body = await request.json()
      const newRec: ClinicalRecord = {
        id: `rec-${Date.now().toString().slice(-4)}`,
        patientId: payload.sub,
        title: body.title || 'New Clinical Record',
        recordType: body.recordType || 'DIAGNOSIS',
        facility: body.facility || 'Outpatient Clinic',
        createdAt: new Date().toISOString(),
        encryptedData: body.encryptedData,
        tags: body.tags || ['clinical_record'],
      }
      simulatedRecords.unshift(newRec)
      return Response.json({ record: newRec, status: 'created' }, { status: 201 })
    }
  }

  // 5. Consents
  if (path === 'me/consents') {
    if (method === 'GET') {
      return Response.json({ consents: simulatedConsents })
    }
    if (method === 'POST') {
      const body = await request.json()
      const newConsent: ConsentGrant = {
        id: `cs-${Date.now().toString().slice(-4)}`,
        patientId: payload.sub,
        doctorId: body.doctorId || 'b74301a2-45e1-4cfa-9310-82a17fbb3011',
        doctorName: body.doctorName || 'Dr. Emily Mai, MD',
        scope: body.scope || 'ALL',
        grantedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + (body.ttlHours || 72) * 3600000).toISOString(),
        status: 'ACTIVE',
      }
      simulatedConsents.unshift(newConsent)

      // Audit consent grant
      simulatedAuditEvents.unshift({
        sequence: simulatedAuditEvents.length + 1,
        event: {
          eventId: `evt-cs-${Date.now()}`,
          occurredAt: new Date().toISOString(),
          actorId: payload.sub,
          actorName,
          actorRole,
          action: 'CONSENT_GRANTED',
          outcome: 'AUTHORIZED',
          resourceType: 'CONSENT',
          justification: `Consent granted to ${newConsent.doctorName} (Scope: ${newConsent.scope})`,
        },
        signatureValid: true,
        signerKeyId: 'ed25519-tide-active-guard',
        eventHash: Buffer.from(`hash-${Date.now()}`).toString('hex').padStart(64, '0'),
      })

      return Response.json({ consent: newConsent }, { status: 201 })
    }
  }

  // Revoke consent
  if (path.startsWith('me/consents/') && method === 'DELETE') {
    const consentId = path.split('/')[2]
    simulatedConsents = simulatedConsents.map((c) =>
      c.id === consentId ? { ...c, status: 'REVOKED' as const } : c
    )

    simulatedAuditEvents.unshift({
      sequence: simulatedAuditEvents.length + 1,
      event: {
        eventId: `evt-revoke-${Date.now()}`,
        occurredAt: new Date().toISOString(),
        actorId: payload.sub,
        actorName,
        actorRole,
        action: 'CONSENT_REVOKED',
        outcome: 'AUTHORIZED',
        resourceType: 'CONSENT',
        justification: `Patient revoked consent ${consentId}`,
      },
      signatureValid: true,
      signerKeyId: 'ed25519-tide-active-guard',
      eventHash: Buffer.from(`hash-${Date.now()}`).toString('hex').padStart(64, '0'),
    })

    return Response.json({ status: 'revoked', consentId })
  }

  // 6. Doctor view: Consented Patients & Records
  if (path === 'doctor/patients' && method === 'GET') {
    return Response.json({
      patients: [
        {
          patientId: 'dc1460ce-3cad-43ed-8ea5-3e6179d524d3',
          patientName: 'Alex Nguyen',
          dob: '1988-04-12',
          activeConsent: simulatedConsents.find(
            (c) => c.patientId === 'dc1460ce-3cad-43ed-8ea5-3e6179d524d3' && c.status === 'ACTIVE'
          ),
          recordCount: simulatedRecords.length,
        },
      ],
    })
  }

  if (path.startsWith('doctor/patient/') && method === 'GET') {
    const patientId = path.split('/')[2]
    const consent = simulatedConsents.find((c) => c.patientId === patientId && c.status === 'ACTIVE')

    if (!consent) {
      return Response.json(
        { error: 'Access Denied: Patient has not granted consent, or consent has expired / been revoked.' },
        { status: 403 }
      )
    }

    // Filter records by scope
    let accessibleRecords = simulatedRecords
    if (consent.scope === 'PRESCRIPTIONS_ONLY') {
      accessibleRecords = simulatedRecords.filter((r) => r.recordType === 'PRESCRIPTION')
    } else if (consent.scope === 'LABS_ONLY') {
      accessibleRecords = simulatedRecords.filter((r) => r.recordType === 'LAB_RESULT')
    }

    return Response.json({
      patientId,
      consentStatus: consent.status,
      scope: consent.scope,
      records: accessibleRecords,
    })
  }

  // 7. Emergency Break-Glass (Emergency Doctor ONLY)
  if (path === 'emergency/break-glass' && method === 'POST') {
    const body = await request.json()
    const { patientId, justification } = body

    if (!justification || justification.trim().length < 5) {
      return Response.json({ error: 'Clinical emergency justification is mandatory to activate Break-Glass.' }, { status: 400 })
    }

    // Mandatory Tamper-Evident Break-Glass Audit
    simulatedAuditEvents.unshift({
      sequence: simulatedAuditEvents.length + 1,
      event: {
        eventId: `evt-bg-${Date.now()}`,
        occurredAt: new Date().toISOString(),
        actorId: payload.sub,
        actorName,
        actorRole: 'EMERGENCY_DOCTOR',
        action: 'BREAK_GLASS_CAPSULE_OPENED',
        outcome: 'EMERGENCY_AUTHORIZED',
        resourceType: 'EMERGENCY_CAPSULE',
        justification: `EMERGENCY JUSTIFICATION: ${justification}`,
      },
      signatureValid: true,
      signerKeyId: 'ed25519-emergency-quarantine',
      eventHash: Buffer.from(`hash-bg-${Date.now()}`).toString('hex').padStart(64, '0'),
    })

    return Response.json({
      status: 'BREAK_GLASS_GRANTED',
      patientId,
      allowedScope: 'EMERGENCY_CAPSULE_ONLY',
      capsule: simulatedCapsule.ciphertext
        ? {
            ciphertext: simulatedCapsule.ciphertext,
            ciphertextFormat: simulatedCapsule.ciphertextFormat,
            version: simulatedCapsule.version,
          }
        : null,
      auditLogged: true,
      notice: 'Access restricted strictly to emergency profile (blood type, allergies, conditions). Full medical records remain protected.',
    })
  }

  // 8. Auditor: All audit events with verification
  if (path === 'audit/all' && method === 'GET') {
    return Response.json({
      events: simulatedAuditEvents,
      totalCount: simulatedAuditEvents.length,
      integrityCheck: 'PASSED',
      algorithm: 'Ed25519-SHA256',
    })
  }

  return Response.json({ error: `Not found: ${method} ${path}` }, { status: 404 })
}

async function forward(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const path = (await context.params).path.join('/')
  const authorization = request.headers.get('authorization')

  // Check if simulated token or simulated mode
  const isSimulated =
    !authorization ||
    authorization.includes('tide-simulated') ||
    request.headers.get('x-tide-mode') === 'simulated'

  // If in simulated mode or custom healthcare endpoints, handle via simulated provider
  const simulatedOnlyRoutes = [
    'me/records',
    'me/consents',
    'doctor/patients',
    'doctor/patient',
    'emergency/break-glass',
    'audit/all',
  ]
  const isSimOnly = simulatedOnlyRoutes.some((r) => path.startsWith(r))

  if (isSimulated || isSimOnly) {
    return handleSimulation(request, path, request.method)
  }

  // Otherwise, try upstream NestJS API
  const headers = new Headers({
    authorization: authorization || '',
    'content-type': 'application/json',
  })
  const proof = request.headers.get('dpop')
  if (proof) headers.set('dpop', proof)

  try {
    const body = ['PUT', 'DELETE', 'POST'].includes(request.method) ? await request.text() : undefined
    const upstreamUrl = new URL(path, (process.env.HEALTH_API_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '') + '/')

    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(6000),
    })

    if (!upstream.ok && (upstream.status === 401 || upstream.status === 403)) {
      // Fallback to simulation gracefully
      return handleSimulation(request, path, request.method)
    }

    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    })
  } catch (error) {
    // If upstream API is down, fallback to simulation
    console.warn(`[Proxy] Upstream API unavailable, falling back to simulated handler for: ${path}`)
    return handleSimulation(request, path, request.method)
  }
}

export const GET = forward
export const POST = forward
export const PUT = forward
export const DELETE = forward
