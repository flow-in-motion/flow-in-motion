import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { WorkTimeRepository, type WorkTimeRow } from './work-time.repository';
import { WorkTimeService } from './work-time.service';
import type { WorkTimeKind } from './work-time.dto';
const user = 'user';
function row(
  kind: WorkTimeKind = 'project',
  override: Partial<WorkTimeRow> = {},
): WorkTimeRow {
  return {
    id: 'entry',
    userId: user,
    tenantId: 'tenant',
    projectId: kind === 'project' ? 'target' : null,
    noteId: kind === 'note' ? 'target' : null,
    hdrPersonId: kind === 'hdr' ? 'target' : null,
    source: 'timer',
    startedAt: new Date('2026-11-01T00:00:00Z'),
    endedAt: null,
    runningSince: new Date(),
    durationSeconds: 120,
    runningSeconds: 30,
    note: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...override,
  };
}
describe('Project, Note and HDR time', () => {
  let repo: Record<
    | 'target'
    | 'current'
    | 'own'
    | 'openFor'
    | 'create'
    | 'transition'
    | 'list'
    | 'update'
    | 'remove',
    jest.Mock
  >;
  let service: WorkTimeService;
  beforeEach(() => {
    repo = Object.fromEntries(
      [
        'target',
        'current',
        'own',
        'openFor',
        'create',
        'transition',
        'list',
        'update',
        'remove',
      ].map((key) => [key, jest.fn()]),
    ) as typeof repo;
    repo.target.mockResolvedValue({
      id: 'target',
      tenantId: 'tenant',
      title: 'Work',
    });
    repo.own.mockResolvedValue(row());
    repo.create.mockResolvedValue({ id: 'entry' });
    service = new WorkTimeService(repo as unknown as WorkTimeRepository);
  });
  it.each<WorkTimeKind>(['project', 'note', 'hdr'])(
    'starts %s directly without changing other timers',
    async (kind) => {
      repo.own.mockResolvedValue(row(kind));
      const result = await service.start(kind, 'target', user);
      expect(repo.create).toHaveBeenCalledWith(kind, 'target', user, 'tenant');
      expect(repo.transition).not.toHaveBeenCalled();
      expect(result.timer).toMatchObject({
        kind,
        targetId: 'target',
        isRunning: true,
      });
    },
  );
  it('resumes the existing paused item rather than adding another', async () => {
    repo.openFor.mockResolvedValue(row('note', { runningSince: null }));
    repo.transition.mockResolvedValue(row('note'));
    await service.start('note', 'target', user);
    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.transition).toHaveBeenCalledWith('entry', user, 'resume');
  });
  it('starting an already-running item preserves its running stretch', async () => {
    repo.openFor.mockResolvedValue(row());
    await service.start('project', 'target', user);
    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.transition).not.toHaveBeenCalled();
  });
  it.each(['start', 'list', 'add'] as const)(
    'denies %s on an inaccessible item',
    async (method) => {
      repo.target.mockResolvedValue(undefined);
      await expect(
        method === 'add'
          ? service.add('hdr', 'target', user, {
              startedAt: new Date().toISOString(),
              minutes: 30,
            })
          : service[method]('hdr', 'target', user),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.create).not.toHaveBeenCalled();
    },
  );
  it('concurrent start conflicts are handled without creating duplicate timers', async () => {
    repo.create.mockRejectedValue({ cause: { code: '23505' } });
    await expect(
      service.start('project', 'target', user),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it.each(['pause', 'resume'] as const)(
    'repeated %s is idempotent',
    async (action) => {
      repo.own.mockResolvedValue(
        row('project', {
          runningSince: action === 'pause' ? null : new Date(),
        }),
      );
      await service.transition('entry', user, action);
      expect(repo.transition).not.toHaveBeenCalled();
      expect(repo.own).toHaveBeenCalledWith('entry', user, true);
    },
  );
  it('stops an own timer after access is lost but does not allow resuming it', async () => {
    repo.target.mockResolvedValue(undefined);
    repo.transition.mockResolvedValue(
      row('project', {
        endedAt: new Date(),
        runningSince: null,
        runningSeconds: 0,
      }),
    );
    await expect(
      service.transition('entry', user, 'resume'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(
      (await service.transition('entry', user, 'stop')).timer?.isOpen,
    ).toBe(false);
  });
  it('never acts on another person’s entry', async () => {
    repo.own.mockResolvedValue(undefined);
    await expect(
      service.transition('entry', 'other', 'stop'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.transition).not.toHaveBeenCalled();
  });
  it('current excludes lost-access titles and saves the time', async () => {
    repo.current.mockResolvedValue([row('hdr')]);
    repo.target.mockResolvedValue(undefined);
    expect(await service.current(user)).toEqual({ timers: [] });
    expect(repo.transition).toHaveBeenCalledWith('entry', user, 'stop');
  });
  it('returns only own entries and does not double-count live stretches in saved totals', async () => {
    repo.list.mockResolvedValue([
      row(),
      row('project', {
        id: 'manual',
        endedAt: new Date(),
        durationSeconds: 60,
        runningSeconds: 0,
      }),
    ]);
    const result = await service.list('project', 'target', user);
    expect(repo.list).toHaveBeenCalledWith('project', 'target', user);
    expect(result.mySeconds).toBe(180);
    expect(result.entries[0]?.runningSeconds).toBe(30);
  });
  it('adds dated manual time to the actual parent workspace', async () => {
    await service.add('note', 'target', user, {
      startedAt: '2026-11-01T12:00:00Z',
      minutes: 90,
      note: ' Meeting ',
    });
    expect(repo.create).toHaveBeenCalledWith(
      'note',
      'target',
      user,
      'tenant',
      expect.objectContaining({
        minutes: 90,
        startedAt: new Date('2026-11-01T12:00:00Z'),
      }),
    );
  });
  it.each(['invalid', new Date(Date.now() + 3 * 86400000).toISOString()])(
    'rejects invalid/future manual dates',
    async (startedAt) => {
      await expect(
        service.add('project', 'target', user, { startedAt, minutes: 30 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.create).not.toHaveBeenCalled();
    },
  );
  it.each(['update', 'remove'] as const)(
    'requires stopping before %s',
    async (method) => {
      await expect(
        method === 'update'
          ? service.update('entry', user, { minutes: 30 })
          : service.remove('entry', user),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.update).not.toHaveBeenCalled();
      expect(repo.remove).not.toHaveBeenCalled();
    },
  );
  it('edits and removes only own finished entries on accessible work', async () => {
    repo.own.mockResolvedValue(row('hdr', { endedAt: new Date() }));
    repo.update.mockResolvedValue(
      row('hdr', { endedAt: new Date(), durationSeconds: 1800 }),
    );
    repo.remove.mockResolvedValue({ id: 'entry' });
    expect(
      (await service.update('entry', user, { minutes: 30 })).durationSeconds,
    ).toBe(1800);
    expect(await service.remove('entry', user)).toEqual({ deleted: true });
  });
});
