# tidecloak-health-records

## Local setup

```powershell
npm install
Copy-Item tidecloak.example.json tidecloak.json
npm run dev
```

Provision TideCloak and replace `tidecloak.json` with the generated adapter
configuration before using authentication.

## Local data services (Docker)

The local data stack is PostgreSQL for encrypted records, consent, and audit
events. It does not store application passwords or medical-record plaintext.

```powershell
Copy-Item .env.docker.example .env.docker
docker compose up -d
docker compose ps
```

PostgreSQL is available only on `127.0.0.1:5433`. Change every value in
`.env.docker` before using this outside local development.

Docker initializes the `health` schema once, when the PostgreSQL volume is
first created. It creates the `app_runtime`, `audit_writer`, and
`audit_verifier` database roles. Ciphertext is stored as PostgreSQL `bytea`
for this initial all-Docker deployment. We can add an object-storage container
later if records grow to include large medical images or scans.

## NestJS API

`api/` is a NestJS service that connects to PostgreSQL using the restricted
`app_runtime` database role. Start or rebuild it with the rest of the stack:

```powershell
docker compose up -d --build api
```

The API image installs dependencies once during its build stage, compiles with
TypeScript, then prunes development dependencies before the runtime image is
created.

After the API is healthy, verify its database connection at
`http://127.0.0.1:3001/health`. The expected response is
`{"status":"ok","database":"ok"}`.

All API routes are protected by TideCloak JWT verification except routes
explicitly marked public, currently only `/health`. The API validates the
token signature from the realm JWKS endpoint as well as its `issuer` and
`audience`, then exposes `sub`, optional `vuid`, and approved health roles to
the request. Set `TIDECLOAK_ISSUER_URL`, `TIDECLOAK_AUDIENCE`, and
`TIDECLOAK_CLIENT_ID` in `.env.docker` to values matching the active realm and
client.

To reset local Docker data intentionally, stop the stack and remove its named
volumes. This permanently deletes the local development data.

## Patient capsule milestone

Identity mapping, owner-only encrypted capsule versioning and transaction-coupled local audit are now implemented. See [database setup and API contract](docs/database-next-steps.md). This does not yet implement doctor sharing or Break-Glass.

```sh
node scripts/configure-local-api.mjs
node scripts/migrate.mjs
docker compose up -d --build api
node scripts/test-database-flow.mjs
npm run dev
```

Open `/patient/emergency-capsule`. Real Tide realm roles/login must be verified; the integration suite uses an isolated test database and local signed JWT fixtures, never an authentication bypass on the live API. Keep `.env.api` and `.secrets/` out of Git.
