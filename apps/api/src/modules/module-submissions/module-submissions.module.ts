import { Module } from '@nestjs/common';
import { MembershipsModule } from '../memberships/memberships.module';
import { EnumModule } from '../enum/enum.module';
import { UsersModule } from '../users/users.module';
import { ModuleSubmissionsController } from './controllers/module-submissions.controller';
import { ModuleSubmissionsRepository } from './repositories/module-submissions.repository';
import { ModuleSubmissionsService } from './services/module-submissions.service';

@Module({
  imports: [UsersModule, MembershipsModule, EnumModule],
  controllers: [ModuleSubmissionsController],
  providers: [ModuleSubmissionsService, ModuleSubmissionsRepository],
  exports: [ModuleSubmissionsService, ModuleSubmissionsRepository],
})
export class ModuleSubmissionsModule {}
