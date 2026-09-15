import {
  ConflictException,
  ForbiddenException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NoteInvitationsService } from './note-invitations.service';
import { NoteInvitationsRepository } from '../repositories/note-invitations.repository';
import { NoteMembersRepository } from '../../note-members/repositories/note-members.repository';
import { NotesRepository } from '../../notes/repositories/notes.repository';
import { DrizzleService } from '../../../db/drizzle.service';

describe('NoteInvitationsService', () => {
  let service: NoteInvitationsService;
  let repository: {
    findByNote: jest.Mock;
    findByToken: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    markSent: jest.Mock;
    markAccepted: jest.Mock;
    delete: jest.Mock;
  };
  let noteMembersRepository: { create: jest.Mock };
  let notesRepository: { findByIdGlobal: jest.Mock };
  let drizzle: { db: { execute: jest.Mock } };
  let configService: { getOrThrow: jest.Mock };

  beforeEach(() => {
    repository = {
      findByNote: jest.fn(),
      findByToken: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      markSent: jest.fn(),
      markAccepted: jest.fn(),
      delete: jest.fn(),
    };
    noteMembersRepository = { create: jest.fn() };
    notesRepository = { findByIdGlobal: jest.fn() };
    drizzle = { db: { execute: jest.fn() } };
    configService = {
      getOrThrow: jest.fn((key: string) =>
        key === 'INVITATION_TOKEN_BYTES' ? '32' : '72',
      ),
    };

    service = new NoteInvitationsService(
      repository as unknown as NoteInvitationsRepository,
      configService as unknown as ConfigService,
      noteMembersRepository as unknown as NoteMembersRepository,
      notesRepository as unknown as NotesRepository,
      drizzle as unknown as DrizzleService,
    );
  });

  describe('createDraft', () => {
    it('creates a draft invitation without sending anything', async () => {
      notesRepository.findByIdGlobal.mockResolvedValue({
        id: 'note-1',
        title: 'Initial observations',
        tenantId: 'tenant-1',
      });
      repository.create.mockResolvedValue({
        id: 'invite-1',
        noteId: 'note-1',
        email: 'collaborator@example.com',
        status: 'draft',
        token: null,
      });

      const result = await service.createDraft('note-1', 'user-owner', {
        email: 'Collaborator@Example.com',
        name: 'Jamie Collaborator',
        affiliation: 'Example University',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          noteId: 'note-1',
          email: 'collaborator@example.com',
          name: 'Jamie Collaborator',
          affiliation: 'Example University',
          invitedBy: 'user-owner',
          status: 'draft',
        }),
      );
      expect(result).not.toHaveProperty('token');
    });

    it('throws when the note does not exist', async () => {
      notesRepository.findByIdGlobal.mockResolvedValue(undefined);

      await expect(
        service.createDraft('missing-note', 'user-owner', {
          email: 'someone@example.com',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('send', () => {
    it('generates an acceptance token and marks the draft pending, without sending any email itself', async () => {
      repository.findById.mockResolvedValue({
        id: 'invite-1',
        noteId: 'note-1',
        email: 'collaborator@example.com',
        status: 'draft',
      });
      repository.markSent.mockResolvedValue({
        id: 'invite-1',
        noteId: 'note-1',
        email: 'collaborator@example.com',
        status: 'pending',
        token: 'hashed',
      });

      const result = await service.send('note-1', 'invite-1');

      expect(repository.markSent).toHaveBeenCalledWith(
        'invite-1',
        expect.objectContaining({
          token: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      );
      expect(result.acceptanceToken).toEqual(expect.any(String));
      expect(result.invitation).not.toHaveProperty('token');
    });

    it('refuses to re-send an invitation that already went out', async () => {
      repository.findById.mockResolvedValue({
        id: 'invite-1',
        noteId: 'note-1',
        status: 'pending',
      });

      await expect(service.send('note-1', 'invite-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repository.markSent).not.toHaveBeenCalled();
    });
  });

  describe('accept', () => {
    const pendingInvitation = {
      id: 'invite-1',
      noteId: 'note-1',
      email: 'collaborator@example.com',
      status: 'pending',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };

    it('creates a note member and marks the invitation accepted', async () => {
      repository.findByToken.mockResolvedValue(pendingInvitation);
      notesRepository.findByIdGlobal.mockResolvedValue({
        id: 'note-1',
        tenantId: 'tenant-1',
      });
      repository.markAccepted.mockResolvedValue({
        ...pendingInvitation,
        status: 'accepted',
      });

      await service.accept('raw-token', 'user-2', 'collaborator@example.com');

      expect(noteMembersRepository.create).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        noteId: 'note-1',
        userId: 'user-2',
      });
      expect(repository.markAccepted).toHaveBeenCalledWith('invite-1');
    });

    it('rejects when the signed-in email does not match the invitation', async () => {
      repository.findByToken.mockResolvedValue(pendingInvitation);

      await expect(
        service.accept('raw-token', 'user-2', 'someone-else@example.com'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(noteMembersRepository.create).not.toHaveBeenCalled();
    });

    it('rejects an expired invitation', async () => {
      repository.findByToken.mockResolvedValue({
        ...pendingInvitation,
        expiresAt: new Date(Date.now() - 60 * 60 * 1000),
      });

      await expect(
        service.accept('raw-token', 'user-2', 'collaborator@example.com'),
      ).rejects.toBeInstanceOf(GoneException);
    });
  });

  describe('revoke', () => {
    it('deletes the invitation', async () => {
      repository.delete.mockResolvedValue({ id: 'invite-1' });

      await service.revoke('note-1', 'invite-1');

      expect(repository.delete).toHaveBeenCalledWith('note-1', 'invite-1');
    });

    it('throws when the invitation does not exist', async () => {
      repository.delete.mockResolvedValue(undefined);

      await expect(service.revoke('note-1', 'invite-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
