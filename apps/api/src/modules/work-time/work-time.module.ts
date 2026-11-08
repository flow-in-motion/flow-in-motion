import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { WorkTimeController } from './work-time.controller';
import { WorkTimeRepository } from './work-time.repository';
import { WorkTimeService } from './work-time.service';
@Module({
  imports: [UsersModule],
  controllers: [WorkTimeController],
  providers: [WorkTimeRepository, WorkTimeService],
})
export class WorkTimeModule {}
