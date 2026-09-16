import { SESv2Client } from '@aws-sdk/client-sesv2';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MembershipsModule } from '../memberships/memberships.module';
import { UsersModule } from '../users/users.module';
import { FeedbackController } from './controllers/feedback.controller';
import { FeedbackRepository } from './repositories/feedback.repository';
import {
  FEEDBACK_SES_CLIENT,
  FeedbackEmailService,
} from './services/feedback-email.service';
import { FeedbackService } from './services/feedback.service';

@Module({
  imports: [UsersModule, MembershipsModule],
  controllers: [FeedbackController],
  providers: [
    FeedbackService,
    FeedbackRepository,
    FeedbackEmailService,
    {
      provide: FEEDBACK_SES_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        new SESv2Client({
          region:
            configService.get<string>('INVITATION_EMAIL_REGION') ??
            configService.get<string>('AWS_REGION', 'ap-southeast-2'),
        }),
    },
  ],
  exports: [FeedbackService, FeedbackRepository],
})
export class FeedbackModule {}
