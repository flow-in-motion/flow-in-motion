import { Module, forwardRef } from '@nestjs/common';
import { EnumModule } from '../enum/enum.module';
import { ProjectModulesModule } from '../project-modules/project-modules.module';
import { TaskMembersModule } from '../task-members/task-members.module';
import { UsersModule } from '../users/users.module';
import { MyTasksController } from './controllers/my-tasks.controller';
import { TasksController } from './controllers/tasks.controller';
import { TasksRepository } from './repositories/tasks.repository';
import { TasksService } from './services/tasks.service';
import { TenantSequencesModule } from '../tenant-sequences/tenant-sequences.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { ProjectsModule } from '../projects/project.module';

@Module({
  imports: [
    UsersModule,
    EnumModule,
    TenantSequencesModule,
    forwardRef(() => TaskMembersModule),
    ProjectModulesModule,
    ProjectsModule,
    MembershipsModule,
  ],
  controllers: [TasksController, MyTasksController],
  providers: [TasksService, TasksRepository],
  exports: [TasksRepository],
})
export class TasksModule {}
