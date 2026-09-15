// apps/api/src/modules/module-invitations/module-invitations.module.ts
import { Module } from '@nestjs/common';
import { EnumModule } from '../enum/enum.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { ModuleCollaboratorsModule } from '../module-collaborators/module-collaborators.module';
import { ProjectModulesModule } from '../project-modules/project-modules.module';
import { UsersModule } from '../users/users.module';
import { ModuleInvitationsController } from './controllers/module-invitations.controller';
import { ModuleInvitationsRepository } from './repositories/module-invitations.repository';
import { ModuleInvitationsService } from './services/module-invitations.service';

@Module({
  imports: [
    EnumModule,
    MembershipsModule,
    UsersModule,
    ProjectModulesModule,
    ModuleCollaboratorsModule,
  ],
  controllers: [ModuleInvitationsController],
  providers: [ModuleInvitationsService, ModuleInvitationsRepository],
  exports: [ModuleInvitationsService],
})
export class ModuleInvitationsModule {}
