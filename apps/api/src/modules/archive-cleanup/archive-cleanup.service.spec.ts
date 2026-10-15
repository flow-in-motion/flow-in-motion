import { DrizzleService } from '../../db/drizzle.service';
import { ArchiveCleanupService } from './archive-cleanup.service';

describe('ArchiveCleanupService', () => {
  it('uses the existing cleanup run to capture weekly usage snapshots', async () => {
    const execute = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: 'project-1' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ captured_snapshots: 4 }] });
    const service = new ArchiveCleanupService({
      db: { execute },
    } as unknown as DrizzleService);

    await expect(service.handleCleanup()).resolves.toEqual({
      deletedProjects: [{ id: 'project-1' }],
      deletedModules: [],
      capturedWeeklySnapshots: 4,
    });
    expect(execute).toHaveBeenCalledTimes(3);
  });
});
