import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';

import { envValidationSchema } from './config/env.validation';
import { ArchiveCleanupModule } from './modules/archive-cleanup/archive-cleanup.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(__dirname, '..', '..', '..', '.env')],
      validationSchema: envValidationSchema,
    }),
    ArchiveCleanupModule,
  ],
})
export class CleanupLambdaModule {}
