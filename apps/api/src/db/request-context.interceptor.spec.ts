import { ConfigService } from '@nestjs/config';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import type { PoolClient } from 'pg';
import { DrizzleService } from './drizzle.service';
import { Client } from 'pg';
import {
  buildRequestSetupSql,
  RequestContextInterceptor,
} from './request-context.interceptor';
import { UsersService } from '../modules/users/users.service';

function executionContext(originalUrl: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        originalUrl,
        user: { sub: 'supabase-user-1' },
      }),
    }),
  } as unknown as ExecutionContext;
}

// pg's own escaping, so the tests check the SQL that would really be sent.
const realEscapeLiteral = (value: string) =>
  Client.prototype.escapeLiteral.call(undefined, value);

describe('buildRequestSetupSql', () => {
  it('escapes values so a crafted tenant id cannot break out of its quotes', () => {
    const sql = buildRequestSetupSql({ escapeLiteral: realEscapeLiteral }, [
      ['app.current_tenant_id', "x', true); DROP TABLE users; --"],
    ]);

    expect(sql).toBe(
      "BEGIN; SELECT set_config('app.current_tenant_id', " +
        "'x'', true); DROP TABLE users; --', true);",
    );
  });
});

describe('RequestContextInterceptor', () => {
  it('keeps timeout and request context state inside one transaction', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const release = jest.fn();
    const client = {
      query,
      release,
      escapeLiteral: realEscapeLiteral,
    } as unknown as PoolClient;
    const getClient = jest.fn().mockResolvedValue(client);
    const drizzle = {
      getClient,
    } as unknown as DrizzleService;
    const users = {
      findByExternalAuthId: jest.fn().mockResolvedValue({ id: 'user-1' }),
    } as unknown as UsersService;
    const config = {
      get: jest.fn().mockReturnValue(7_500),
    } as unknown as ConfigService;
    const interceptor = new RequestContextInterceptor(drizzle, users, config);
    const next = { handle: () => of({ ok: true }) } as CallHandler;

    await expect(
      lastValueFrom(
        interceptor.intercept(
          executionContext('/api/v1/tenant/tenant-1/projects'),
          next,
        ),
      ),
    ).resolves.toEqual({ ok: true });

    // BEGIN and every setting go to the database in a single round trip.
    expect(query).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenNthCalledWith(
      1,
      "BEGIN; SELECT set_config('statement_timeout', '7500', true), " +
        "set_config('app.current_tenant_id', 'tenant-1', true), " +
        "set_config('app.current_user_id', 'user-1', true);",
    );
    expect(query).toHaveBeenNthCalledWith(2, 'COMMIT');
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('does not open a request transaction for health checks', async () => {
    const getClient = jest.fn();
    const drizzle = {
      getClient,
    } as unknown as DrizzleService;
    const interceptor = new RequestContextInterceptor(
      drizzle,
      {} as UsersService,
      {} as ConfigService,
    );

    await expect(
      lastValueFrom(
        interceptor.intercept(executionContext('/health/ready'), {
          handle: () => of({ status: 'ok' }),
        }),
      ),
    ).resolves.toEqual({ status: 'ok' });

    expect(getClient).not.toHaveBeenCalled();
  });
});
