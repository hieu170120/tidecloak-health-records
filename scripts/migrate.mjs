import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const dir = new URL('../database/migrations/', import.meta.url);
const files = readdirSync(dir).filter(f => /^\d{3}_[a-z_]+\.sql$/.test(f)).sort();
let sql = `\\set ON_ERROR_STOP on\nBEGIN;\nSELECT pg_advisory_xact_lock(724031000);\nDO $$ BEGIN IF to_regclass('health.principals') IS NULL THEN RAISE EXCEPTION 'Bootstrap schema missing'; END IF; END $$;\nCREATE TABLE IF NOT EXISTS health.schema_migrations(version text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());\nREVOKE ALL ON health.schema_migrations FROM PUBLIC;\n`;
for (const file of files) {
  const text = readFileSync(new URL(file, dir), 'utf8');
  const hash = createHash('sha256').update(text).digest('hex');
  sql += `DO $$ BEGIN IF EXISTS (SELECT 1 FROM health.schema_migrations WHERE version='${file}' AND sha256 <> '${hash}') THEN RAISE EXCEPTION 'Applied migration checksum changed: ${file}'; END IF; END $$;\n`;
  sql += `SELECT EXISTS(SELECT 1 FROM health.schema_migrations WHERE version='${file}') AS applied \\gset\n\\if :applied\n\\echo Already applied ${file}\n\\else\n`;
  sql += text + `\nINSERT INTO health.schema_migrations(version,sha256) VALUES('${file}','${hash}');\n\\echo Applied ${file}\n\\endif\n`;
}
sql += 'COMMIT;\n';
const args = ['compose','exec','-T'];
if (process.env.MIGRATION_DATABASE) {
  if (!/^[a-z0-9_]+$/.test(process.env.MIGRATION_DATABASE)) throw Error('Invalid test DB name');
  args.push('-e', `MIGRATION_DATABASE=${process.env.MIGRATION_DATABASE}`);
}
args.push('postgres','sh','-c','exec psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "${MIGRATION_DATABASE:-$POSTGRES_DB}"');
const result = spawnSync('docker', args, {cwd: root, input: sql, encoding:'utf8', maxBuffer: 4*1024*1024});
process.stdout.write(result.stdout || ''); process.stderr.write(result.stderr || '');
process.exit(result.status ?? 1);
