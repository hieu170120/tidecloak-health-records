import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { generateKeyPairSync } from 'node:crypto';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const env = parseEnv(readFileSync(root+'.env.docker','utf8'));
const adapter = JSON.parse(readFileSync(root+'tidecloak.json','utf8'));
const issuer = adapter['auth-server-url'].replace(/\/$/,'')+'/realms/'+adapter.realm;
const values = {
  DATABASE_HOST:'postgres', DATABASE_PORT:'5432', DATABASE_USER:'app_runtime',
  DATABASE_PASSWORD:env.APP_DB_PASSWORD, DATABASE_NAME:env.POSTGRES_DB,
  TIDECLOAK_ISSUER_URL:issuer, TIDECLOAK_AUDIENCE:env.TIDECLOAK_AUDIENCE,
  TIDECLOAK_CLIENT_ID:env.TIDECLOAK_CLIENT_ID,
  TIDECLOAK_JWKS_URL:(env.TIDECLOAK_ISSUER_URL || issuer).replace(/\/$/,'')+'/protocol/openid-connect/certs',
  DPOP_PUBLIC_BASE_URL:env.DPOP_PUBLIC_BASE_URL ?? 'http://localhost:3000/api/health',
  AUDIT_SIGNING_KEY_FILE:'/run/secrets/audit_signing_key', PORT:'3001',
};
for (const [key,value] of Object.entries(values)) if (!value || /[\r\n]/.test(value)) throw Error(`Missing/invalid ${key}`);
// JSON quoting is accepted by dotenv/Compose, preserving #, $ and spaces in passwords.
writeFileSync(root+'.env.api', Object.entries(values).map(([k,v])=>`${k}='${v.replaceAll("'", "\\'")}'`).join('\n')+'\n', {mode:0o600});
mkdirSync(root+'.secrets',{recursive:true,mode:0o700});
if (!existsSync(root+'.secrets/audit-signing-key.pem')) {
  const {privateKey,publicKey}=generateKeyPairSync('ed25519');
  writeFileSync(root+'.secrets/audit-signing-key.pem',privateKey.export({format:'pem',type:'pkcs8'}),{mode:0o600});
  writeFileSync(root+'.secrets/audit-signing-public.pem',publicKey.export({format:'pem',type:'spki'}),{mode:0o644});
}
console.log('Configured app-only DB credentials, separate issuer/JWKS URL and local audit signer. No credentials printed.');
