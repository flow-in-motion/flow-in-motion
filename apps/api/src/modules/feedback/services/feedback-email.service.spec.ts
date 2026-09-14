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
