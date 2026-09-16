# PostgreSQL Hosting Options on AWS

> **Superseded:** Flow in Motion now uses Supabase for PostgreSQL and authentication. This document is retained only as historical evaluation material and is not the current deployment plan.

## Context

The app currently runs PostgreSQL locally (via `docker-compose.yml`), accessed through `drizzle-orm`/`pg`, with separate migration (DDL) and runtime (DML) database roles already in place. We already run on AWS for Cognito and SES. We need to move the database to AWS.

**Scale:** ~30-40 users initially, with a plausible path to 100-200 users. This is a light workload — well within a single small managed instance.

## Options

| Option | Fit | Notes |
|---|---|---|
| **Amazon RDS for PostgreSQL** | ✅ Recommended | Fully managed backups, patching, monitoring. Vanilla PostgreSQL — no compatibility surprises. Our migration/runtime role split maps directly onto its IAM/user model. Vertical resize (bigger instance) takes minutes, no data migration needed. |
| **Aurora PostgreSQL (incl. Serverless v2)** | ❌ Overkill | Auto-scaling storage/compute and fast read replicas are built for bursty or large-scale traffic. Has a higher price floor than RDS and Aurora-specific quirks (some extensions/behaviors differ from vanilla Postgres). Not worth it at 30-200 users. |
| **Self-managed PostgreSQL on EC2** | ❌ Not worth it | Cheapest raw compute, but you own patching, backups, failover, and security updates. No real cost advantage at this scale once ops time is counted. |
| **RDS on Graviton (arm64), e.g. `db.t4g.*`** | ✅ Same as RDS, cheaper | Same managed experience as standard RDS, ~20% cheaper than x86 instance classes for equivalent performance. |

## Recommendation

**Amazon RDS for PostgreSQL**, Graviton instance class:

- Start: `db.t4g.micro` or `db.t4g.small`, single-AZ, 20GB gp3 storage, automated daily backups
- Same region as existing Cognito setup (`ap-southeast-2`)
- Estimated cost: ~$15-30/month at this size
- Credentials: use AWS Secrets Manager (or SSM Parameter Store) rather than plain env vars in production

## Scaling path (30-40 → 100-200 users)

1. **First**, check actual CPU/memory/connection metrics in CloudWatch — at this user count you likely won't be resource-bound.
2. **If needed:** resize the instance class (e.g. `t4g.small` → `t4g.medium`) — a few minutes of downtime, no migration.
3. **For high availability:** enable Multi-AZ (automatic failover) — roughly doubles compute cost, so worth deferring until uptime requirements justify it.
4. **Only if truly outgrown:** migrate to Aurora PostgreSQL. Unlikely to be necessary at 200 users, but the migration path exists (Aurora is wire-compatible with PostgreSQL).

## Main tradeoff to flag

Single-AZ (the recommended starting point) has no automatic failover — acceptable for an internal research-tracking tool, but if uptime is a hard requirement, budget for Multi-AZ from the start instead of adding it later.
