import { FeedbackService } from './feedback.service';
import { FeedbackRepository } from '../repositories/feedback.repository';
import { FeedbackEmailService } from './feedback-email.service';

describe('FeedbackService', () => {
  let service: FeedbackService;

  let repository: {
    findPageByUser: jest.Mock;
    create: jest.Mock;
  };

  let feedbackEmailService: {
    sendFeedbackNotification: jest.Mock;
  };

  beforeEach(() => {
    repository = {
      findPageByUser: jest.fn(),
      create: jest.fn(),
    };

    feedbackEmailService = {
      sendFeedbackNotification: jest.fn().mockResolvedValue('message-1'),
    };

    service = new FeedbackService(
      repository as unknown as FeedbackRepository,
      feedbackEmailService as unknown as FeedbackEmailService,
    );
  });

  describe('list', () => {
    it('returns a paginated list of feedback submitted by the caller', async () => {
      const feedback = [
        {
          id: 'feedback-1',
          tenantId: 'tenant-1',
          userId: 'user-1',
          message: 'Helpful application',
          rating: 5,
        },
      ];

      repository.findPageByUser.mockResolvedValue({
        data: feedback,
        totalItems: 45,
      });

      const result = await service.list('tenant-1', 'user-1', 2, 20);

      expect(repository.findPageByUser).toHaveBeenCalledWith(
        'tenant-1',
        'user-1',
        20,
        20,
      );

      expect(result).toEqual({
        data: feedback,
        meta: {
          page: 2,
          pageSize: 20,
          totalItems: 45,
          totalPages: 3,
        },
      });
    });
  });
  describe('create', () => {
    it('stores feedback before sending its email notification', async () => {
      const createdAt = new Date('2026-09-14T00:00:00.000Z');

      const feedback = {
        id: 'feedback-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        message: 'The dashboard is very useful.',
        rating: 5,
        createdAt,
        updatedAt: createdAt,
      };

      repository.create.mockResolvedValue(feedback);

      const result = await service.create('tenant-1', 'user-1', {
        message: '  The dashboard is very useful.  ',
        rating: 5,
      });

      expect(repository.create).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        userId: 'user-1',
        message: 'The dashboard is very useful.',
        rating: 5,
      });

      expect(
        feedbackEmailService.sendFeedbackNotification,
      ).toHaveBeenCalledWith({
        feedbackId: 'feedback-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        message: 'The dashboard is very useful.',
        rating: 5,
        submittedAt: createdAt,
      });

      expect(result).toBe(feedback);
    });
  });
});
