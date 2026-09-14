import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';

export const FEEDBACK_SES_CLIENT = Symbol('FEEDBACK_SES_CLIENT');

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

@Injectable()
export class FeedbackEmailService {
  private readonly logger = new Logger(FeedbackEmailService.name);

  constructor(
    @Inject(FEEDBACK_SES_CLIENT)
    private readonly ses: SESv2Client,
    private readonly configService: ConfigService,
  ) {}

  async sendFeedbackNotification(input: {
    feedbackId: string;
    tenantId: string;
    userId: string;
    message: string;
    rating?: number | null;
    submittedAt: Date;
  }) {
    const recipient = this.configService.get<string>('FEEDBACK_EMAIL_TO');
    const fromAddress = this.configService.get<string>('INVITATION_EMAIL_FROM');

    if (!recipient || !fromAddress) {
      this.logger.warn(
        'Feedback email notification skipped because email delivery is not configured',
      );
      return undefined;
    }

    const ratingLabel =
      input.rating === null || input.rating === undefined
        ? 'Not provided'
        : `${input.rating}/5`;

    const subject =
      input.rating === null || input.rating === undefined
        ? 'New Research Tracker feedback'
        : `New Research Tracker feedback (${input.rating}/5)`;

    const text = [
      'New feedback has been submitted.',
      '',
      `Rating: ${ratingLabel}`,
      `Feedback ID: ${input.feedbackId}`,
      `Tenant ID: ${input.tenantId}`,
      `User ID: ${input.userId}`,
      `Submitted: ${input.submittedAt.toISOString()}`,
      '',
      'Message:',
      input.message,
    ].join('\n');

    const html = `
      <h1>New Research Tracker feedback</h1>
      <p><strong>Rating:</strong> ${escapeHtml(ratingLabel)}</p>
      <p><strong>Feedback ID:</strong> ${escapeHtml(input.feedbackId)}</p>
      <p><strong>Tenant ID:</strong> ${escapeHtml(input.tenantId)}</p>
      <p><strong>User ID:</strong> ${escapeHtml(input.userId)}</p>
      <p><strong>Submitted:</strong> ${escapeHtml(input.submittedAt.toISOString())}</p>
      <h2>Message</h2>
      <p>${escapeHtml(input.message).replaceAll('\n', '<br />')}</p>
    `;

    try {
      const result = await this.ses.send(
        new SendEmailCommand({
          FromEmailAddress: fromAddress,
          Destination: {
            ToAddresses: [recipient],
          },
          Content: {
            Simple: {
              Subject: {
                Data: subject,
                Charset: 'UTF-8',
              },
              Body: {
                Text: {
                  Data: text,
                  Charset: 'UTF-8',
                },
                Html: {
                  Data: html,
                  Charset: 'UTF-8',
                },
              },
            },
          },
        }),
      );

      return result.MessageId;
    } catch (error) {
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown SES error';

      this.logger.error(
        `SES feedback notification failed (${errorName}): ${errorMessage}`,
      );

      // Feedback is already persisted. Email is a best-effort notification
      // and must not make the user's submission fail.
      return undefined;
    }
  }
}
