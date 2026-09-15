// apps/api/src/modules/project-invitations/project-invitations.module.ts
import { Module } from '@nestjs/common';
import { EnumModule } from '../enum/enum.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { ModuleInvitationsModule } from '../module-invitations/module-invitations.module';
import { TaskInvitationsModule } from '../task-invitations/task-invitations.module';
import { NoteInvitationsModule } from '../note-invitations/note-invitations.module';
import { ProjectCollaboratorsModule } from '../project-collaborators/project-collaborators.module';
import { ProjectsModule } from '../projects/project.module';
import { UsersModule } from '../users/users.module';
import { InvitationAcceptanceController } from './controllers/invitation-acceptance.controller';
import { ProjectInvitationsController } from './controllers/project-invitations.controller';
import { ProjectInvitationsRepository } from './repositories/project-invitations.repository';
import { ProjectInvitationsService } from './services/project-invitations.service';
import { MyInvitationsController } from './controllers/my-invitations.controller';

@Module({
  imports: [
    EnumModule,
    MembershipsModule,
    UsersModule,
    ProjectsModule,
    ProjectCollaboratorsModule,
    ModuleInvitationsModule,
    TaskInvitationsModule,
    NoteInvitationsModule,
  ],
  controllers: [
    ProjectInvitationsController,
    InvitationAcceptanceController,
    MyInvitationsController,
  ],
  providers: [ProjectInvitationsService, ProjectInvitationsRepository],
  exports: [ProjectInvitationsService],
})
export class ProjectInvitationsModule {}
