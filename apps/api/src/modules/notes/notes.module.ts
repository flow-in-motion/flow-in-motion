import { Module, forwardRef } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { MyNotesController } from './controllers/my-notes.controller';
import { NotesController } from './controllers/notes.controller';
import { NotesRepository } from './repositories/notes.repository';
import { NotesService } from './services/notes.service';
import { TenantSequencesModule } from '../tenant-sequences/tenant-sequences.module';
import { NoteMembersModule } from '../note-members/note-members.module';
import { EnumModule } from '../enum/enum.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { ProjectModulesModule } from '../project-modules/project-modules.module';
import { ProjectsModule } from '../projects/project.module';
@Module({
  imports: [
    UsersModule,
    TenantSequencesModule,
    forwardRef(() => NoteMembersModule),
    EnumModule,
    ProjectModulesModule,
    ProjectsModule,
    MembershipsModule,
  ],
  controllers: [NotesController, MyNotesController],
  providers: [NotesService, NotesRepository],
  exports: [NotesRepository],
})
export class NotesModule {}
