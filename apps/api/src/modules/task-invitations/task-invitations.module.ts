// apps/api/src/modules/task-invitations/task-invitations.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { MembershipsModule } from '../memberships/memberships.module';
import { TaskMembersModule } from '../task-members/task-members.module';
import { TasksModule } from '../tasks/tasks.module';
import { UsersModule } from '../users/users.module';
import { TaskInvitationsController } from './controllers/task-invitations.controller';
import { TaskInvitationsRepository } from './repositories/task-invitations.repository';
import { TaskInvitationsService } from './services/task-invitations.service';

@Module({
  imports: [
    MembershipsModule,
    UsersModule,
    forwardRef(() => TasksModule),
    forwardRef(() => TaskMembersModule),
  ],
  controllers: [TaskInvitationsController],
  providers: [TaskInvitationsService, TaskInvitationsRepository],
  exports: [TaskInvitationsService],
})
export class TaskInvitationsModule {}
