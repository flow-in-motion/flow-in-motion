import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { CleanupLambdaModule } from './cleanup-lambda.module';
import { ArchiveCleanupService } from './modules/archive-cleanup/archive-cleanup.service';

interface CleanupLambdaResult {
  deletedProjects: number;
  deletedModules: number;
}

const logger = new Logger('ArchiveCleanupLambda');

export async function handler(): Promise<CleanupLambdaResult> {
  const app = await NestFactory.createApplicationContext(CleanupLambdaModule);

  try {
    const cleanup = app.get(ArchiveCleanupService);
    const result = await cleanup.handleCleanup();

    const summary = {
      deletedProjects: result.deletedProjects.length,
      deletedModules: result.deletedModules.length,
    };

    logger.log(
      `Cleanup completed: ${summary.deletedProjects} project(s), ` +
        `${summary.deletedModules} module(s) permanently deleted`,
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
