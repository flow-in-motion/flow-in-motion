import { Module } from '@nestjs/common';
import { MembershipsModule } from '../memberships/memberships.module';
import { UsersModule } from '../users/users.module';
import { FundingsController } from './controllers/fundings.controller';
import { FundingsRepository } from './repositories/fundings.repository';
import { FundingsService } from './services/fundings.service';

@Module({
  imports: [UsersModule, MembershipsModule],
  controllers: [FundingsController],
  providers: [FundingsService, FundingsRepository],
  exports: [FundingsService],
})
export class FundingsModule {}
