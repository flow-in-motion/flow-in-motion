import { BadRequestException } from '@nestjs/common';
import { PreferencesRepository } from '../preferences/preferences.repository';
import { DueRemindersRepository } from './due-reminders.repository';
import {
  DueRemindersService,
  addDays,
  daysBetween,
} from './due-reminders.service';
import type { ReminderCandidate } from './due-reminders.types';

const TODAY = '2026-10-28';

function candidate(
  overrides: Partial<ReminderCandidate> & Pick<ReminderCandidate, 'dueDate'>,
): ReminderCandidate {
  return {
    type: 'task',
    itemId: `id-${overrides.title ?? overrides.dueDate}`,
    targetId: 'target',
    title: 'Task',
    context: null,
    ...overrides,
  };
}

describe('DueRemindersService', () => {
  let repository: Record<
    | 'findTasks'
    | 'findPapers'
    | 'findProjects'
    | 'findEventDeadlines'
    | 'findSubmissionDeadlines'
    | 'findFundingDeadlines'
    | 'findFundingFollowUps'
    | 'findNoteFollowUps'
    | 'findStates'
    | 'markSeen'
    | 'dismiss',
    jest.Mock
  >;
  let preferences: { findAccount: jest.Mock };
  let service: DueRemindersService;

  beforeEach(() => {
    repository = {
      findTasks: jest.fn().mockResolvedValue([]),
      findPapers: jest.fn().mockResolvedValue([]),
      findProjects: jest.fn().mockResolvedValue([]),
      findEventDeadlines: jest.fn().mockResolvedValue([]),
      findSubmissionDeadlines: jest.fn().mockResolvedValue([]),
      findFundingDeadlines: jest.fn().mockResolvedValue([]),
      findFundingFollowUps: jest.fn().mockResolvedValue([]),
      findNoteFollowUps: jest.fn().mockResolvedValue([]),
      findStates: jest.fn().mockResolvedValue([]),
      markSeen: jest.fn(),
      dismiss: jest.fn(),
    };
    preferences = { findAccount: jest.fn().mockResolvedValue(undefined) };
    service = new DueRemindersService(
      repository as unknown as DueRemindersRepository,
      preferences as unknown as PreferencesRepository,
    );
  });

  it('counts days between dates', () => {
    expect(addDays(TODAY, 7)).toBe('2026-11-04');
    expect(addDays(TODAY, -14)).toBe('2026-10-14');
    expect(daysBetween(TODAY, '2026-11-02')).toBe(5);
    expect(daysBetween(TODAY, '2026-10-25')).toBe(-3);
  });

  it('looks a week ahead by default, and back for overdue items', async () => {
    await service.list('tenant-1', 'user-1', TODAY);

    expect(repository.findTasks).toHaveBeenCalledWith('tenant-1', {
      from: null,
      to: '2026-11-04',
    });
    // A passed event deadline can't be acted on, so no overdue look-back.
    expect(repository.findEventDeadlines).toHaveBeenCalledWith('tenant-1', {
      from: TODAY,
      to: '2026-11-04',
    });
    // Follow-ups are shown for two weeks after the date.
    expect(repository.findNoteFollowUps).toHaveBeenCalledWith('tenant-1', {
      from: '2026-10-14',
      to: '2026-11-04',
    });
  });

  it('gives each item the stage it has reached, most urgent first', async () => {
    repository.findTasks.mockResolvedValue([
      candidate({ title: 'In five days', dueDate: '2026-11-02' }),
      candidate({ title: 'Today', dueDate: TODAY }),
      candidate({ title: 'Overdue', dueDate: '2026-10-25' }),
      candidate({ title: 'Tomorrow', dueDate: '2026-10-29' }),
    ]);

    const { items, unreadCount } = await service.list(
      'tenant-1',
      'user-1',
      TODAY,
    );

    expect(
      items.map((item) => [item.title, item.daysUntil, item.stage]),
    ).toEqual([
      ['Overdue', -3, -1],
      ['Today', 0, 0],
      ['Tomorrow', 1, 1],
      ['In five days', 5, 7],
    ]);
    expect(unreadCount).toBe(4);
  });

  it('is read until the item reaches a later stage', async () => {
    repository.findTasks.mockResolvedValue([
      candidate({
        title: 'Seen this week',
        itemId: 'a',
        dueDate: '2026-11-02',
      }),
      candidate({
        title: 'Seen a week out, now tomorrow',
        itemId: 'b',
        dueDate: '2026-10-29',
      }),
    ]);
    repository.findStates.mockResolvedValue([
      {
        itemType: 'task',
        itemId: 'a',
        dueDate: '2026-11-02',
        seenStage: 7,
        dismissedAt: null,
      },
      {
        itemType: 'task',
        itemId: 'b',
        dueDate: '2026-10-29',
        seenStage: 7,
        dismissedAt: null,
      },
    ]);

    const { items, unreadCount } = await service.list(
      'tenant-1',
      'user-1',
      TODAY,
    );

    expect(items.map((item) => [item.itemId, item.unread])).toEqual([
      ['b', true],
      ['a', false],
    ]);
    expect(unreadCount).toBe(1);
  });

  it('leaves out dismissed reminders', async () => {
    repository.findTasks.mockResolvedValue([
      candidate({ itemId: 'a', dueDate: TODAY }),
    ]);
    repository.findStates.mockResolvedValue([
      {
        itemType: 'task',
        itemId: 'a',
        dueDate: TODAY,
        seenStage: null,
        dismissedAt: new Date(),
      },
    ]);

    await expect(service.list('tenant-1', 'user-1', TODAY)).resolves.toEqual(
      expect.objectContaining({ items: [], unreadCount: 0 }),
    );
  });

  it('follows the times and types the person chose', async () => {
    preferences.findAccount.mockResolvedValue({
      preferences: {
        dueReminders: { leadDays: [3], overdue: false, types: ['papers'] },
      },
    });
    repository.findPapers.mockResolvedValue([
      candidate({
        type: 'paper',
        title: 'In three days',
        dueDate: '2026-10-31',
      }),
    ]);

    const { items } = await service.list('tenant-1', 'user-1', TODAY);

    expect(repository.findTasks).not.toHaveBeenCalled();
    expect(repository.findPapers).toHaveBeenCalledWith('tenant-1', {
      from: TODAY,
      to: '2026-10-31',
    });
    expect(items.map((item) => item.stage)).toEqual([3]);
  });

  it('drops follow-ups once they are two weeks overdue', async () => {
    repository.findNoteFollowUps.mockResolvedValue([
      candidate({ type: 'note', title: 'Recent', dueDate: '2026-10-20' }),
      candidate({ type: 'note', title: 'Old', dueDate: '2026-10-01' }),
    ]);

    const { items } = await service.list('tenant-1', 'user-1', TODAY);

    expect(items.map((item) => item.title)).toEqual(['Recent']);
  });

  it('looks nothing up when every reminder is turned off', async () => {
    preferences.findAccount.mockResolvedValue({
      preferences: {
        dueReminders: { leadDays: [], overdue: false, types: ['tasks'] },
      },
    });

    await expect(service.list('tenant-1', 'user-1', TODAY)).resolves.toEqual(
      expect.objectContaining({ items: [], unreadCount: 0 }),
    );
    expect(repository.findTasks).not.toHaveBeenCalled();
  });

  it('needs a real date for today', async () => {
    await expect(
      service.list('tenant-1', 'user-1', '28/10/2026'),
    ).rejects.toThrow(BadRequestException);
  });

  it('records what was seen and dismissed for the caller', async () => {
    const seen = [
      { type: 'task' as const, itemId: 'a', dueDate: TODAY, stage: 0 },
    ];
    await service.markSeen('tenant-1', 'user-1', seen);
    const both = [
      { type: 'task' as const, itemId: 'a', dueDate: TODAY },
      { type: 'note' as const, itemId: 'b', dueDate: TODAY },
    ];
    await service.dismiss('tenant-1', 'user-1', both);

    expect(repository.markSeen).toHaveBeenCalledWith(
      'user-1',
      'tenant-1',
      seen,
    );
    expect(repository.dismiss).toHaveBeenCalledWith('user-1', 'tenant-1', both);
  });

  it('sends each reminder once, keeping the most urgent stage seen', async () => {
    await service.markSeen('tenant-1', 'user-1', [
      { type: 'task', itemId: 'a', dueDate: TODAY, stage: 7 },
      { type: 'task', itemId: 'a', dueDate: TODAY, stage: 0 },
    ]);
    await service.dismiss('tenant-1', 'user-1', [
      { type: 'task', itemId: 'a', dueDate: TODAY },
      { type: 'task', itemId: 'a', dueDate: TODAY },
    ]);

    expect(repository.markSeen).toHaveBeenCalledWith('user-1', 'tenant-1', [
      { type: 'task', itemId: 'a', dueDate: TODAY, stage: 0 },
    ]);
    expect(repository.dismiss).toHaveBeenCalledWith('user-1', 'tenant-1', [
      { type: 'task', itemId: 'a', dueDate: TODAY },
    ]);
  });
});
