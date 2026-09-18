import { NestFactory } from '@nestjs/core';

import { handler } from './cleanup-lambda';
import { ArchiveCleanupService } from './modules/archive-cleanup/archive-cleanup.service';

describe('cleanup Lambda handler', () => {
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

    jest
      .spyOn(NestFactory, 'createApplicationContext')
      .mockResolvedValue({ get, close } as never);

    await expect(handler()).resolves.toEqual({
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

    jest.spyOn(NestFactory, 'createApplicationContext').mockResolvedValue({
      get: () => ({ handleCleanup }),
      close,
    } as never);

    await expect(handler()).rejects.toThrow('Cleanup failed');
    expect(close).toHaveBeenCalledTimes(1);
  });
});
