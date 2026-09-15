import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { WorkspacesController } from './controllers/workspaces.controller';
import { WorkspacesRepository } from './repositories/workspaces.repository';
import { WorkspacesService } from './services/workspaces.service';
import { ProjectsModule } from '../projects/project.module';

@Module({
  imports: [UsersModule, ProjectsModule],
  controllers: [WorkspacesController],
  providers: [WorkspacesService, WorkspacesRepository],
  exports: [WorkspacesService, WorkspacesRepository],
})
export class WorkspacesModule {}
