# Temporary Dev PostgreSQL on AWS RDS

> **Superseded:** the current deployment plan uses a fresh Supabase database. Do not create this RDS instance for the Supabase deployment.

A throwaway RDS PostgreSQL instance for development, replacing the local `docker-compose` Postgres. Not for production data — deleted when development is complete (step 9).

**Recommended:** Amazon RDS for PostgreSQL, `db.t4g.micro`, single-AZ, 20GB gp3 storage, in `ap-southeast-2` (same region as the existing Cognito setup). Free if your AWS account is inside its Free Tier window (check **Billing → Free Tier**); otherwise ~$12-15/month.

Uses the AWS CLI profile already configured for this project: `research-dev` (see `AWS_PROFILE` in `.env.example`).

On macOS instead of Windows? Once the instance exists (steps 1-2 below), switch to [dev-database-rds-access-macos.md](dev-database-rds-access-macos.md) for the client setup and connection steps.

---

## 1. Re-authenticate the AWS CLI profile

```powershell
aws sso login --profile research-dev
aws sts get-caller-identity --profile research-dev
```

## 2. Create the RDS instance

```powershell
aws rds create-db-instance `
  --db-instance-identifier research-tracker-dev-db `
  --db-instance-class db.t4g.micro `
  --engine postgres `
  --engine-version 16 `
  --master-username dbadmin `
  --master-user-password '<CHOOSE_A_STRONG_MASTER_PASSWORD>' `
  --allocated-storage 20 `
  --storage-type gp3 `
  --db-name researchtracker `
  --publicly-accessible `
  --no-multi-az `
  --backup-retention-period 1 `
  --no-deletion-protection `
  --vpc-security-group-ids <SG_ID_from_step_below> `
  --profile research-dev `
  --region ap-southeast-2
```

Create the security group first if you don't already have one:

```powershell
$VpcId = aws ec2 describe-vpcs --filters Name=is-default,Values=true `
  --profile research-dev --region ap-southeast-2 --query "Vpcs[0].VpcId" --output text

$SgId = aws ec2 create-security-group `
  --group-name research-tracker-dev-rds `
  --description "Temporary dev RDS - PostgreSQL" `
  --vpc-id $VpcId `
  --profile research-dev --region ap-southeast-2 --query "GroupId" --output text
```

Then use `$SgId` as `--vpc-security-group-ids` above.

Wait for it to become available (~5-10 minutes):

```powershell
aws rds wait db-instance-available `
  --db-instance-identifier research-tracker-dev-db `
  --profile research-dev --region ap-southeast-2
```

Get the endpoint:

```powershell
$RdsEndpoint = aws rds describe-db-instances `
  --db-instance-identifier research-tracker-dev-db `
  --profile research-dev --region ap-southeast-2 `
  --query "DBInstances[0].Endpoint.Address" --output text
$RdsEndpoint
```

## 3. Restrict network access to this Windows laptop

1. On the database's **Connectivity & security** tab, open its VPC security group.
2. Open **Inbound rules > Edit inbound rules**.
3. Add one rule:
   - Type: PostgreSQL
   - Protocol: TCP
   - Port: 5432
   - Source: **My IP** (`your-public-IP/32`)
4. Save the rule.

Or via CLI:

```powershell
$MyIp = (Invoke-RestMethod -Uri "https://checkip.amazonaws.com").Trim()
aws ec2 authorize-security-group-ingress `
  --group-id $SgId `
  --protocol tcp --port 5432 `
  --cidr "$MyIp/32" `
  --profile research-dev --region ap-southeast-2
```

Never use `0.0.0.0/0` for PostgreSQL. If your public IP changes, update this rule. If other developers need access, add each of their IPs as a separate rule — there's no single rule that safely opens it to "the team" without naming IPs or a range.

## 4. Install a PostgreSQL client and the RDS CA certificate

Check whether `psql` is installed:

```powershell
psql --version
```

If missing, avoid the full PostgreSQL installer (it installs a Windows service listening on 5432, which conflicts with the local Docker Postgres). Instead, grab just the client binaries:

```powershell
$installDir = "$env:USERPROFILE\pgsql16"
Invoke-WebRequest -Uri "https://sbp.enterprisedb.com/getfile.jsp?fileid=1260422" -OutFile "$env:TEMP\pgsql16-win-binaries.zip"
tar -xf "$env:TEMP\pgsql16-win-binaries.zip" -C $installDir
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
[Environment]::SetEnvironmentVariable("Path", "$userPath;$installDir\pgsql\bin", "User")
```
Reopen PowerShell afterwards so the updated PATH takes effect.

Download AWS's RDS certificate bundle:

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.aws" | Out-Null
Invoke-WebRequest `
  -Uri "https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem" `
  -OutFile "$env:USERPROFILE\.aws\rds-global-bundle.pem"
```

Set convenient variables for the current PowerShell window. Use forward slashes for `$RdsCa` — libpq connection strings (the `"host=... sslrootcert=..."` string `psql` takes) treat backslash as an escape character, so a Windows-style path silently loses its backslashes when embedded in one:

```powershell
$RdsEndpoint = "<RDS_ENDPOINT>"   # from step 2
$RdsCa = "$env:USERPROFILE\.aws\rds-global-bundle.pem".Replace('\','/')
```

## 5. Create the migration and application roles

Connect using the RDS master account. `psql` prompts for the master password:

```powershell
psql "host=$RdsEndpoint port=5432 dbname=researchtracker user=dbadmin sslmode=verify-full sslrootcert=$RdsCa"
```

At the `researchtracker=>` prompt, run:

```sql
CREATE ROLE research_tracker_migration LOGIN;
\password research_tracker_migration

CREATE ROLE research_tracker_app LOGIN;
\password research_tracker_app

GRANT CREATE ON DATABASE researchtracker TO research_tracker_migration;
GRANT ALL PRIVILEGES ON SCHEMA public TO research_tracker_migration;
GRANT CONNECT ON DATABASE researchtracker TO research_tracker_app;
GRANT USAGE ON SCHEMA public TO research_tracker_app;
```

The two `\password` commands securely prompt for new, different passwords. Store those passwords in a password manager. Exit `psql`:

```text
\q
```

Do not use the RDS master account in the running application.

## 6. Point the project at RDS

From the repository root, open the ignored local environment file:

```powershell
Set-Location "C:\Users\Avi\Documents\GitHub\ResearchAndTracking"
notepad .env
```

Update only the PostgreSQL values:

```env
POSTGRES_HOST=<RDS_ENDPOINT>
POSTGRES_PORT=5432
POSTGRES_DB=researchtracker
POSTGRES_SSL=true
POSTGRES_MIGRATION_USER=research_tracker_migration
POSTGRES_MIGRATION_PASSWORD=<MIGRATION_ROLE_PASSWORD>
POSTGRES_RUNTIME_USER=research_tracker_app
POSTGRES_RUNTIME_PASSWORD=<APPLICATION_ROLE_PASSWORD>
```

Do not put the RDS master password in `.env`. The file is ignored by Git and must never be committed.

Node.js must trust the RDS certificate before it starts. In every new PowerShell window used to run migrations or the application, set:

```powershell
$env:NODE_EXTRA_CA_CERTS = "$env:USERPROFILE\.aws\rds-global-bundle.pem"
```

## 7. Create all application tables

From the repository root, run:

```powershell
$env:NODE_EXTRA_CA_CERTS = "$env:USERPROFILE\.aws\rds-global-bundle.pem"
pnpm --dir database/migrations db:migrate
```

Drizzle applies every SQL migration and creates the tables, foreign keys, indexes, enum seed data, runtime grants, and profile columns. Do not create the application tables manually in the RDS console.

Expected final message:

```text
migrations applied successfully!
```

## 8. Verify the tables and application

Connect with the migration role:

```powershell
psql "host=$RdsEndpoint port=5432 dbname=researchtracker user=research_tracker_migration sslmode=verify-full sslrootcert=$RdsCa"
```

Then run:

```sql
\dt
SELECT COUNT(*) FROM drizzle.__drizzle_migrations;
SELECT category, value FROM enum ORDER BY category, sort_order;
\q
```

Start the application from the same PowerShell window:

```powershell
$env:NODE_EXTRA_CA_CERTS = "$env:USERPROFILE\.aws\rds-global-bundle.pem"
pnpm dev
```

Verify registration, login, workspace creation, projects, tasks, modules, notes, Settings profile updates, and `/health/ready`.

## 9. Delete the temporary database

When development is complete:

1. Take a `pg_dump` first if any data must be retained.
2. Open **RDS > Databases > research-tracker-dev-db > Actions > Delete**.
3. For disposable data, do not create a final snapshot and delete retained automated backups.
4. Delete any manual RDS snapshots that are no longer required because they continue to incur storage charges.
5. Delete the `research-tracker-dev-rds` security group if nothing uses it.
6. Confirm in Billing that no RDS instance or snapshot remains.

Whether or not you're inside the Free Tier window, set a calendar reminder — a forgotten RDS instance is the most common source of a surprise AWS bill.
