// apps/api/src/db/drizzle.service.ts
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as schema from '@research-tracker/migrations';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, PoolClient } from 'pg';
import { getRequestContext } from './request-context';
import { createPostgresPoolConfig } from './postgres-pool.config';

@Injectable()
export class DrizzleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DrizzleService.name);
  private pool!: Pool;
  private plainDb!: NodePgDatabase<typeof schema>;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.pool = new Pool(createPostgresPoolConfig(this.configService));
    this.pool.on('error', (error) => {
      this.logger.warn(
        `Discarding an idle Postgres connection: ${error.message}`,
      );
    });

    // node-postgres uses server-side prepared statements only for explicitly
    // named queries. The application and Drizzle calls intentionally use
    // unnamed queries, which are compatible with transaction pooling.
    this.plainDb = drizzle(this.pool, { schema });
  }

  get db(): NodePgDatabase<typeof schema> {
    const context = getRequestContext();
    return context?.tx ?? this.plainDb;
  }

  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  async checkConnection(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
