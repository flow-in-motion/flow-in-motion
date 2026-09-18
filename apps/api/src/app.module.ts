import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { envValidationSchema } from './config/env.validation';
import { DbModule } from './db/db.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { UsersModule } from './modules/users/users.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { EnumModule } from './modules/enum/enum.module';
import { ProjectsModule } from './modules/projects/project.module';
import { ProjectModulesModule } from './modules/project-modules/project-modules.module';
import { NotesModule } from './modules/notes/notes.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { ProjectCollaboratorsModule } from './modules/project-collaborators/project-collaborators.module';
import { ModuleCollaboratorsModule } from './modules/module-collaborators/module-collaborators.module';
import { TaskMembersModule } from './modules/task-members/task-members.module';
import { NoteMembersModule } from './modules/note-members/note-members.module';
import { ModulePipelineStagesPoolModule } from './modules/module-pipeline-stages-pool/module-pipeline-stages-pool.module';
import { ProjectInvitationsModule } from './modules/project-invitations/project-invitations.module';
import { ConferencesModule } from './modules/conferences/conferences.module';
import { CalendarEventsModule } from './modules/calendar-events/calendar-events.module';
import { ModuleSubmissionsModule } from './modules/module-submissions/module-submissions.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { PreferencesModule } from './modules/preferences/preferences.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RequestContextInterceptor } from './db/request-context.interceptor';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(__dirname, '..', '..', '..', '.env')],
      validationSchema: envValidationSchema,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        pinoHttp: {
          level: configService.get<string>('LOG_LEVEL', 'info'),
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.body.password',
              'req.body.confirmPassword',
              'req.body.accessToken',
              'req.body.refreshToken',
              'req.body.apiKey',
              'req.body.secret',
              'res.headers["set-cookie"]',
            ],
            censor: '[Redacted]',
          },
          serializers: {
            req(req: { method?: string; url?: string; id?: string }) {
              return {
                id: req.id,
                method: req.method,
                url: req.url,
              };
            },
          },
        },
      }),
    }),
    DbModule,
    AuthModule,
    UsersModule,
    MembershipsModule,
    HealthModule,
    WorkspacesModule,
    EnumModule,
    ProjectsModule,
    ProjectModulesModule,
    NotesModule,
    TasksModule,
    ProjectCollaboratorsModule,
    ModuleCollaboratorsModule,
    TaskMembersModule,
    NoteMembersModule,
    ModulePipelineStagesPoolModule,
    ProjectInvitationsModule,
    ConferencesModule,
    CalendarEventsModule,
    ModuleSubmissionsModule,
    FeedbackModule,
    PreferencesModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestContextInterceptor,
    },
  ],
})
export class AppModule {}
