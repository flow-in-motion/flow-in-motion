import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TaskInvitationsController } from './task-invitations.controller';
import { TaskInvitationsService } from '../services/task-invitations.service';
import { UsersService } from '../../users/users.service';
import { TasksRepository } from '../../tasks/repositories/tasks.repository';

describe('TaskInvitationsController', () => {
  let controller: TaskInvitationsController;
  let service: {
    list: jest.Mock;
    createDraft: jest.Mock;
    send: jest.Mock;
    revoke: jest.Mock;
  };
  let usersService: { findByExternalAuthId: jest.Mock };
  let tasksRepository: { findById: jest.Mock };

  const req = { user: { sub: 'cognito-sub' } } as any;

  beforeEach(() => {
    service = {
      list: jest.fn(),
      createDraft: jest.fn(),
      send: jest.fn(),
      revoke: jest.fn(),
    };
    usersService = { findByExternalAuthId: jest.fn() };
    tasksRepository = { findById: jest.fn() };

    controller = new TaskInvitationsController(
      service as unknown as TaskInvitationsService,
      usersService as unknown as UsersService,
      tasksRepository as unknown as TasksRepository,
    );
  });

  it('lets the task creator add a draft collaborator', async () => {
    usersService.findByExternalAuthId.mockResolvedValue({ id: 'user-owner' });
    tasksRepository.findById.mockResolvedValue({
      id: 'task-1',
      createdBy: 'user-owner',
    });
    service.createDraft.mockResolvedValue({ id: 'invite-1' });

    const dto = { email: 'collaborator@example.com' };
    const result = await controller.createDraft('tenant-1', 'task-1', req, dto);

    expect(service.createDraft).toHaveBeenCalledWith(
      'task-1',
      'user-owner',
      dto,
    );
    expect(result).toEqual({ id: 'invite-1' });
  });

  it('forbids a non-creator from adding a draft collaborator', async () => {
    usersService.findByExternalAuthId.mockResolvedValue({ id: 'user-other' });
    tasksRepository.findById.mockResolvedValue({
      id: 'task-1',
      createdBy: 'user-owner',
    });

    await expect(
      controller.createDraft('tenant-1', 'task-1', req, {
        email: 'collaborator@example.com',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.createDraft).not.toHaveBeenCalled();
  });

  it('forbids a non-creator from sending an invitation', async () => {
    usersService.findByExternalAuthId.mockResolvedValue({ id: 'user-other' });
    tasksRepository.findById.mockResolvedValue({
      id: 'task-1',
      createdBy: 'user-owner',
    });

    await expect(
      controller.send('tenant-1', 'task-1', 'invite-1', req),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.send).not.toHaveBeenCalled();
  });

  it('forbids a non-creator from revoking an invitation', async () => {
    usersService.findByExternalAuthId.mockResolvedValue({ id: 'user-other' });
    tasksRepository.findById.mockResolvedValue({
      id: 'task-1',
      createdBy: 'user-owner',
    });

    await expect(
      controller.revoke('tenant-1', 'task-1', 'invite-1', req),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.revoke).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the task does not exist', async () => {
    usersService.findByExternalAuthId.mockResolvedValue({ id: 'user-owner' });
    tasksRepository.findById.mockResolvedValue(undefined);

    await expect(
      controller.list('tenant-1', 'missing-task', req),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
