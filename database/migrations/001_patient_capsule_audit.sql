-- Extend the existing bootstrap schema. Never rewrite old ciphertext or audit rows.
ALTER TABLE health.emergency_capsules ADD COLUMN ciphertext_format text NOT NULL DEFAULT 'TIDE_STRING'
  CHECK (ciphertext_format IN ('TIDE_STRING', 'TIDE_BYTES'));
ALTER TABLE health.audit_events ADD COLUMN canonical_event text;
ALTER TABLE health.audit_events ADD COLUMN signer_key_id text;
ALTER TABLE health.audit_events ADD COLUMN signature_algorithm text;

CREATE TABLE health.dpop_replays (
  key_thumbprint text NOT NULL,
  proof_id_hash text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (key_thumbprint, proof_id_hash)
);
REVOKE ALL ON health.dpop_replays FROM PUBLIC;
GRANT INSERT ON health.dpop_replays TO app_runtime;

-- Serialize all chain writers; the app may read only the head, not everybody's audit.
CREATE FUNCTION health.audit_head()
RETURNS TABLE(event_hash bytea, canonical_event text, signature bytea, signer_key_id text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, health AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(724031001);
  RETURN QUERY SELECT a.event_hash, a.canonical_event, a.signature, a.signer_key_id
    FROM health.audit_events a ORDER BY a.chain_sequence DESC LIMIT 1;
END;
$$;
REVOKE ALL ON FUNCTION health.audit_head() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION health.audit_head() TO app_runtime;

CREATE FUNCTION health.append_audit_event(p_canonical text, p_hash bytea, p_signature bytea, p_signer text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, health AS $$
DECLARE e jsonb; previous bytea; event_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(724031001);
  e := p_canonical::jsonb;
  SELECT a.event_hash INTO previous FROM health.audit_events a ORDER BY chain_sequence DESC LIMIT 1;
  IF e->>'previousHash' IS DISTINCT FROM encode(previous, 'hex') THEN
    RAISE EXCEPTION 'Audit head changed';
  END IF;
  IF p_hash <> public.digest(convert_to(p_canonical, 'UTF8'), 'sha256')
     OR octet_length(p_signature) <> 64 OR p_signer !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid audit envelope';
  END IF;
  IF e->>'action' NOT IN ('IDENTITY_REGISTERED', 'EMERGENCY_CAPSULE_CREATED',
      'EMERGENCY_CAPSULE_UPDATED', 'EMERGENCY_CAPSULE_ARCHIVED',
      'EMERGENCY_CAPSULE_CIPHERTEXT_RETURNED', 'EMERGENCY_CAPSULE_WRITE_REJECTED') THEN
    RAISE EXCEPTION 'Unsupported audit action';
  END IF;
  event_id := (e->>'eventId')::uuid;
  INSERT INTO health.audit_events(id, occurred_at, actor_id, action, outcome, patient_id,
      resource_type, resource_id, scope, request_id, previous_hash, event_hash, signature,
      canonical_event, signer_key_id, signature_algorithm)
  VALUES(event_id, (e->>'occurredAt')::timestamptz, (e->>'actorId')::uuid,
      e->>'action', (e->>'outcome')::health.audit_outcome, (e->>'patientId')::uuid,
      e->>'resourceType', (e->>'resourceId')::uuid, 'OWNER_SELF', (e->>'requestId')::uuid,
      previous, p_hash, p_signature, p_canonical, p_signer, 'Ed25519');
  RETURN event_id;
END;
$$;
REVOKE ALL ON FUNCTION health.append_audit_event(text, bytea, bytea, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION health.append_audit_event(text, bytea, bytea, text) TO app_runtime;

CREATE FUNCTION health.patient_audit(p_patient uuid, p_limit integer)
RETURNS TABLE(chain_sequence bigint, canonical_event text, signature bytea, signer_key_id text, event_hash bytea)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, health AS $$
  SELECT a.chain_sequence, a.canonical_event, a.signature, a.signer_key_id, a.event_hash
  FROM health.audit_events a WHERE a.patient_id = p_patient
  ORDER BY a.chain_sequence DESC LIMIT greatest(1, least(p_limit, 100));
$$;
REVOKE ALL ON FUNCTION health.patient_audit(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION health.patient_audit(uuid, integer) TO app_runtime;
