import { type INestApplicationContext, Logger } from '@nestjs/common';

import { ArchiveCleanupService } from './modules/archive-cleanup/archive-cleanup.service';

export interface CleanupResult {
  deletedProjects: number;
  deletedModules: number;
  capturedWeeklySnapshots: number;
}

type CleanupApplicationContext = Pick<INestApplicationContext, 'get' | 'close'>;

const logger = new Logger('ArchiveCleanupLambda');

export async function runCleanup(
  app: CleanupApplicationContext,
): Promise<CleanupResult> {
  try {
    const cleanup = app.get(ArchiveCleanupService);
    const result = await cleanup.handleCleanup();

    const summary = {
      deletedProjects: result.deletedProjects.length,
      deletedModules: result.deletedModules.length,
      capturedWeeklySnapshots: result.capturedWeeklySnapshots,
    };

    logger.log(
      `Cleanup completed: ${summary.deletedProjects} project(s), ` +
        `${summary.deletedModules} module(s) permanently deleted; ` +
        `${summary.capturedWeeklySnapshots} weekly usage snapshot(s) captured`,
    );

    return summary;
  } catch (error) {
    logger.error(
      'Scheduled archive cleanup failed',
      error instanceof Error ? error.stack : undefined,
    );
    throw error;
  } finally {
    await app.close();
  }
}
