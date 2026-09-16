import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { DrizzleService } from '../../db/drizzle.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly drizzle: DrizzleService,
  ) {}

  @Get('live')
  @HealthCheck()
  checkLiveness() {
    return this.health.check([]);
  }

  @Get('ready')
  @HealthCheck()
  checkReadiness() {
    return this.health.check([() => this.checkPostgres()]);
  }

  private async checkPostgres(): Promise<HealthIndicatorResult> {
    try {
      await this.drizzle.checkConnection();
      return { postgres: { status: 'up' } };
    } catch (error) {
      throw new Error(`Postgres check failed: ${(error as Error).message}`);
    }
  }
}
