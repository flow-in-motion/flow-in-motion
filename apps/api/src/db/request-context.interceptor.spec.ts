import { ConfigService } from '@nestjs/config';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import type { PoolClient } from 'pg';
import { DrizzleService } from './drizzle.service';
import { RequestContextInterceptor } from './request-context.interceptor';
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

describe('RequestContextInterceptor', () => {
  it('keeps timeout and request context state inside one transaction', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const release = jest.fn();
    const client = {
      query,
      release,
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

    expect(query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(query).toHaveBeenNthCalledWith(
      2,
      'SELECT set_config($1, $2, true)',
      ['statement_timeout', '7500'],
    );
    expect(query).toHaveBeenNthCalledWith(
      3,
      'SELECT set_config($1, $2, true)',
      ['app.current_tenant_id', 'tenant-1'],
    );
    expect(query).toHaveBeenNthCalledWith(
      4,
      'SELECT set_config($1, $2, true)',
      ['app.current_user_id', 'user-1'],
    );
    expect(query).toHaveBeenNthCalledWith(5, 'COMMIT');
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
