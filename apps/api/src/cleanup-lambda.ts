import { NestFactory } from '@nestjs/core';

import { CleanupLambdaModule } from './cleanup-lambda.module';
import { type CleanupResult, runCleanup } from './cleanup-runner';

export async function handler(): Promise<CleanupResult> {
  const app = await NestFactory.createApplicationContext(CleanupLambdaModule);
  return runCleanup(app);
}
