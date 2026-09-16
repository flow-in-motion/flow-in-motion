import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { InvitationAcceptanceController } from './invitation-acceptance.controller';
import { ProjectInvitationsService } from '../services/project-invitations.service';
import { ModuleInvitationsService } from '../../module-invitations/services/module-invitations.service';
import { TaskInvitationsService } from '../../task-invitations/services/task-invitations.service';
import { NoteInvitationsService } from '../../note-invitations/services/note-invitations.service';
import { UsersService } from '../../users/users.service';

describe('InvitationAcceptanceController', () => {
  let controller: InvitationAcceptanceController;
  let projectInvitations: { preview: jest.Mock; accept: jest.Mock };
  let moduleInvitations: { preview: jest.Mock; accept: jest.Mock };
  let taskInvitations: { preview: jest.Mock; accept: jest.Mock };
  let noteInvitations: { preview: jest.Mock; accept: jest.Mock };
  let usersService: { findOrProvisionFromPrincipal: jest.Mock };

  beforeEach(async () => {
    projectInvitations = { preview: jest.fn(), accept: jest.fn() };
    moduleInvitations = { preview: jest.fn(), accept: jest.fn() };
    taskInvitations = {
      preview: jest.fn().mockRejectedValue(new NotFoundException()),
      accept: jest.fn().mockRejectedValue(new NotFoundException()),
    };
    noteInvitations = {
      preview: jest.fn().mockRejectedValue(new NotFoundException()),
      accept: jest.fn().mockRejectedValue(new NotFoundException()),
    };
    usersService = { findOrProvisionFromPrincipal: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [InvitationAcceptanceController],
      providers: [
        { provide: ProjectInvitationsService, useValue: projectInvitations },
        { provide: ModuleInvitationsService, useValue: moduleInvitations },
        { provide: TaskInvitationsService, useValue: taskInvitations },
        { provide: NoteInvitationsService, useValue: noteInvitations },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    controller = moduleRef.get<InvitationAcceptanceController>(
      InvitationAcceptanceController,
    );
  });

  describe('accept', () => {
    it('provisions a brand-new user from the access token before accepting', async () => {
      usersService.findOrProvisionFromPrincipal.mockResolvedValue({
        id: 'new-user-id',
        email: 'newcomer@example.com',
      });
      projectInvitations.accept.mockResolvedValue({ id: 'collab-1' });

      const req = {
        user: { sub: 'supabase-user-new', accessToken: 'access-token-new' },
      } as any;

      const result = await controller.accept('raw-token', req);

      expect(usersService.findOrProvisionFromPrincipal).toHaveBeenCalledWith(
        req.user,
      );
      expect(projectInvitations.accept).toHaveBeenCalledWith(
        'raw-token',
        'new-user-id',
        'newcomer@example.com',
      );
      expect(result).toEqual({ type: 'project', row: { id: 'collab-1' } });
    });

    it('falls back to a module invitation when no project invitation matches', async () => {
      usersService.findOrProvisionFromPrincipal.mockResolvedValue({
        id: 'user-id',
        email: 'someone@example.com',
      });
      projectInvitations.accept.mockRejectedValue(new NotFoundException());
      moduleInvitations.accept.mockResolvedValue({ id: 'collab-2' });

      const req = {
        user: { sub: 'supabase-user', accessToken: 'access-token' },
      } as any;

      const result = await controller.accept('raw-token', req);

      expect(result).toEqual({ type: 'module', row: { id: 'collab-2' } });
    });

    it('falls back to a task invitation when no project/module invitation matches', async () => {
      usersService.findOrProvisionFromPrincipal.mockResolvedValue({
        id: 'user-id',
        email: 'someone@example.com',
      });
      projectInvitations.accept.mockRejectedValue(new NotFoundException());
      moduleInvitations.accept.mockRejectedValue(new NotFoundException());
      taskInvitations.accept.mockResolvedValue({ id: 'member-1' });

      const req = {
        user: { sub: 'supabase-user', accessToken: 'access-token' },
      } as any;

      const result = await controller.accept('raw-token', req);

      expect(result).toEqual({ type: 'task', row: { id: 'member-1' } });
    });

    it('falls back to a note invitation when nothing else matches', async () => {
      usersService.findOrProvisionFromPrincipal.mockResolvedValue({
        id: 'user-id',
        email: 'someone@example.com',
      });
      projectInvitations.accept.mockRejectedValue(new NotFoundException());
      moduleInvitations.accept.mockRejectedValue(new NotFoundException());
      taskInvitations.accept.mockRejectedValue(new NotFoundException());
      noteInvitations.accept.mockResolvedValue({ id: 'member-2' });

      const req = {
        user: { sub: 'supabase-user', accessToken: 'access-token' },
      } as any;

      const result = await controller.accept('raw-token', req);

      expect(result).toEqual({ type: 'note', row: { id: 'member-2' } });
    });

    it('throws NotFoundException when the user could not be found or provisioned', async () => {
      usersService.findOrProvisionFromPrincipal.mockResolvedValue(undefined);

      const req = {
        user: { sub: 'supabase-user', accessToken: 'access-token' },
      } as any;

      await expect(controller.accept('raw-token', req)).rejects.toThrow(
        NotFoundException,
      );
      expect(projectInvitations.accept).not.toHaveBeenCalled();
    });
  });
});
