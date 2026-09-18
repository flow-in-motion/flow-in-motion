// apps/api/src/modules/archive-cleanup/archive-cleanup.module.ts
import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { ArchiveCleanupService } from './archive-cleanup.service';
@Module({
  imports: [DbModule],
  providers: [ArchiveCleanupService],
  exports: [ArchiveCleanupService],
})
export class ArchiveCleanupModule {}
