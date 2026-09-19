import { Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DrizzleService } from '../../db/drizzle.service';

const RETENTION_DAYS = 14;

@Injectable()
export class ArchiveCleanupService {
  private readonly logger = new Logger(ArchiveCleanupService.name);

  constructor(private readonly drizzle: DrizzleService) {}

  async handleCleanup() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

    const deletedProjects = await this.drizzle.db.execute(
      sql`SELECT * FROM cleanup_archived_projects(${cutoff.toISOString()}::timestamptz)`,
    );
    const deletedModules = await this.drizzle.db.execute(
      sql`SELECT * FROM cleanup_archived_modules(${cutoff.toISOString()}::timestamptz)`,
    );

    if (deletedProjects.rows.length > 0) {
      this.logger.log(
        `Permanently deleted ${deletedProjects.rows.length} project(s) archived over ${RETENTION_DAYS} days ago`,
      );
    }
    if (deletedModules.rows.length > 0) {
      this.logger.log(
        `Permanently deleted ${deletedModules.rows.length} module(s) archived over ${RETENTION_DAYS} days ago`,
      );
    }

    return {
      deletedProjects: deletedProjects.rows,
      deletedModules: deletedModules.rows,
    };
  }
}
