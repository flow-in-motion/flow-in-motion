import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { ProjectInvitationsModule } from './project-invitations.module';
import { TaskInvitationsModule } from '../task-invitations/task-invitations.module';
import { NoteInvitationsModule } from '../note-invitations/note-invitations.module';
import { DbModule } from '../../db/db.module';

// Dummy values standing in for envValidationSchema's required fields, fed
// straight in via `validate` so this doesn't depend on a real .env file
// (there isn't one in CI). DbModule's DrizzleService only builds its
// connection pool in onModuleInit(), which .compile() never calls, so none
// of this needs to resolve to real infra.
const testEnv = {
  APP_URL: 'http://localhost:3000',
  POSTGRES_HOST: 'localhost',
  POSTGRES_DB: 'test',
  POSTGRES_MIGRATION_USER: 'test',
  POSTGRES_MIGRATION_PASSWORD: 'test',
  POSTGRES_RUNTIME_USER: 'test',
  POSTGRES_RUNTIME_PASSWORD: 'test',
  MINIO_ENDPOINT: 'http://localhost:9000',
  COGNITO_REGION: 'us-east-1',
  COGNITO_USER_POOL_ID: 'test-pool',
  COGNITO_CLIENT_ID: 'test-client',
  COGNITO_DOMAIN: 'example.com',
};

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
          ignoreEnvFile: true,
          validate: () => testEnv,
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
