import { ConfigService } from '@nestjs/config';
import { createPostgresPoolConfig } from './postgres-pool.config';

function config(overrides: Record<string, unknown> = {}) {
  return new ConfigService({
    POSTGRES_HOST: 'aws-0-ap-southeast-2.pooler.supabase.com',
    POSTGRES_PORT: 6543,
    POSTGRES_DB: 'postgres',
    POSTGRES_RUNTIME_USER: 'research_tracker_app.project-ref',
    POSTGRES_RUNTIME_PASSWORD: 'database-password',
    POSTGRES_SSL_MODE: 'require',
    ...overrides,
  });
}

describe('createPostgresPoolConfig', () => {
  it('creates a one-connection pool with short serverless timeouts', () => {
    expect(createPostgresPoolConfig(config())).toEqual(
      expect.objectContaining({
        host: 'aws-0-ap-southeast-2.pooler.supabase.com',
        port: 6543,
        max: 1,
        connectionTimeoutMillis: 5_000,
        query_timeout: 10_000,
        idleTimeoutMillis: 10_000,
        allowExitOnIdle: true,
        keepAlive: true,
        ssl: { rejectUnauthorized: false },
      }),
    );
  });

  it('supports verify-full with the Supabase CA stored in an environment variable', () => {
    const result = createPostgresPoolConfig(
      config({
        POSTGRES_SSL_MODE: 'verify-full',
        POSTGRES_SSL_CA:
          '-----BEGIN CERTIFICATE-----\\ncertificate\\n-----END CERTIFICATE-----',
      }),
    );

    expect(result.ssl).toEqual({
      rejectUnauthorized: true,
      ca: '-----BEGIN CERTIFICATE-----\ncertificate\n-----END CERTIFICATE-----',
    });
  });

  it('allows TLS to be disabled only for local development configuration', () => {
    expect(
      createPostgresPoolConfig(config({ POSTGRES_SSL_MODE: 'disable' })).ssl,
    ).toBe(false);
  });
});
