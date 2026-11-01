// apps/api/src/modules/project-modules/project-modules.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { EnumModule } from '../enum/enum.module';
import { ModuleCollaboratorsModule } from '../module-collaborators/module-collaborators.module';
import { ProjectCollaboratorsModule } from '../project-collaborators/project-collaborators.module';
import { TenantSequencesModule } from '../tenant-sequences/tenant-sequences.module';
import { UsersModule } from '../users/users.module';
import { MyModulesController } from './controllers/my-modules.controller';
import { ProjectModulesController } from './controllers/project-modules.controller';
import { ModuleAccessGuard } from './policies/module-access.guard';
import { ProjectModulesRepository } from './repositories/project-modules.repository';
import { ProjectModulesService } from './services/project-modules.service';
import { MembershipsModule } from '../memberships/memberships.module';
import { ProjectsModule } from '../projects/project.module';

@Module({
  imports: [
    UsersModule,
    EnumModule,
    forwardRef(() => ModuleCollaboratorsModule),
    ProjectCollaboratorsModule,
    ProjectsModule,
    TenantSequencesModule,
    MembershipsModule,
  ],
  controllers: [ProjectModulesController, MyModulesController],
  providers: [
    ProjectModulesService,
    ProjectModulesRepository,
    ModuleAccessGuard,
  ],
  exports: [ProjectModulesRepository],
})
export class ProjectModulesModule {}
