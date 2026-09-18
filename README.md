# Overview

A functioning application that several researchers can use concurrently through realistic project, task, daily-note and regulated-record workflows. The MVP must be deployable, testable and suitable for controlled improvement after the initial pilot. It must not require a later architectural rewrite merely to add users, modules, capacity or stronger infrastructure.

## Local Development Setup

### Prerequisites

- Node.js (version pinned in `.nvmrc`) — install via [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm)
- pnpm (version pinned in `package.json`'s `packageManager` field, managed via Corepack)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (running, not just installed)

### 1. Clone and enter the repo

```bash
git clone https://github.com/flow-in-motion/flow-in-motion.git
cd flow-in-motion
```

### 2. Use the correct Node version

```bash
nvm use
```

If you don't have this Node version installed yet:

```bash
nvm install
nvm use
```

### 3. Enable Corepack and activate pnpm

```bash
corepack enable
corepack prepare --activate
```

Verify:

```bash
node -v
pnpm -v
```

These should match the versions in `.nvmrc` and `package.json`.

### 4. Install dependencies

```bash
pnpm install
```

If you see an `ERR_PNPM_IGNORED_BUILDS` warning, run:

```bash
pnpm approve-builds
```

and select the listed packages, then re-run `pnpm install`.

### 5. Set up environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in the local PostgreSQL values plus your Supabase project URL. Then create the frontend environment file and add the project URL and publishable key:

For local Docker PostgreSQL, override the database settings from `.env.example` with:

```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=researchtracker
POSTGRES_SSL_MODE=disable
POSTGRES_MIGRATION_HOST=localhost
POSTGRES_MIGRATION_PORT=5432
POSTGRES_MIGRATION_SSL_MODE=disable
```

```bash
cp apps/web/.env.example apps/web/.env
```

Never place a Supabase secret or service-role key in `apps/web/.env`.

### 6. Start PostgreSQL

```bash
docker compose up -d
```

Verify the container is running:

```bash
docker compose ps
```

`postgres` should show status `Up`.

**Verify PostgreSQL is reachable:**

```bash
docker exec -it your-repo-postgres psql -U <POSTGRES_USER value> -d <POSTGRES_DB value>
```

You should land in a `psql` prompt. Type `\q` to exit.

### 7. Database roles and migrations

This project uses two Postgres roles, created once per database cluster:

- `research_tracker_migration` — full schema privileges, used only to run migrations.
- `research_tracker_app` — read/write only, used by the running application.

**Bootstrap the roles in local Docker (once per fresh local database):**

```bash
export $(grep -v '^#' .env | xargs)
./scripts/db-bootstrap.sh
```

**Bootstrap the roles in Supabase (once per project):**

```bash
pnpm --filter @research-tracker/migrations db:bootstrap:supabase
```

Use the shared **Session pooler** admin connection for this command. It creates
`research_tracker_migration` and `research_tracker_app` with no superuser,
database-creation, role-creation, replication, or RLS-bypass privileges.

**Run migrations:**

```bash
cd database/migrations
pnpm db:migrate
```

Verify the resulting empty database and security configuration:

```bash
pnpm --filter @research-tracker/migrations db:verify
```

Never give the running Lambda the bootstrap or migration credentials. See
[`docs/runbooks/supabase-empty-database-deployment.md`](docs/runbooks/supabase-empty-database-deployment.md)
for the production sequence.

**Required environment variables:**

| Variable                                                  | Used by               | Purpose                                |
| --------------------------------------------------------- | --------------------- | -------------------------------------- |
| `POSTGRES_HOST` / `POSTGRES_PORT` / `POSTGRES_DB`         | running API           | Supabase transaction pooler connection |
| `POSTGRES_SSL_MODE` and timeout variables                 | running API           | TLS and serverless connection safety   |
| `POSTGRES_MIGRATION_HOST` / `POSTGRES_MIGRATION_PORT`     | `drizzle-kit migrate` | Session/direct migration connection     |
| `POSTGRES_MIGRATION_USER` / `POSTGRES_MIGRATION_PASSWORD` | `drizzle-kit migrate` | Runs schema migrations, owns tables    |
| `POSTGRES_RUNTIME_USER` / `POSTGRES_RUNTIME_PASSWORD`     | running API           | Read/write only, cannot alter schema   |

> **Note:** the database role is always named `research_tracker_migration`.
> Through Supabase's shared pooler, its connection username is
> `research_tracker_migration.<project-ref>`.

For Lambda, copy the **Transaction pooler** values from the Supabase Connect dialog. The runtime port must be `6543`; shared-pooler custom-role usernames have the form `role.project-ref`. The API pool is fixed at one connection per warm Lambda instance. Migration credentials are not required by the running API.

After configuring a non-production Supabase project, run the live compatibility check:

```bash
SUPABASE_POOLER_INTEGRATION_TEST=true database/migrations/node_modules/.bin/dotenv -e .env -- pnpm --filter @research-tracker/api exec jest supabase-transaction-pooler.integration.spec.ts --runInBand
```

### 8. Run the API

Invitation emails are delivered by Amazon SES. Verify the sender identity in
the same AWS region, set `INVITATION_EMAIL_FROM` in `.env`, and make AWS
credentials available through the normal SDK credential chain (for example,
`AWS_PROFILE=research-dev` locally or an IAM role in deployment). The identity
needs `ses:SendEmail` permission. While an SES account is in
sandbox mode, recipient addresses must also be verified.

```bash
pnpm dev
```

This starts the NestJS API in watch mode at `http://localhost:3000`. Verify it's running:

```bash
curl http://localhost:3000/health/live
curl http://localhost:3000/health/ready
```

Both should return `200 OK` with a small JSON body. `/health/ready` will return `503` if PostgreSQL isn't running.

### 9. Run the web app

```bash
pnpm --filter @research-tracker/web dev
```

This starts the Vite dev server at [http://localhost:5173](http://localhost:5173).

### 10. Useful root-level commands

Run from the repo root, across all workspace packages:

```bash
pnpm lint         # lint all packages
pnpm type-check   # type-check all packages
pnpm test         # run all backend tests
pnpm build        # production build for apps
```

### 11. Stopping local services

```bash
docker compose down
```

This stops the containers but **keeps your data**. To fully reset (delete all local data):

```bash
docker compose down -v
```

### Troubleshooting

- **`ERR_PNPM_IGNORED_BUILDS` during install** — run `pnpm approve-builds`, select the listed packages, then re-run `pnpm install`.
- **`ERR_PNPM_OUTDATED_LOCKFILE`** — someone changed a `package.json` without updating the lockfile. Run `pnpm install` (without `--frozen-lockfile`) to regenerate it, then commit the result.
- **Port already in use (5432, 3000, or 5173)** — something else on your machine is using that port. Stop it, or check what's using it with `lsof -i :<port>`.
- **Postgres login fails after changing `.env`** — Postgres only applies `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` on first container creation. If you change these after the fact, run `docker compose down -v` (removes local data) and `docker compose up -d` again to reinitialize.

```

```
