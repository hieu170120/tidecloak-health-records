CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS health;
REVOKE ALL ON SCHEMA health FROM PUBLIC;

CREATE TYPE health.principal_status AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');
CREATE TYPE health.consent_status AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'SUPERSEDED');
CREATE TYPE health.record_status AS ENUM ('ACTIVE', 'ARCHIVED', 'CRYPTO_ERASED');
CREATE TYPE health.capsule_status AS ENUM ('ACTIVE', 'SUPERSEDED', 'CRYPTO_ERASED');
CREATE TYPE health.grant_status AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');
CREATE TYPE health.break_glass_status AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'EXPIRED', 'REVOKED');
CREATE TYPE health.audit_outcome AS ENUM ('SUCCESS', 'DENIED', 'FAILED');
CREATE TYPE health.outbox_status AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE TABLE health.principals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tide_subject text NOT NULL UNIQUE,
  status health.principal_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE health.principal_roles (
  principal_id uuid NOT NULL REFERENCES health.principals(id),
  role text NOT NULL CHECK (role IN ('PATIENT', 'DOCTOR', 'EMERGENCY_DOCTOR', 'AUDITOR')),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (principal_id, role)
);

CREATE TABLE health.emergency_capsules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES health.principals(id),
  version integer NOT NULL CHECK (version > 0),
  ciphertext bytea NOT NULL,
  ciphertext_hash bytea NOT NULL CHECK (octet_length(ciphertext_hash) = 32),
  encryption_algorithm text NOT NULL,
  key_reference text NOT NULL,
  status health.capsule_status NOT NULL DEFAULT 'ACTIVE',
  created_by uuid NOT NULL REFERENCES health.principals(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  superseded_at timestamptz,
  UNIQUE (patient_id, version)
);
CREATE UNIQUE INDEX one_active_emergency_capsule_per_patient
  ON health.emergency_capsules(patient_id) WHERE status = 'ACTIVE';

CREATE TABLE health.medical_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES health.principals(id),
  record_type text NOT NULL CHECK (record_type IN ('LAB_RESULT', 'DIAGNOSIS', 'PRESCRIPTION', 'CLINICAL_NOTE', 'IMAGING', 'OTHER')),
  sensitivity_level text NOT NULL DEFAULT 'STANDARD' CHECK (sensitivity_level IN ('STANDARD', 'HIGHLY_SENSITIVE')),
  status health.record_status NOT NULL DEFAULT 'ACTIVE',
  current_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE health.medical_record_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id uuid NOT NULL REFERENCES health.medical_records(id),
  version integer NOT NULL CHECK (version > 0),
  ciphertext bytea NOT NULL,
  ciphertext_hash bytea NOT NULL CHECK (octet_length(ciphertext_hash) = 32),
  encrypted_data_key_ref text NOT NULL,
  encryption_algorithm text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  created_by uuid NOT NULL REFERENCES health.principals(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (record_id, version)
);
ALTER TABLE health.medical_records
  ADD CONSTRAINT medical_records_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES health.medical_record_versions(id);

CREATE TABLE health.consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES health.principals(id),
  doctor_id uuid NOT NULL REFERENCES health.principals(id),
  starts_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL CHECK (expires_at > starts_at),
  status health.consent_status NOT NULL DEFAULT 'ACTIVE',
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES health.principals(id),
  parent_consent_id uuid REFERENCES health.consents(id),
  policy_version text NOT NULL,
  CHECK ((status <> 'REVOKED') OR revoked_at IS NOT NULL)
);
CREATE INDEX consents_active_lookup ON health.consents(patient_id, doctor_id, starts_at, expires_at)
  WHERE status = 'ACTIVE';

CREATE TABLE health.consent_record_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_id uuid NOT NULL REFERENCES health.consents(id),
  record_id uuid REFERENCES health.medical_records(id),
  record_type text CHECK (record_type IN ('LAB_RESULT', 'DIAGNOSIS', 'PRESCRIPTION', 'CLINICAL_NOTE', 'IMAGING', 'OTHER')),
  permission text NOT NULL DEFAULT 'VIEW' CHECK (permission = 'VIEW'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((record_id IS NOT NULL) <> (record_type IS NOT NULL))
);

CREATE TABLE health.consent_key_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_id uuid NOT NULL REFERENCES health.consents(id),
  record_version_id uuid NOT NULL REFERENCES health.medical_record_versions(id),
  recipient_principal_id uuid NOT NULL REFERENCES health.principals(id),
  wrapped_data_key bytea NOT NULL,
  wrapping_algorithm text NOT NULL,
  status health.grant_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE INDEX active_consent_key_grants ON health.consent_key_grants(recipient_principal_id, status)
  WHERE status = 'ACTIVE';

CREATE TABLE health.break_glass_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES health.principals(id),
  requester_id uuid NOT NULL REFERENCES health.principals(id),
  reason_code text NOT NULL,
  reason_ciphertext bytea,
  requested_at timestamptz NOT NULL DEFAULT now(),
  status health.break_glass_status NOT NULL DEFAULT 'PENDING',
  decision_reason text,
  policy_version text NOT NULL
);
CREATE INDEX break_glass_requests_by_patient ON health.break_glass_requests(patient_id, requested_at DESC);

CREATE TABLE health.emergency_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  break_glass_request_id uuid NOT NULL UNIQUE REFERENCES health.break_glass_requests(id),
  emergency_capsule_id uuid NOT NULL REFERENCES health.emergency_capsules(id),
  recipient_principal_id uuid NOT NULL REFERENCES health.principals(id),
  wrapped_emergency_key bytea NOT NULL,
  wrapping_algorithm text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL CHECK (expires_at > issued_at),
  status health.grant_status NOT NULL DEFAULT 'ACTIVE',
  scope text NOT NULL DEFAULT 'EMERGENCY_CAPSULE' CHECK (scope = 'EMERGENCY_CAPSULE'),
  revoked_at timestamptz
);
CREATE INDEX active_emergency_grants ON health.emergency_access_grants(recipient_principal_id, expires_at)
  WHERE status = 'ACTIVE';

CREATE TABLE health.emergency_escrow_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  break_glass_request_id uuid NOT NULL REFERENCES health.break_glass_requests(id),
  attestation_type text NOT NULL,
  attester_reference text NOT NULL,
  attestation_hash bytea NOT NULL CHECK (octet_length(attestation_hash) = 32),
  verified_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('VALID', 'INVALID', 'EXPIRED'))
);

CREATE TABLE health.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid REFERENCES health.principals(id),
  action text NOT NULL,
  outcome health.audit_outcome NOT NULL,
  patient_id uuid REFERENCES health.principals(id),
  resource_type text NOT NULL,
  resource_id uuid,
  scope text,
  reason_hash bytea CHECK (reason_hash IS NULL OR octet_length(reason_hash) = 32),
  request_id uuid,
  previous_hash bytea CHECK (previous_hash IS NULL OR octet_length(previous_hash) = 32),
  event_hash bytea NOT NULL CHECK (octet_length(event_hash) = 32),
  signature bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_by_patient ON health.audit_events(patient_id, occurred_at DESC);
CREATE INDEX audit_events_by_actor ON health.audit_events(actor_id, occurred_at DESC);

CREATE TABLE health.audit_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  last_event_id uuid NOT NULL REFERENCES health.audit_events(id),
  last_event_hash bytea NOT NULL CHECK (octet_length(last_event_hash) = 32),
  event_count bigint NOT NULL CHECK (event_count > 0),
  anchored_at timestamptz NOT NULL DEFAULT now(),
  external_reference text NOT NULL UNIQUE,
  signature bytea NOT NULL,
  verification_status text NOT NULL DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING', 'VERIFIED', 'FAILED'))
);

CREATE TABLE health.notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  recipient_reference text NOT NULL,
  payload_ciphertext bytea NOT NULL,
  status health.outbox_status NOT NULL DEFAULT 'PENDING',
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE OR REPLACE FUNCTION health.reject_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'health.audit_events is append-only';
END;
$$;

CREATE TRIGGER audit_events_immutable
BEFORE UPDATE OR DELETE ON health.audit_events
FOR EACH ROW EXECUTE FUNCTION health.reject_audit_mutation();
