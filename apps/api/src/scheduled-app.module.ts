import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { AppModule } from './app.module';
import { ArchiveCleanupModule } from './modules/archive-cleanup/archive-cleanup.module';

@Module({
  imports: [AppModule, ScheduleModule.forRoot(), ArchiveCleanupModule],
})
export class ScheduledAppModule {}
