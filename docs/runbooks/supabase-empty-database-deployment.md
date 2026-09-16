# Supabase empty-database deployment

Use this procedure once for a new Flow in Motion Supabase project. Do not
create application tables manually in the dashboard.

## 1. Create two database passwords

Generate and store two different strong passwords in the team password
manager:

- `research_tracker_migration`: used only by Drizzle during deployment.
- `research_tracker_app`: used only by the NestJS Lambda at runtime.

Do not reuse the Supabase `postgres` password and do not commit any password.

## 2. Configure the local `.env`

From Supabase **Connect**, copy the shared pooler host. Use Session mode on port
5432 for bootstrap/migrations and Transaction mode on port 6543 for Lambda.

```dotenv
POSTGRES_DB=postgres

POSTGRES_BOOTSTRAP_HOST=<shared-pooler-host>
POSTGRES_BOOTSTRAP_PORT=5432
POSTGRES_BOOTSTRAP_USER=postgres.<project-ref>
POSTGRES_BOOTSTRAP_PASSWORD=<Supabase database password>
POSTGRES_BOOTSTRAP_SSL_MODE=require

POSTGRES_MIGRATION_HOST=<shared-pooler-host>
POSTGRES_MIGRATION_PORT=5432
POSTGRES_MIGRATION_USER=research_tracker_migration.<project-ref>
POSTGRES_MIGRATION_PASSWORD=<migration-role password>
POSTGRES_MIGRATION_SSL_MODE=require

POSTGRES_HOST=<shared-pooler-host>
POSTGRES_PORT=6543
POSTGRES_RUNTIME_USER=research_tracker_app.<project-ref>
POSTGRES_RUNTIME_PASSWORD=<runtime-role password>
POSTGRES_SSL_MODE=require
```

The host must be copied exactly. Do not construct the pooler cluster number.

## 3. Bootstrap restricted roles

```bash
pnpm --filter @research-tracker/migrations db:bootstrap:supabase
```

The command is idempotent. It creates or updates the two fixed roles and never
prints their passwords.

After this succeeds, remove the `POSTGRES_BOOTSTRAP_*` variables from any
deployment configuration. They are never used by the application.

## 4. Apply the committed migrations once

```bash
pnpm --filter @research-tracker/migrations db:migrate
```

This must use `POSTGRES_MIGRATION_USER`, not `POSTGRES_RUNTIME_USER`.

## 5. Verify the final database

```bash
pnpm --filter @research-tracker/migrations db:verify
```

The verifier fails unless:

- all 27 expected application tables exist and have RLS plus a policy;
- the complete Drizzle migration journal is present;
- required functions exist and SECURITY DEFINER functions have a safe search path;
- `research_tracker_app` has DML access but no elevated role attributes;
- Supabase `anon` and `authenticated` have no direct application-table access;
- exactly the required 34 enum/reference rows exist; and
- every user, workspace, project, paper, task, note, invitation, and event table is empty.

There are currently no application triggers; the verifier reports this as
zero expected triggers.

## 6. Configure Lambda

Store only the transaction-pooler runtime values in the Lambda environment or
AWS Secrets Manager:

```dotenv
POSTGRES_HOST=<shared-pooler-host>
POSTGRES_PORT=6543
POSTGRES_DB=postgres
POSTGRES_RUNTIME_USER=research_tracker_app.<project-ref>
POSTGRES_RUNTIME_PASSWORD=<runtime-role password>
POSTGRES_SSL_MODE=require
POSTGRES_CONNECT_TIMEOUT_MS=5000
POSTGRES_QUERY_TIMEOUT_MS=10000
POSTGRES_IDLE_TIMEOUT_MS=10000
```

Do not deploy the Supabase admin password or migration-role password to Lambda.

## 7. Future schema changes

Create and commit a new Drizzle migration, test it on an empty or disposable
database, apply it using the migration role, and rerun `db:verify`. Never edit
the production schema manually in the Supabase dashboard.
