import { NestFactory } from '@nestjs/core';

import { loadDatabaseSecretEnvironment } from './config/load-database-secret';
import { type CleanupResult, runCleanup } from './cleanup-runner';

export async function handler(): Promise<CleanupResult> {
  await loadDatabaseSecretEnvironment();

  const { CleanupLambdaModule } = await import('./cleanup-lambda.module');
  const app = await NestFactory.createApplicationContext(CleanupLambdaModule);

  return runCleanup(app);
}
