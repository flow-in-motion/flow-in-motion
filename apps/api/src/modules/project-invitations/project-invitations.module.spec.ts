import { join } from 'path';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { ProjectInvitationsModule } from './project-invitations.module';
import { TaskInvitationsModule } from '../task-invitations/task-invitations.module';
import { NoteInvitationsModule } from '../note-invitations/note-invitations.module';
import { envValidationSchema } from '../../config/env.validation';
import { DbModule } from '../../db/db.module';

// Regression check: this whole module graph (including the newly-added
// TaskInvitationsModule/NoteInvitationsModule) must actually resolve its
// dependency injection wiring without a live DB connection — .compile()
// never runs onModuleInit(), so this only exercises DI resolution, not I/O.
describe('ProjectInvitationsModule (compile check)', () => {
  it('resolves its full DI graph, including task and note invitations', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: [join(__dirname, '..', '..', '..', '..', '..', '.env')],
          validationSchema: envValidationSchema,
        }),
        DbModule,
        ProjectInvitationsModule,
        TaskInvitationsModule,
        NoteInvitationsModule,
      ],
    }).compile();

    expect(moduleRef).toBeDefined();
  });
});
