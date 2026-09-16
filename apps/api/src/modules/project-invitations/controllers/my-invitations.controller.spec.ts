import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MyInvitationsController } from './my-invitations.controller';
import { ProjectInvitationsService } from '../services/project-invitations.service';
import { ModuleInvitationsService } from '../../module-invitations/services/module-invitations.service';
import { UsersService } from '../../users/users.service';

describe('MyInvitationsController', () => {
  let controller: MyInvitationsController;
  let projectInvitations: { listForEmailWithTitles: jest.Mock };
  let moduleInvitations: { listForEmailWithTitles: jest.Mock };
  let usersService: { findOrProvisionFromPrincipal: jest.Mock };

  beforeEach(async () => {
    projectInvitations = { listForEmailWithTitles: jest.fn() };
    moduleInvitations = { listForEmailWithTitles: jest.fn() };
    usersService = { findOrProvisionFromPrincipal: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [MyInvitationsController],
      providers: [
        { provide: ProjectInvitationsService, useValue: projectInvitations },
        { provide: ModuleInvitationsService, useValue: moduleInvitations },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    controller = moduleRef.get<MyInvitationsController>(
      MyInvitationsController,
    );
  });

  it('provisions a brand-new user from the access token before listing invitations', async () => {
    usersService.findOrProvisionFromPrincipal.mockResolvedValue({
      id: 'new-user-id',
      email: 'newcomer@example.com',
    });
    projectInvitations.listForEmailWithTitles.mockResolvedValue([
      { id: 'invite-1' },
    ]);
    moduleInvitations.listForEmailWithTitles.mockResolvedValue([]);

    const req = {
      user: { sub: 'supabase-user-new', accessToken: 'access-token-new' },
    } as any;

    const result = await controller.list(req);

    expect(usersService.findOrProvisionFromPrincipal).toHaveBeenCalledWith(
      req.user,
    );
    expect(projectInvitations.listForEmailWithTitles).toHaveBeenCalledWith(
      'newcomer@example.com',
    );
    expect(moduleInvitations.listForEmailWithTitles).toHaveBeenCalledWith(
      'newcomer@example.com',
    );
    expect(result).toEqual({ projects: [{ id: 'invite-1' }], modules: [] });
  });

  it('throws NotFoundException when the user could not be found or provisioned', async () => {
    usersService.findOrProvisionFromPrincipal.mockResolvedValue(undefined);

    const req = {
      user: { sub: 'supabase-user', accessToken: 'access-token' },
    } as any;

    await expect(controller.list(req)).rejects.toThrow(NotFoundException);
    expect(projectInvitations.listForEmailWithTitles).not.toHaveBeenCalled();
  });
});
