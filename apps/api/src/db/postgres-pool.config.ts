import { ConfigService } from '@nestjs/config';
import type { PoolConfig } from 'pg';

type PostgresSslMode = 'disable' | 'require' | 'verify-full';

function sslConfig(configService: ConfigService): PoolConfig['ssl'] {
  const mode = configService.get<PostgresSslMode>(
    'POSTGRES_SSL_MODE',
    'require',
  );

  if (mode === 'disable') {
    return false;
  }

  if (mode === 'verify-full') {
    const ca = configService
      .getOrThrow<string>('POSTGRES_SSL_CA')
      .replace(/\\n/g, '\n');

    return { rejectUnauthorized: true, ca };
  }

  // Equivalent to sslmode=require: encryption is mandatory, while certificate
  // verification can be enabled separately with verify-full and Supabase's CA.
  return { rejectUnauthorized: false };
}

/**
 * Application-side pool settings for a Lambda instance connecting through
 * Supabase's transaction pooler. Keep this pool at one connection: every warm
 * Lambda environment creates its own instance of it.
 */
export function createPostgresPoolConfig(
  configService: ConfigService,
): PoolConfig {
  return {
    host: configService.getOrThrow<string>('POSTGRES_HOST'),
    port: configService.getOrThrow<number>('POSTGRES_PORT'),
    user: configService.getOrThrow<string>('POSTGRES_RUNTIME_USER'),
    password: configService.getOrThrow<string>('POSTGRES_RUNTIME_PASSWORD'),
    database: configService.getOrThrow<string>('POSTGRES_DB'),
    ssl: sslConfig(configService),
    max: 1,
    connectionTimeoutMillis: configService.get<number>(
      'POSTGRES_CONNECT_TIMEOUT_MS',
      5_000,
    ),
    query_timeout: configService.get<number>(
      'POSTGRES_QUERY_TIMEOUT_MS',
      10_000,
    ),
    idleTimeoutMillis: configService.get<number>(
      'POSTGRES_IDLE_TIMEOUT_MS',
      10_000,
    ),
    allowExitOnIdle: true,
    keepAlive: true,
  };
}
