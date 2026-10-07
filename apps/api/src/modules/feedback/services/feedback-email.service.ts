import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';

export const FEEDBACK_SES_CLIENT = Symbol('FEEDBACK_SES_CLIENT');

const SCREENSHOT_CONTENT_ID = 'feedback-screenshot';

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// Wrap base64 payloads at the standard MIME line length so strict parsers
// (and some spam filters) don't choke on one very long line.
function wrapBase64(data: string, lineLength = 76) {
  const lines: string[] = [];
  for (let i = 0; i < data.length; i += lineLength) {
    lines.push(data.slice(i, i + lineLength));
  }
  return lines.join('\r\n');
}

function parseScreenshotDataUrl(screenshotDataUrl: string) {
  const match = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]+=*)$/.exec(
    screenshotDataUrl,
  );

  const contentType = match?.[1];
  const base64Data = match?.[2];

  if (!contentType || !base64Data) {
    return undefined;
  }

  return { contentType, base64Data };
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
    screenshotDataUrl?: string | null;
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

    const screenshot = input.screenshotDataUrl
      ? parseScreenshotDataUrl(input.screenshotDataUrl)
      : undefined;

    if (input.screenshotDataUrl && !screenshot) {
      this.logger.warn(
        'Feedback screenshot was present but not a recognizable base64 image data URL; sending notification without it',
      );
    }

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
      ...(screenshot ? ['', 'A screenshot was attached to this feedback.'] : []),
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
      ${screenshot ? `<h2>Screenshot</h2><p><img src="cid:${SCREENSHOT_CONTENT_ID}" alt="Feedback screenshot" style="max-width:100%;border:1px solid #ddd;" /></p>` : ''}
    `;

    try {
      const command = screenshot
        ? new SendEmailCommand({
            FromEmailAddress: fromAddress,
            Destination: {
              ToAddresses: [recipient],
            },
            Content: {
              Raw: {
                Data: this.buildRawMessageWithInlineImage({
                  from: fromAddress,
                  to: recipient,
                  subject,
                  text,
                  html,
                  contentType: screenshot.contentType,
                  base64Data: screenshot.base64Data,
                }),
              },
            },
          })
        : new SendEmailCommand({
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
          });

      const result = await this.ses.send(command);

      this.logger.log(
        `Feedback email notification sent to SES (messageId=${result.MessageId}, screenshot=${Boolean(screenshot)})`,
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

  // Gmail (the primary recipient for this feature) does not render base64
  // `data:` image URIs embedded directly in HTML, so a screenshot has to go
  // out as a real inline MIME attachment referenced via Content-ID instead
  // of SES's "Simple" content, which only supports Subject/Text/Html.
  private buildRawMessageWithInlineImage(input: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
    contentType: string;
    base64Data: string;
  }) {
    const relatedBoundary = `related-${randomUUID()}`;
    const altBoundary = `alt-${randomUUID()}`;
    const extension = input.contentType === 'image/png' ? 'png' : 'jpg';

    const message = [
      `From: ${input.from}`,
      `To: ${input.to}`,
      `Subject: ${input.subject}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/related; boundary="${relatedBoundary}"`,
      '',
      `--${relatedBoundary}`,
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      '',
      `--${altBoundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      input.text,
      '',
      `--${altBoundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      input.html,
      '',
      `--${altBoundary}--`,
      '',
      `--${relatedBoundary}`,
      `Content-Type: ${input.contentType}`,
      'Content-Transfer-Encoding: base64',
      `Content-ID: <${SCREENSHOT_CONTENT_ID}>`,
      `Content-Disposition: inline; filename="feedback-screenshot.${extension}"`,
      '',
      wrapBase64(input.base64Data),
      '',
      `--${relatedBoundary}--`,
      '',
    ].join('\r\n');

    return Buffer.from(message, 'utf-8');
  }
}
