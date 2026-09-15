// apps/api/src/modules/note-invitations/note-invitations.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { MembershipsModule } from '../memberships/memberships.module';
import { NoteMembersModule } from '../note-members/note-members.module';
import { NotesModule } from '../notes/notes.module';
import { UsersModule } from '../users/users.module';
import { NoteInvitationsController } from './controllers/note-invitations.controller';
import { NoteInvitationsRepository } from './repositories/note-invitations.repository';
import { NoteInvitationsService } from './services/note-invitations.service';

@Module({
  imports: [
    MembershipsModule,
    UsersModule,
    forwardRef(() => NotesModule),
    forwardRef(() => NoteMembersModule),
  ],
  controllers: [NoteInvitationsController],
  providers: [NoteInvitationsService, NoteInvitationsRepository],
  exports: [NoteInvitationsService],
})
export class NoteInvitationsModule {}
