REVOKE ALL ON ALL TABLES IN SCHEMA health FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA health FROM PUBLIC;

GRANT USAGE ON SCHEMA health TO app_runtime, audit_writer, audit_verifier;

GRANT SELECT, INSERT, UPDATE ON health.principals, health.principal_roles,
  health.emergency_capsules, health.medical_records, health.medical_record_versions,
  health.consents, health.consent_record_scopes, health.consent_key_grants,
  health.break_glass_requests, health.emergency_access_grants,
  health.emergency_escrow_receipts, health.notification_outbox TO app_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA health TO app_runtime;

GRANT INSERT ON health.audit_events TO audit_writer;
GRANT USAGE, SELECT ON SEQUENCE health.audit_events_chain_sequence_seq TO audit_writer;
GRANT SELECT ON health.audit_events, health.audit_checkpoints TO audit_verifier;

-- audit checkpoints are written by the future audit worker using a dedicated role.
-- Until that worker exists, only the schema owner can insert checkpoints.
