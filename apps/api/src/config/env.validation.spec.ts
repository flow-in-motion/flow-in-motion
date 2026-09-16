import { envValidationSchema } from './env.validation';

describe('envValidationSchema', () => {
  it('provides secure invitation token defaults', () => {
    const { error, value } = envValidationSchema.validate({
      APP_URL: 'http://localhost:5173',
      POSTGRES_HOST: 'localhost',
      POSTGRES_PORT: 5432,
      POSTGRES_DB: 'researchtracker',
      POSTGRES_SSL_MODE: 'disable',
      POSTGRES_MIGRATION_USER: 'migration-user',
      POSTGRES_MIGRATION_PASSWORD: 'migration-password',
      POSTGRES_RUNTIME_USER: 'runtime-user',
      POSTGRES_RUNTIME_PASSWORD: 'runtime-password',
      SUPABASE_URL: 'https://project-ref.supabase.co',
    });

    expect(error).toBeUndefined();
    expect(value.INVITATION_TOKEN_TTL_HOURS).toBe(72);
    expect(value.INVITATION_TOKEN_BYTES).toBe(32);
    expect(value.SUPABASE_JWT_AUDIENCE).toBe('authenticated');
    expect(value.AWS_REGION).toBe('ap-southeast-2');
    expect(value.POSTGRES_CONNECT_TIMEOUT_MS).toBe(5_000);
    expect(value.POSTGRES_QUERY_TIMEOUT_MS).toBe(10_000);
    expect(value.POSTGRES_IDLE_TIMEOUT_MS).toBe(10_000);
  });

  it('rejects a production connection that is not the TLS transaction pooler', () => {
    const { error } = envValidationSchema.validate({
      NODE_ENV: 'production',
      APP_URL: 'https://flow-in-motion.example',
      POSTGRES_HOST: 'db.project-ref.supabase.co',
      POSTGRES_PORT: 5432,
      POSTGRES_DB: 'postgres',
      POSTGRES_SSL_MODE: 'disable',
      POSTGRES_MIGRATION_USER: 'migration-user',
      POSTGRES_MIGRATION_PASSWORD: 'migration-password',
      POSTGRES_RUNTIME_USER: 'runtime-user.project-ref',
      POSTGRES_RUNTIME_PASSWORD: 'runtime-password',
      SUPABASE_URL: 'https://project-ref.supabase.co',
    });

    expect(error).toBeDefined();
  });

  it('requires the Supabase CA when verify-full is selected', () => {
    const { error } = envValidationSchema.validate({
      NODE_ENV: 'production',
      APP_URL: 'https://flow-in-motion.example',
      POSTGRES_HOST: 'aws-0-ap-southeast-2.pooler.supabase.com',
      POSTGRES_PORT: 6543,
      POSTGRES_DB: 'postgres',
      POSTGRES_SSL_MODE: 'verify-full',
      POSTGRES_MIGRATION_USER: 'migration-user',
      POSTGRES_MIGRATION_PASSWORD: 'migration-password',
      POSTGRES_RUNTIME_USER: 'runtime-user.project-ref',
      POSTGRES_RUNTIME_PASSWORD: 'runtime-password',
      SUPABASE_URL: 'https://project-ref.supabase.co',
    });

    expect(error?.message).toContain('POSTGRES_SSL_CA');
  });
});
