import { Injectable, Logger } from '@nestjs/common';
import { CreateAnalyticsEventDto } from '../dto/create-analytics-event.dto';
import { AnalyticsRepository } from '../repositories/analytics.repository';

const DEFAULT_SUMMARY_DAYS = 30;
const MAX_SUMMARY_DAYS = 90;

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly repository: AnalyticsRepository) {}

  async recordEvent(
    tenantId: string,
    callerUserId: string,
    input: CreateAnalyticsEventDto,
  ) {
    // Client-reported errors are also worth an operational log line, not just
    // a row in the events table nobody may be watching.
    if (input.name === 'client_error') {
      this.logger.error(
        `Client error at ${input.path ?? 'unknown path'}: ${JSON.stringify(input.properties ?? {})}`,
        undefined,
        `tenant=${tenantId} user=${callerUserId}`,
      );
    }

    return this.repository.create({
      tenantId,
      userId: callerUserId,
      name: input.name,
      path: input.path,
      sessionId: input.sessionId,
      pageKey: input.pageKey,
      featureKey: input.featureKey,
      properties: input.properties,
    });
  }

  async summary(tenantId: string, days?: number) {
    const windowDays = Math.min(
      Math.max(1, days ?? DEFAULT_SUMMARY_DAYS),
      MAX_SUMMARY_DAYS,
    );
    const since = new Date();
    since.setDate(since.getDate() - windowDays);

    const [byName, byDay] = await Promise.all([
      this.repository.countsByName(tenantId, since),
      this.repository.dailyTotals(tenantId, since),
    ]);

    return {
      windowDays,
      totalEvents: byName.reduce((sum, row) => sum + row.count, 0),
      byName,
      byDay,
    };
  }
}
