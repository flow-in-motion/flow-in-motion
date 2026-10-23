import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { DataExportController } from './data-export.controller';
import { DataExportRepository } from './data-export.repository';
import { DataExportService } from './data-export.service';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [DataExportController],
  providers: [DataExportRepository, DataExportService],
})
export class DataExportModule {}
