import { AnalyticsService } from './analytics.service';
import { AnalyticsRepository } from '../repositories/analytics.repository';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let repository: {
    create: jest.Mock;
    researchInsights: jest.Mock;
  };

  beforeEach(() => {
    repository = {
      create: jest.fn().mockResolvedValue({ id: 'event-1' }),
      researchInsights: jest.fn().mockResolvedValue({
        headlines: {},
        stageMovements: [],
        pipelineNow: [],
        submissions: {},
        currentlyWith: [],
        work: {},
        team: {},
      }),
    };

    service = new AnalyticsService(
      repository as unknown as AnalyticsRepository,
    );
  });

  describe('recordEvent', () => {
    it('returns transition counts separately from distinct papers moved', async () => {
      repository.researchInsights.mockResolvedValue({
        headlines: {
          papersMoved: { current: 1, previous: 1 },
          stageChanges: { current: 3, previous: 2 },
        },
        stageChangesByStage: [
          { stage: 'Literature Review', changes: 1 },
          { stage: 'Drafting', changes: 2 },
          { stage: 'Published', changes: 0 },
        ],
      });

      const result = await service.summary('tenant-1', 30);

      expect(result.headlines.papersMoved.current).toBe(1);
      expect(result.headlines.stageChanges).toEqual({
        current: 3,
        previous: 2,
      });
      expect(result.stageChangesByStage).toEqual([
        { stage: 'Literature Review', changes: 1 },
        { stage: 'Drafting', changes: 2 },
        { stage: 'Published', changes: 0 },
      ]);
    });

    it('stores the event under the caller and tenant', async () => {
      await service.recordEvent('tenant-1', 'user-1', {
        name: 'project_created',
        path: '/projects',
        sessionId: '3d6f0a27-8900-49dc-8d0a-b87ec6b23583',
        pageKey: 'projects',
        properties: { projectId: 'p1' },
      });

      expect(repository.create).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        userId: 'user-1',
        name: 'project_created',
        path: '/projects',
        sessionId: '3d6f0a27-8900-49dc-8d0a-b87ec6b23583',
        pageKey: 'projects',
        featureKey: undefined,
        properties: { projectId: 'p1' },
      });
    });
  });

  describe('summary', () => {
    it('defaults to a 30-day window', async () => {
      await service.summary('tenant-1');

      const [, since] = repository.researchInsights.mock.calls[0] as [
        string,
        Date,
      ];
      const expected = new Date();
      expected.setDate(expected.getDate() - 30);
      expect(since.toDateString()).toBe(expected.toDateString());
    });

    it('clamps an excessive window to 90 days', async () => {
      await service.summary('tenant-1', 365);

      const [, since] = repository.researchInsights.mock.calls[0] as [
        string,
        Date,
      ];
      const expected = new Date();
      expected.setDate(expected.getDate() - 90);
      expect(since.toDateString()).toBe(expected.toDateString());
    });

    it('returns the research insights with the clamped window', async () => {
      repository.researchInsights.mockResolvedValue({
        headlines: { activeMembers: { current: 4, previous: 2 } },
      });

      const result = await service.summary('tenant-1', 7);

      expect(result.windowDays).toBe(7);
      expect(result.headlines.activeMembers.current).toBe(4);
      expect(repository.researchInsights).toHaveBeenCalledTimes(1);
    });
  });
});
