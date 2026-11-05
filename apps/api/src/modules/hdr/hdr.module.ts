import { Module } from '@nestjs/common';
import { MembershipsModule } from '../memberships/memberships.module';
import { UsersModule } from '../users/users.module';
import { HdrController } from './hdr.controller';
import { HdrRepository } from './hdr.repository';
import { HdrService } from './hdr.service';

@Module({
  imports: [UsersModule, MembershipsModule],
  controllers: [HdrController],
  providers: [HdrService, HdrRepository],
})
export class HdrModule {}
