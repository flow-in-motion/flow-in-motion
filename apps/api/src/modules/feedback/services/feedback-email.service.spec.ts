import { ConfigService } from '@nestjs/config';
import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { FeedbackEmailService } from './feedback-email.service';

describe('FeedbackEmailService', () => {
  let service: FeedbackEmailService;
  let ses: { send: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(() => {
    ses = {
      send: jest.fn().mockResolvedValue({
        MessageId: 'message-1',
      }),
    };

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'FEEDBACK_EMAIL_TO') {
          return 'feedback@example.com';
        }

        if (key === 'INVITATION_EMAIL_FROM') {
          return 'verified-sender@example.com';
        }

        return undefined;
      }),
    };

    service = new FeedbackEmailService(
      ses as unknown as SESv2Client,
      configService as unknown as ConfigService,
    );
  });

  it('sends feedback to the configured recipient', async () => {
    const result = await service.sendFeedbackNotification({
      feedbackId: 'feedback-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
      message: 'The dashboard is very useful.',
      rating: 5,
      submittedAt: new Date('2026-09-14T00:00:00.000Z'),
    });

    expect(result).toBe('message-1');
    expect(ses.send).toHaveBeenCalledTimes(1);

    const command = ses.send.mock.calls[0][0] as SendEmailCommand;

    expect(command.input.FromEmailAddress).toBe('verified-sender@example.com');
    expect(command.input.Destination?.ToAddresses).toEqual([
      'feedback@example.com',
    ]);
    expect(command.input.Content?.Simple?.Subject?.Data).toContain('5/5');
  });

  it('skips delivery when the recipient is not configured', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'INVITATION_EMAIL_FROM') {
        return 'verified-sender@example.com';
      }

      return undefined;
    });

    await expect(
      service.sendFeedbackNotification({
        feedbackId: 'feedback-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        message: 'Test feedback',
        rating: undefined,
        submittedAt: new Date(),
      }),
    ).resolves.toBeUndefined();

    expect(ses.send).not.toHaveBeenCalled();
  });

  it('does not reject the submission when SES fails', async () => {
    ses.send.mockRejectedValueOnce(new Error('SES unavailable'));

    await expect(
      service.sendFeedbackNotification({
        feedbackId: 'feedback-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        message: 'Test feedback',
        rating: 4,
        submittedAt: new Date(),
      }),
    ).resolves.toBeUndefined();
  });
});

describe('FeedbackEmailService screenshot handling', () => {
  it('sends a raw MIME message with the screenshot inlined via Content-ID when a screenshot is present', async () => {
    const ses = {
      send: jest.fn().mockResolvedValue({ MessageId: 'message-2' }),
    };
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'FEEDBACK_EMAIL_TO') return 'feedback@example.com';
        if (key === 'INVITATION_EMAIL_FROM') return 'verified-sender@example.com';
        return undefined;
      }),
    };

    const service = new FeedbackEmailService(
      ses as unknown as SESv2Client,
      configService as unknown as ConfigService,
    );

    const tinyPngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

    const result = await service.sendFeedbackNotification({
      feedbackId: 'feedback-2',
      tenantId: 'tenant-1',
      userId: 'user-1',
      message: 'Found a layout bug.',
      rating: 3,
      screenshotDataUrl: `data:image/png;base64,${tinyPngBase64}`,
      submittedAt: new Date('2026-09-14T00:00:00.000Z'),
    });

    expect(result).toBe('message-2');
    expect(ses.send).toHaveBeenCalledTimes(1);

    const command = ses.send.mock.calls[0][0] as SendEmailCommand;

    expect(command.input.Content?.Simple).toBeUndefined();
    const rawData = command.input.Content?.Raw?.Data as Buffer;
    const raw = Buffer.from(rawData).toString('utf-8');

    expect(raw).toContain('Content-Type: multipart/related');
    expect(raw).toContain('Content-ID: <feedback-screenshot>');
    expect(raw).toContain('cid:feedback-screenshot');
    // The base64 payload is wrapped at 76 chars per line (MIME convention),
    // so compare with line breaks stripped rather than as one long substring.
    expect(raw.replace(/\r\n/g, '')).toContain(tinyPngBase64);
  });

  it('falls back to the Simple content path when the screenshot is not a recognizable data URL', async () => {
    const ses = {
      send: jest.fn().mockResolvedValue({ MessageId: 'message-3' }),
    };
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'FEEDBACK_EMAIL_TO') return 'feedback@example.com';
        if (key === 'INVITATION_EMAIL_FROM') return 'verified-sender@example.com';
        return undefined;
      }),
    };

    const service = new FeedbackEmailService(
      ses as unknown as SESv2Client,
      configService as unknown as ConfigService,
    );

    await service.sendFeedbackNotification({
      feedbackId: 'feedback-3',
      tenantId: 'tenant-1',
      userId: 'user-1',
      message: 'Not an image.',
      screenshotDataUrl: 'not-a-data-url',
      submittedAt: new Date(),
    });

    const command = ses.send.mock.calls[0][0] as SendEmailCommand;
    expect(command.input.Content?.Raw).toBeUndefined();
    expect(command.input.Content?.Simple).toBeDefined();
  });
});
