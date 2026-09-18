import { Logger } from '@nestjs/common';

import { ArchiveCleanupService } from './modules/archive-cleanup/archive-cleanup.service';

const mockCreateApplicationContext = jest.fn();

jest.mock('@nestjs/core', () => {
  const actual =
    jest.requireActual<typeof import('@nestjs/core')>('@nestjs/core');

  return {
    ...actual,
    NestFactory: {
      ...actual.NestFactory,
      createApplicationContext: mockCreateApplicationContext,
    },
  };
});

// Load the handler only after NestFactory has been mocked.
/* eslint-disable @typescript-eslint/no-require-imports */
const { handler } =
  require('./cleanup-lambda') as typeof import('./cleanup-lambda');
/* eslint-enable @typescript-eslint/no-require-imports */

describe('cleanup Lambda handler', () => {
  afterEach(() => {
    mockCreateApplicationContext.mockReset();
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

    mockCreateApplicationContext.mockResolvedValue({ get, close });

    await expect(handler()).resolves.toEqual({
      deletedProjects: 1,
      deletedModules: 2,
    });

    expect(mockCreateApplicationContext).toHaveBeenCalledTimes(1);
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

    mockCreateApplicationContext.mockResolvedValue({
      get: () => ({ handleCleanup }),
      close,
    });

    await expect(handler()).rejects.toThrow('Cleanup failed');

    expect(loggerError).toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });
});
