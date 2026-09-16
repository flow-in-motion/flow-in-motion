import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { createPostgresPoolConfig } from './postgres-pool.config';
import { envValidationSchema } from '../config/env.validation';

const describeWithSupabase =
  process.env.SUPABASE_POOLER_INTEGRATION_TEST === 'true'
    ? describe
    : describe.skip;

describeWithSupabase('Supabase transaction pooler integration', () => {
  let config: ConfigService;
  let pool: Pool | undefined;

  beforeAll(() => {
    const { error, value } = envValidationSchema.validate(process.env, {
      allowUnknown: true,
    });
    if (error) throw error;

    config = new ConfigService<Record<string, unknown>>(
      value as Record<string, unknown>,
    );
    pool = new Pool(createPostgresPoolConfig(config));
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('uses TLS and clears transaction-local tenant/user state after commit', async () => {
    expect(config.getOrThrow<number>('POSTGRES_PORT')).toBe(6543);

    const client = await pool!.connect();
    try {
      const stream = (
        client as unknown as {
          connection: { stream: { encrypted?: boolean } };
        }
      ).connection.stream;
      expect(stream.encrypted).toBe(true);

      await client.query('BEGIN');
      await client.query('SELECT set_config($1, $2, true)', [
        'app.current_tenant_id',
        'integration-tenant',
      ]);
      await client.query('SELECT set_config($1, $2, true)', [
        'app.current_user_id',
        'integration-user',
      ]);

      const inside = await client.query<{
        tenant_id: string;
        user_id: string;
      }>(`SELECT current_setting('app.current_tenant_id', true) AS tenant_id,
                   current_setting('app.current_user_id', true) AS user_id`);

      expect(inside.rows[0]).toEqual({
        tenant_id: 'integration-tenant',
        user_id: 'integration-user',
      });
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    const after = await pool!.query<{
      tenant_id: string | null;
      user_id: string | null;
    }>(`SELECT nullif(current_setting('app.current_tenant_id', true), '') AS tenant_id,
                 nullif(current_setting('app.current_user_id', true), '') AS user_id`);

    expect(after.rows[0]).toEqual({
      tenant_id: null,
      user_id: null,
    });
  }, 20_000);
});
