# TideCloak Secure Health Records

## Project overview

A Zero-Trust Healthcare IAM platform that empowers patients with sovereign client-side encryption, fine-grained TTL consent management, and emergency Break-Glass access sealed by an immutable Ed25519 audit hash chain.

Built with [TideCloak](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked).

---

## 1. Vision & originality

Healthcare data is among the most sensitive and vulnerable digital assets in the world. Modern electronic health record (EHR) systems store medical histories in centralized databases—creating high-value "honeypots" vulnerable to ransomware, rogue insiders, and server breaches.

Our vision is **Patient-Sovereign Healthcare**: a decentralized identity and data architecture where patients possess absolute cryptographic ownership of their clinical records.
- **Client-Side End-to-End Encryption (E2EE)**: Sensitive health profiles and clinical notes are encrypted directly in the user's browser enclave using WebCrypto AES-GCM-256 before ever touching the network.
- **Zero-Knowledge Storage**: The application server and database administrators (DBAs) store only raw `bytea` ciphertext without possessing decryption keys.
- **Cryptographic Tag Authorization**: Access permissions are decoupled from static database rows and tied directly to decentralized TideCloak cryptographic tags (`_tide_emergency_capsule.selfencrypt`, `_tide_emergency_capsule.selfdecrypt`, etc.).
- **Dual-Action Emergency Governance**: Balances patient confidentiality with emergency medicine by enabling paramedics to unlock life-critical emergency capsules (blood type, allergies, medications) during emergencies while strictly forbidding access to full clinical histories.

---

## 2. Trust constraint insight

The central paradox in digital healthcare is the **Trust vs. Access Dilemma**:
1. **The Confidentiality Constraint**: Patients refuse to digitize sensitive health records (psychiatric evaluations, sexual health, genetic markers) if hospital IT staff, cloud providers, or database admins can view plaintext.
2. **The Emergency Availability Constraint**: In life-threatening emergencies (e.g., severe motor vehicle trauma where a patient is unconscious), physicians cannot wait for patient authentication or consent to discover fatal drug allergies and blood types.
3. **The Accountability Constraint**: In traditional systems, server administrators or compromised root accounts can retroactively alter database access logs to conceal medical malpractice or unauthorized snooping.

**Our Insight**: Trust cannot depend on administrative policy or cloud isolation alone—it must be mathematically enforced through **Sender-Constrained Tokens (RFC 9449 DPoP)**, **Cryptographic Tag Compartmentalization**, and an **Immutable Ed25519 Hash-Chained Audit Trail**.

---

## 3. Value & impact

| Stakeholder | Real-World Value & Impact |
| :--- | :--- |
| **Patients** | **Sovereignty & Privacy**: Sovereign control over personal health data. Patients can grant scoped access (`ALL`, `PRESCRIPTIONS_ONLY`, `LABS_ONLY`) with custom Time-To-Live (TTL) durations and revoke access immediately with one click. |
| **Treating Physicians** | **Liability Reduction & Targeted Care**: Doctors receive only the records necessary for their immediate clinical scope without assuming the legal liability of holding unneeded, sensitive patient history. Access automatically expires when TTL elapses. |
| **Emergency Responders (EMS / 911)** | **Life-Saving Speed**: Paramedics and trauma surgeons can unlock the life-saving **Emergency Capsule** (Blood Type, 10-digit Emergency Contact Phone, Anaphylactic Allergies, Daily Medications, Chronic Conditions) within seconds, avoiding preventable deaths from incompatible blood transfusions or penicillin anaphylaxis. |
| **Compliance & Legal Auditors** | **Non-Repudiation & Fraud Prevention**: Eliminates audit tampering. Every read, write, consent grant, and Break-Glass operation is signed with **Ed25519** and linked into an immutable hash chain, providing mathematically provable compliance with HIPAA and GDPR. |

---

## 4. Why TideCloak matters

Standard IAM solutions (standard Keycloak, Auth0, Okta, or traditional OAuth2) fail to solve the healthcare trust dilemma:
- **Bearer Tokens are Replayable**: If a standard JWT bearer token is intercepted, any attacker can impersonate a physician or patient. TideCloak enforces **DPoP (RFC 9449)**, binding access tokens to the client's private key pair so stolen tokens are completely unusable.
- **Server-Side Encryption is Not Zero-Trust**: In traditional cloud IAM, encryption keys reside in server RAM or centralized Key Management Services (KMS), leaving plaintext visible to compromised infrastructure and DBAs. TideCloak leverages **Ineffable Cryptography**, enabling client-side encryption where only actors possessing validated cryptographic role tags can decrypt ciphertext.
- **Centralized Privilege Abuse**: Database administrators can easily run `SELECT * FROM health.records;` or alter audit logs. With TideCloak's decentralized architecture, the database only holds zero-knowledge ciphertext, rendering unauthorized database-level snooping futile.

---

## 5. Prototype & storytelling

Our interactive prototype brings this architecture to life across 4 realistic healthcare personas:

```
[ Alex Nguyen (Patient) ]                 [ Dr. Emily Mai, MD (Doctor) ]
       |                                                 |
       +---> Client-side E2EE Emergency Capsule          +---> DPoP Bound Login
       +---> Grants 72h Scoped Consent ----------------->+---> Decrypts Prescriptions only
       +---> Revokes Access Immediately ---------------->+---> Instant 403 Access Denied
       |
[ Unconscious Trauma Event ]
       |
[ Dr. James Tran, MD (EMS Lead) ]         [ Marcus Vu (Security Auditor) ]
       |                                                 |
       +---> Activates Break-Glass Protocol              +---> Verifies Ed25519 Hash Chain
       +---> Mandatory Legal Justification               +---> Confirms Zero DBA Tampering
       +---> Unlocks Capsule (O+, Penicillin Shock)      +---> Validates Mathematical Continuity
       +---> Full Records Remain INACCESSIBLE            |
```

1. **Alex Nguyen (Patient)**:
   - Signs into his decentralized identity (`patient_an`) with TideCloak.
   - Encrypts his **Emergency Capsule** with blood type `O+`, emergency contact phone `0912345678`, severe `Penicillin allergy (Grade 2 anaphylaxis)`, `Insulin Glargine`, and `Asthma`.
   - Navigates to **Clinical Records & Consents** and issues a 72-hour consent grant restricted strictly to `PRESCRIPTIONS_ONLY` for **Dr. Emily Mai, MD**.
2. **Dr. Emily Mai, MD (Treating Physician)**:
   - Logs into the **Physician Clinical Portal** (`/doctor/dashboard`) with DPoP active.
   - Sees Alex Nguyen in her consented patients list. The portal retrieves and decrypts his asthma prescription, while blood panels and imaging records are strictly filtered out by policy.
   - When Alex clicks **"Revoke Access"**, Dr. Mai's dashboard immediately reflects `Access Denied by Tide Policy Engine`.
3. **Dr. James Tran, MD (Emergency 911 Lead)**:
   - Alex is brought in unconscious after a motor vehicle trauma without family or conscious consent.
   - Dr. Tran opens **Emergency Break-Glass** (`/emergency/break-glass`), enters Alex's ID, and enters a mandatory clinical justification.
   - The protocol activates: the emergency capsule unlocks in real time, revealing Alex's `O+` blood type and fatal `Penicillin allergy`, saving his life during emergency trauma surgery. Full psychiatric and diagnostic records remain securely locked.
4. **Marcus Vu (Compliance Auditor)**:
   - Navigates to the **Tamper-Evident Audit Trail** (`/audit/logs`).
   - Audits the sequential event chain: `IDENTITY_REGISTERED` $\to$ `EMERGENCY_CAPSULE_UPDATED` $\to$ `CONSENT_GRANTED` $\to$ `CONSENT_REVOKED` $\to$ `BREAK_GLASS_CAPSULE_OPENED`.
   - Verifies the **Ed25519 digital signature** and hash continuity ($H_i = \text{SHA256}(H_{i-1} \parallel \text{Event}_i)$), confirming non-repudiation and zero data tampering.

---

## Setup

Follow these steps to run the complete environment locally:

### 1. Launch TideCloak IAM Container

```bash
docker run -d -p 8080:8080 -e KC_BOOTSTRAP_ADMIN_USERNAME=admin -e KC_BOOTSTRAP_ADMIN_PASSWORD=password tideorg/tidecloak-dev:latest
```

### 2. Install Dependencies

```powershell
# Windows (PowerShell / Command Prompt)
npm.cmd install

# Linux / macOS
npm install
```

### 3. Launch the Application

```powershell
# Windows (PowerShell / Command Prompt)
npm.cmd run dev

# Linux / macOS
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 🛠️ Additional Local Services & Automated Testing

### Full Docker Compose Stack (Optional)
To run the full stack including PostgreSQL on port `5433` and the upstream NestJS API on port `3001`:

```bash
# Setup Docker environment variables
cp .env.docker.example .env.docker

# Start PostgreSQL and API services
docker compose up -d

# Run database schema migrations
npm run db:migrate
```

### Run Security & Auth Diagnostics
Verifies zero credential, token, or secret leakage:
```bash
node scripts/test-auth-logs.cjs
```
*Result: `PASS auth diagnostics: login failures and callback flags logged without sensitive values`*

### Run Database Integration & Hash Chain Test
```bash
node scripts/test-database-flow.mjs
```
*Result: `PASS global audit chain continuity and canonical hashes`*

### TypeScript Type Checking
```bash
npx tsc --noEmit
```
*Result: `0 errors`*

---

## 📄 License & References
- Built with [TideCloak](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked)
- **RFC 9449**: [OAuth 2.0 Demonstrating Proof-of-Possession (DPoP)](https://datatracker.ietf.org/doc/html/rfc9449)
- Licensed under the [MIT License](LICENSE).
