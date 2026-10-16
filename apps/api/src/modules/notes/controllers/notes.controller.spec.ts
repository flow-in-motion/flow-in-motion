// apps/api/src/modules/notes/controllers/notes.controller.spec.ts
import { NotesController } from './notes.controller';
import { NotesService } from '../services/notes.service';
import { UsersService } from '../../users/users.service';
import { ConfigService } from '@nestjs/config';

describe('NotesController', () => {
  let controller: NotesController;
  let notesService: {
    appendEntry: jest.Mock;
    updateEntry: jest.Mock;
    deleteEntry: jest.Mock;
    list: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let usersService: { findByExternalAuthId: jest.Mock };
  let configService: {
    get: jest.Mock;
  };

  beforeEach(() => {
    notesService = {
      appendEntry: jest.fn(),
      updateEntry: jest.fn(),
      deleteEntry: jest.fn(),
      list: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    usersService = { findByExternalAuthId: jest.fn() };

    configService = {
      get: jest.fn().mockReturnValue(20),
    };

    controller = new NotesController(
      notesService as unknown as NotesService,
      usersService as unknown as UsersService,
      configService as unknown as ConfigService,
    );
  });

  const req = {
    user: { sub: 'supabase-user-1', accessToken: 'token-1' },
  } as any;

  describe('updateEntry', () => {
    it('edits an entry using the authenticated internal user id', async () => {
      usersService.findByExternalAuthId.mockResolvedValue({ id: 'user-1' });
      const dto = { content: 'Corrected research update' };
      const response = { id: 'note-1', entries: [{ id: 'entry-1' }] };
      notesService.updateEntry.mockResolvedValue(response);

      const result = await controller.updateEntry(
        'tenant-1',
        'note-1',
        'entry-1',
        req,
        dto,
      );

      expect(usersService.findByExternalAuthId).toHaveBeenCalledWith(
        'supabase-user-1',
      );
      expect(notesService.updateEntry).toHaveBeenCalledWith(
        'tenant-1',
        'note-1',
        'entry-1',
        'user-1',
        dto,
      );
      expect(result).toBe(response);
    });
  });

  describe('deleteEntry', () => {
    it('deletes an entry using the authenticated internal user id', async () => {
      usersService.findByExternalAuthId.mockResolvedValue({ id: 'user-1' });
      const response = { id: 'note-1', entries: [] };
      notesService.deleteEntry.mockResolvedValue(response);

      const result = await controller.deleteEntry(
        'tenant-1',
        'note-1',
        'entry-1',
        req,
      );

      expect(notesService.deleteEntry).toHaveBeenCalledWith(
        'tenant-1',
        'note-1',
        'entry-1',
        'user-1',
      );
      expect(result).toBe(response);
    });
  });

  describe('appendEntry', () => {
    it('uses the authenticated internal user id to add dated content', async () => {
      usersService.findByExternalAuthId.mockResolvedValue({
        id: 'user-1',
      });

      const dto = { content: 'New research update' };
      const response = {
        id: 'note-1',
        entries: [
          {
            id: 'entry-1',
            noteId: 'note-1',
            content: dto.content,
            createdAt: '2026-10-12T06:00:00.000Z',
          },
        ],
      };
      notesService.appendEntry.mockResolvedValue(response);

      const result = await controller.appendEntry(
        'tenant-1',
        'note-1',
        req,
        dto,
      );

      expect(usersService.findByExternalAuthId).toHaveBeenCalledWith(
        'supabase-user-1',
      );
      expect(notesService.appendEntry).toHaveBeenCalledWith(
        'tenant-1',
        'note-1',
        'user-1',
        dto,
      );
      expect(result).toBe(response);
    });
  });

  describe('list', () => {
    it('resolves the caller and delegates with pagination parameters', async () => {
      usersService.findByExternalAuthId.mockResolvedValue({
        id: 'user-1',
      });

      const response = {
        data: [{ id: 'n1' }],
        meta: {
          page: 2,
          pageSize: 20,
          totalItems: 21,
          totalPages: 2,
        },
      };

      notesService.list.mockResolvedValue(response);

      const result = await controller.list('tenant-1', req, {
        page: 2,
        projectId: 'project-1',
      });

      expect(usersService.findByExternalAuthId).toHaveBeenCalledWith(
        'supabase-user-1',
      );

      expect(configService.get).toHaveBeenCalledWith('PAGE_SIZE', 20);

      expect(notesService.list).toHaveBeenCalledWith(
        'tenant-1',
        'user-1',
        2,
        20,
        'project-1',
        undefined,
        false,
      );

      expect(result).toBe(response);
    });
  });

  describe('findOne', () => {
    it('resolves the caller and delegates to the service with tenantId and noteId', async () => {
      usersService.findByExternalAuthId.mockResolvedValue({ id: 'user-1' });
      notesService.findOne.mockResolvedValue({ id: 'n1' });

      const result = await controller.findOne('tenant-1', 'n1', req);

      expect(notesService.findOne).toHaveBeenCalledWith(
        'tenant-1',
        'n1',
        'user-1',
      );
      expect(result).toEqual({ id: 'n1' });
    });
  });

  describe('create', () => {
    it('resolves the caller and delegates to the service', async () => {
      usersService.findByExternalAuthId.mockResolvedValue({ id: 'user-1' });
      notesService.create.mockResolvedValue({ id: 'n1' });

      const dto = { title: 'New Note' };

      const result = await controller.create('tenant-1', req, dto);

      expect(usersService.findByExternalAuthId).toHaveBeenCalledWith(
        'supabase-user-1',
      );
      expect(notesService.create).toHaveBeenCalledWith(
        'tenant-1',
        'user-1',
        dto,
      );
      expect(result).toEqual({ id: 'n1' });
    });
  });

  describe('update', () => {
    it('resolves the caller and delegates to the service with tenantId, noteId, and dto', async () => {
      usersService.findByExternalAuthId.mockResolvedValue({ id: 'user-1' });
      notesService.update.mockResolvedValue({ id: 'n1', title: 'Updated' });
      const dto = { title: 'Updated' };

      const result = await controller.update('tenant-1', 'n1', req, dto);

      expect(notesService.update).toHaveBeenCalledWith(
        'tenant-1',
        'n1',
        'user-1',
        dto,
      );
      expect(result).toEqual({ id: 'n1', title: 'Updated' });
    });
  });

  describe('remove', () => {
    it('resolves the caller and delegates to the service with tenantId and noteId', async () => {
      usersService.findByExternalAuthId.mockResolvedValue({ id: 'user-1' });
      notesService.delete.mockResolvedValue({ id: 'n1' });

      const result = await controller.remove('tenant-1', 'n1', req);

      expect(notesService.delete).toHaveBeenCalledWith(
        'tenant-1',
        'n1',
        'user-1',
      );
      expect(result).toEqual({ id: 'n1' });
    });
  });
});
