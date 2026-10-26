import { UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA, HEADERS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from '../users/users.service';
import { DataExportController } from './data-export.controller';
import { DataExportService } from './data-export.service';

describe('DataExportController', () => {
  function setup() {
    const exportService = {
      exportForCaller: jest.fn().mockResolvedValue({ counts: {} }),
    };
    const usersService = {
      findByExternalAuthId: jest.fn().mockResolvedValue({
        id: 'authenticated-user',
      }),
    };

    const controller = new DataExportController(
      exportService as unknown as DataExportService,
      usersService as unknown as UsersService,
    );

    return { controller, exportService, usersService };
  }

  function request() {
    return {
      user: { sub: 'verified-auth-subject' },
      query: { userId: 'another-user' },
      body: { userId: 'another-user' },
    } as unknown as Parameters<DataExportController['exportData']>[0];
  }

  it('uses the verified identity rather than a supplied user ID', async () => {
    const { controller, exportService, usersService } = setup();

    await controller.exportData(request());

    expect(usersService.findByExternalAuthId).toHaveBeenCalledWith(
      'verified-auth-subject',
    );
    expect(exportService.exportForCaller).toHaveBeenCalledTimes(1);
    expect(exportService.exportForCaller).toHaveBeenCalledWith(
      'authenticated-user',
    );
  });

  it('does not export when the authenticated user has no application account', async () => {
    const { controller, exportService, usersService } = setup();
    usersService.findByExternalAuthId.mockResolvedValue(undefined);

    await expect(controller.exportData(request())).rejects.toThrow(
      UnauthorizedException,
    );

    expect(exportService.exportForCaller).not.toHaveBeenCalled();
  });

  it('requires JWT authentication and disables response caching', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, DataExportController),
    ).toContain(JwtAuthGuard);

    const handler: unknown = Object.getOwnPropertyDescriptor(
      DataExportController.prototype,
      'exportData',
    )?.value;

    if (typeof handler !== 'function') {
      throw new Error('Expected exportData to be a controller method');
    }

    expect(Reflect.getMetadata(HEADERS_METADATA, handler)).toEqual(
      expect.arrayContaining([{ name: 'Cache-Control', value: 'no-store' }]),
    );
  });
});
