import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NoteInvitationsController } from './note-invitations.controller';
import { NoteInvitationsService } from '../services/note-invitations.service';
import { UsersService } from '../../users/users.service';
import { NotesRepository } from '../../notes/repositories/notes.repository';

describe('NoteInvitationsController', () => {
  let controller: NoteInvitationsController;
  let service: {
    list: jest.Mock;
    createDraft: jest.Mock;
    send: jest.Mock;
    revoke: jest.Mock;
  };
  let usersService: { findByExternalAuthId: jest.Mock };
  let notesRepository: { findById: jest.Mock };

  const req = { user: { sub: 'cognito-sub' } } as any;

  beforeEach(() => {
    service = {
      list: jest.fn(),
      createDraft: jest.fn(),
      send: jest.fn(),
      revoke: jest.fn(),
    };
    usersService = { findByExternalAuthId: jest.fn() };
    notesRepository = { findById: jest.fn() };

    controller = new NoteInvitationsController(
      service as unknown as NoteInvitationsService,
      usersService as unknown as UsersService,
      notesRepository as unknown as NotesRepository,
    );
  });

  it('lets the note creator add a draft collaborator', async () => {
    usersService.findByExternalAuthId.mockResolvedValue({ id: 'user-owner' });
    notesRepository.findById.mockResolvedValue({
      id: 'note-1',
      createdBy: 'user-owner',
    });
    service.createDraft.mockResolvedValue({ id: 'invite-1' });

    const dto = { email: 'collaborator@example.com' };
    const result = await controller.createDraft('tenant-1', 'note-1', req, dto);

    expect(service.createDraft).toHaveBeenCalledWith(
      'note-1',
      'user-owner',
      dto,
    );
    expect(result).toEqual({ id: 'invite-1' });
  });

  it('forbids a non-creator from adding a draft collaborator', async () => {
    usersService.findByExternalAuthId.mockResolvedValue({ id: 'user-other' });
    notesRepository.findById.mockResolvedValue({
      id: 'note-1',
      createdBy: 'user-owner',
    });

    await expect(
      controller.createDraft('tenant-1', 'note-1', req, {
        email: 'collaborator@example.com',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.createDraft).not.toHaveBeenCalled();
  });

  it('forbids a non-creator from sending or revoking an invitation', async () => {
    usersService.findByExternalAuthId.mockResolvedValue({ id: 'user-other' });
    notesRepository.findById.mockResolvedValue({
      id: 'note-1',
      createdBy: 'user-owner',
    });

    await expect(
      controller.send('tenant-1', 'note-1', 'invite-1', req),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      controller.revoke('tenant-1', 'note-1', 'invite-1', req),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.send).not.toHaveBeenCalled();
    expect(service.revoke).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the note does not exist', async () => {
    usersService.findByExternalAuthId.mockResolvedValue({ id: 'user-owner' });
    notesRepository.findById.mockResolvedValue(undefined);

    await expect(
      controller.list('tenant-1', 'missing-note', req),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
