# TideCloak Secure Health Records (Healthcare IAM)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16.x-black.svg)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.x-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![TideCloak](https://img.shields.io/badge/TideCloak-Decentralized_IAM-10b981.svg)](https://docs.tide.org/)
[![DPoP RFC 9449](https://img.shields.io/badge/DPoP-RFC_9449_Bound-purple.svg)](https://datatracker.ietf.org/doc/html/rfc9449)
[![Audit](https://img.shields.io/badge/Audit-Ed25519_Hash_Chain-orange.svg)]()

A high-security, Zero-Trust Healthcare Identity and Access Management (IAM) application protected by **TideCloak**. Clinical records and emergency medical profiles are end-to-end encrypted at the client (**Client-side E2EE**), restricted through **Cryptographic Tag Authorization**, managed via **Time-To-Live (TTL) Patient Consents**, safeguarded by **Emergency Break-Glass (EMS / 911)** protocols, and provably preserved in an **immutable Ed25519 tamper-evident audit hash chain**.

---

## 🌟 Key Features & Zero-Trust Capabilities

1. **Client-Side End-to-End Encryption (E2EE)**:
   - Medical notes, allergies, medications, and conditions are encrypted directly inside the browser using **WebCrypto AES-GCM-256**.
   - Raw bytes are stored on the server as zero-knowledge PostgreSQL `bytea`. The server and database administrators (DBAs) **cannot** read medical plaintext.

2. **DPoP Token Binding (RFC 9449)**:
   - Access tokens are cryptographically sender-constrained using Demonstrating Proof-of-Possession (DPoP), preventing token theft, replay, and man-in-the-middle attacks.

3. **Patient-Governed Consent Engine**:
   - Patients retain sovereign control over their clinical records.
   - Grants can be scoped precisely (`ALL`, `PRESCRIPTIONS_ONLY`, `LABS_ONLY`) with custom Time-To-Live durations (e.g., 72 hours).
   - Immediate one-click revocation instantly denies physician decryption even if the TTL duration has not yet elapsed.

4. **Emergency Break-Glass Protocol (EMS / 911)**:
   - When an unaccompanied patient arrives unconscious at emergency services, authorized ER personnel (`EMERGENCY_DOCTOR`) can bypass consent to unlock **only** the life-critical **Emergency Capsule** (blood type, 10-digit emergency contact, critical allergies, daily medications, and key chronic conditions).
   - Full medical history remains strictly **inaccessible**.
   - A mandatory legal justification is required, permanently committed to the audit trail with an **Ed25519** digital signature.

5. **Tamper-Evident Ed25519 Audit Hash Chain**:
   - Every read, write, consent grant, consent revocation, and Break-Glass access is hashed sequentially:
     $$H_i = \text{SHA256}(H_{i-1} \parallel \text{Timestamp} \parallel \text{ActorID} \parallel \text{Action} \parallel \text{Resource} \parallel \text{Justification})$$
   - Each event block is digitally signed with an **Ed25519** key pair, guaranteeing non-repudiation and immediate detection of any database tampering.

6. **Interactive Multi-Persona Simulation & Token Inspector**:
   - Seamlessly switch between realistic healthcare roles directly in the top navigation bar.
   - Built-in **Token Inspector** allows inspecting active DPoP proof, Subject IDs (`sub`), Tide VUIDs, cryptographic tags, and sender-constrained JWT tokens.

---

## 👥 System Actors & Cryptographic Permissions

| Persona / Actor | Name & Title | Realm Roles & Cryptographic Tags | Permitted Workflows |
| :--- | :--- | :--- | :--- |
| **Individual Patient** | **Alex Nguyen** (`patient_an`) | • `PATIENT`<br>• `_tide_emergency_capsule.selfencrypt`<br>• `_tide_emergency_capsule.selfdecrypt`<br>• `_tide_message.selfencrypt` | Manages Emergency Capsule; creates encrypted clinical records; grants/revokes physician consent with TTL. |
| **Treating Physician** | **Dr. Emily Mai, MD** (`doctor_mai`)<br>*Internal Medicine Specialist* | • `DOCTOR`<br>• Dynamic tag grants: `clinical_record`, `type_prescription`, `type_lab_result` | Accesses consented patient directory; decrypts patient clinical notes within granted scope during active TTL. |
| **Emergency ER Doctor** | **Dr. James Tran, MD** (`er_hung`)<br>*Emergency Response Lead (EMS / 911)* | • `EMERGENCY_DOCTOR`<br>• `_tide_emergency_capsule.breakglass` | Triggers Break-Glass with required legal justification; unlocks emergency capsule only; blocked from full records. |
| **Security Auditor** | **Marcus Vu** (`auditor_minh`)<br>*Digital Health Compliance Auditor* | • `AUDITOR`<br>• `_tide_audit.verify` | Verifies Ed25519 signatures; confirms mathematical continuity of the cryptographic audit hash chain. |

---

## 🏗️ System Architecture & Ports

```
+-----------------------------------------------------------------------------------+
|                                Client Browser                                     |
|  - Next.js 16 App Router UI (Client-Side AES-GCM-256 + DPoP Enclave)              |
|  - Persona Switcher, Token Inspector, Emergency Capsule, Consents & Audit Trail  |
+------------------------------------------+----------------------------------------+
                                           | HTTP / REST (Bearer + DPoP Proof)
                                           v
+-----------------------------------------------------------------------------------+
|                    Next.js App Server & Health Proxy (:3000)                      |
|  - Route Handlers: /api/health/[...path]                                          |
|  - Dual Mode: Active TideCloak Enclave + Seamless Offline Simulation Fallback     |
+------------------------------------------+----------------------------------------+
                                           | Internal Network
                     +---------------------+---------------------+
                     v                                           v
+-----------------------------------------+ +---------------------------------------+
|        Upstream NestJS API (:3001)      | |         TideCloak IAM (:8080)         |
|  - Restricted app_runtime DB role       | |  - Realm: myrealm                     |
|  - Scoped policy evaluation             | |  - DPoP RFC 9449 Bound Tokens         |
+--------------------+--------------------+ |  - Ineffable Cryptographic Key Store  |
                     |                      +---------------------------------------+
                     v
+-----------------------------------------------------------------------------------+
|                            PostgreSQL Database (:5433)                            |
|  - Schema: health (isolated from public schema)                                   |
|  - Tables: principals, emergency_capsules (bytea), audit_events, consent_grants   |
|  - Roles: app_runtime, audit_writer, audit_verifier                               |
+-----------------------------------------------------------------------------------+
```

---

## 📂 Project Structure

```
my-app/
├── app/                               # Next.js 16 App Router Pages
│   ├── layout.tsx                     # Global layout, fonts & Persona Provider
│   ├── page.tsx                       # Landing Page & Persona Selector
│   ├── home/page.tsx                  # Security Status & 5 Healthcare Portals
│   ├── patient/
│   │   ├── emergency-capsule/page.tsx # E2EE Emergency Capsule Form & Audit
│   │   └── records/page.tsx           # Clinical Records & Consent Management
│   ├── doctor/
│   │   └── dashboard/page.tsx         # Physician Clinical Portal & Scoped Records
│   ├── emergency/
│   │   └── break-glass/page.tsx       # EMS Break-Glass Protocol & Audit
│   ├── audit/
│   │   └── logs/page.tsx              # Tamper-Evident Audit Trail & Filter
│   ├── auth/redirect/page.tsx         # OAuth2/OIDC Auth Callback Handler
│   └── api/health/[...path]/route.ts  # Health Proxy & Dynamic Simulation Handler
├── components/
│   └── PersonaBar.tsx                 # Header navigation & Token Inspector modal
├── lib/
│   └── auth/
│       └── tidecloak-simulator.tsx    # Auth Context, DPoP, Personas & WebCrypto E2EE
├── database/
│   ├── init/                          # Initial DB scripts (10-schema.sql, 20-permissions.sql)
│   └── migrations/                    # Database versioning migrations
├── api/                               # Upstream NestJS backend service
├── scripts/
│   ├── test-auth-logs.cjs             # Security diagnostics test (zero credential leakage)
│   ├── test-database-flow.mjs         # Migration & hash chain verification test
│   ├── migrate.mjs                    # PostgreSQL schema migration runner
│   └── configure-local-api.mjs        # Local environment configurator
├── docs/                              # Architecture and database documentation
├── docker-compose.yml                 # PostgreSQL, NestJS API & TideCloak containers
├── package.json                       # Dependencies & Webpack dev script
└── README.md                          # Comprehensive documentation
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v20+ or v22+
- **Docker & Docker Compose**: v2.20+
- **Operating System**: Windows (PowerShell), macOS, or Linux

### 1. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/hieu170120/tidecloak-health-records.git
cd my-app
npm install
```

### 2. Configure Environment Files

```bash
# Setup Docker environment
cp .env.docker.example .env.docker

# Setup local TideCloak adapter configuration
cp tidecloak.example.json tidecloak.json
```

### 3. Launch Local Data & IAM Services (Docker)

Start PostgreSQL, the upstream NestJS API, and TideCloak:

```bash
docker compose up -d
docker compose ps
```

Verify service status:
- **TideCloak Console**: `http://localhost:8080/realms/myrealm/tide-console/`
- **NestJS Health Check**: `http://localhost:3001/health` (Returns `{"status":"ok","database":"ok"}`)
- **PostgreSQL**: Bound to `127.0.0.1:5433` (health schema with role-based access control).

### 4. Run Database Migrations

```bash
npm run db:migrate
```

### 5. Start Next.js Development Server

> [!NOTE]
> The project runs Next.js in webpack mode (`next dev --webpack`) to guarantee stable SSR error serialization.

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 🧪 Interactive Walkthrough & Demo Guide

### Scenario 1: Emergency Capsule (Patient: Alex Nguyen)
1. Sign in as **Alex Nguyen (PATIENT)** from the home screen.
2. Navigate to **💊 Emergency Capsule** (`/patient/emergency-capsule`).
3. Enter medical data:
   - **Blood Type**: `O+`
   - **Emergency Contact**: `0912345678` (strictly accepts 10 numeric digits).
   - **Allergies**: `Penicillin allergy (Grade 2 anaphylaxis), Aspirin, Shellfish`
   - **Medications**: `Insulin Glargine 10 IU/day, Albuterol HFA Inhaler 90mcg`
   - **Conditions**: `Mild Chronic Asthma, Type 2 Diabetes, Hypertension`
4. Click **"🔒 Encrypt with Tide & Save"**. The data is encrypted using WebCrypto AES-GCM under tag `emergency_capsule` and persisted as raw `bytea`. An Ed25519-signed event is added to the audit chain.

### Scenario 2: Grant Doctor Consent & Scope Filtering
1. Navigate to **📋 Records & Consents** (`/patient/records`).
2. Click **"🤝 Grant Doctor Consent"**.
3. Select **Dr. Emily Mai, MD**, choose a scope (`PRESCRIPTIONS_ONLY`), set TTL to `72` hours, and submit.
4. Switch persona in the top navigation bar to **Dr. Emily Mai, MD (DOCTOR)**.
5. Navigate to **🩺 Doctor Portal** (`/doctor/dashboard`). Notice that under **Authorized Clinical Records**, only prescriptions are visible; lab reports and general diagnoses are filtered out by policy.
6. Switch back to **Alex Nguyen**, click **"🚫 Revoke Access"**, and return to the Doctor Portal. Access is immediately denied with an alert from the Tide Policy Engine.

### Scenario 3: Emergency Break-Glass (EMS / 911)
1. Switch persona to **Dr. James Tran, MD (EMERGENCY_DOCTOR)**.
2. Navigate to **🚨 Emergency (911)** (`/emergency/break-glass`).
3. Enter patient ID `dc1460ce-3cad-43ed-8ea5-3e6179d524d3` and provide acute justification:
   *"Patient unconscious following motor vehicle trauma, unaccompanied. Immediate access to blood type and drug allergies required for emergency surgery."*
4. Click **"🚨 ACTIVATE BREAK-GLASS"**.
5. The emergency capsule is unlocked and decrypted, highlighting **Blood Type: O+** and **Penicillin Anaphylaxis**. Full medical history remains securely protected.

### Scenario 4: Tamper-Evident Audit Verification
1. Switch persona to **Marcus Vu (AUDITOR)**.
2. Navigate to **📜 Audit Trail** (`/audit/logs`).
3. View the live hash chain status: `✓ Hash Chain Status: CONTINUOUS & VALID (Ed25519 Verified)`.
4. Filter by action: `BREAK_GLASS_CAPSULE_OPENED`, `CONSENT_GRANTED`, `CONSENT_REVOKED`, or `EMERGENCY_CAPSULE_UPDATED`.
5. Verify that each event displays its SHA-256 `Event Hash`, `Signer Key ID`, actor identity, and mandatory legal justification.

---

## 🔒 Security & Verification Commands

### Run Security & Auth Diagnostics
Verifies that no secrets, OAuth authorization codes, or user credentials leak into application logs:

```bash
node scripts/test-auth-logs.cjs
```
*Expected output: `PASS auth diagnostics: login failures and callback flags logged without sensitive values`*

### Run Database Integration & Hash Chain Tests
Executes migrations against an isolated database and validates hash chain mathematical continuity:

```bash
node scripts/test-database-flow.mjs
```
*Expected output: `PASS migrations apply once and rerun safely. PASS global audit chain continuity and canonical hashes`*

### TypeScript Type Checking
```bash
npx tsc --noEmit
```
*Expected output: 0 errors.*

---

## 📜 Standards & Compliance References

- **RFC 9449**: [OAuth 2.0 Demonstrating Proof-of-Possession (DPoP)](https://datatracker.ietf.org/doc/html/rfc9449)
- **NIST SP 800-63C**: [Digital Identity Guidelines - Federation and Assertions](https://pages.nist.gov/800-63-3/sp800-63c.html)
- **Tide Protocol**: [TideCloak Decentralized IAM Architecture](https://docs.tide.org/)
- **HIPAA / GDPR**: Principles of Least Privilege, Sovereign Data Ownership, and Cryptographic Tamper-Evidence.
