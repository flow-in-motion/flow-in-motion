import { Logger } from '@nestjs/common';

import { runCleanup } from './cleanup-runner';
import { ArchiveCleanupService } from './modules/archive-cleanup/archive-cleanup.service';

describe('cleanup Lambda runner', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('runs cleanup once and closes the Nest application context', async () => {
    const handleCleanup = jest.fn().mockResolvedValue({
      deletedProjects: [{ id: 'project-1' }],
      deletedModules: [{ id: 'module-1' }, { id: 'module-2' }],
    });
    const close = jest.fn().mockResolvedValue(undefined);
    const get = jest.fn((token: unknown) => {
      if (token === ArchiveCleanupService) {
        return { handleCleanup };
      }
      throw new Error('Unexpected provider requested');
    });

    await expect(runCleanup({ get, close } as never)).resolves.toEqual({
      deletedProjects: 1,
      deletedModules: 2,
    });

    expect(handleCleanup).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('closes the Nest application context when cleanup fails', async () => {
    const failure = new Error('Cleanup failed');
    const handleCleanup = jest.fn().mockRejectedValue(failure);
    const close = jest.fn().mockResolvedValue(undefined);
    const loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    const get = jest.fn(() => ({ handleCleanup }));

    await expect(runCleanup({ get, close } as never)).rejects.toThrow(
      'Cleanup failed',
    );

    expect(loggerError).toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });
});
