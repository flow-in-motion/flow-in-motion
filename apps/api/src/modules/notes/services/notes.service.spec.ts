// apps/api/src/modules/notes/services/notes.service.spec.ts
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotesService } from './notes.service';
import { NotesRepository } from '../repositories/notes.repository';
import { TenantSequencesRepository } from '../../tenant-sequences/repositories/tenant-sequences.repository';
import { EnumRepository } from '../../enum/repositories/enum.repository';
import { NoteMembersRepository } from '../../note-members/repositories/note-members.repository';
import { ProjectModulesRepository } from '../../project-modules/repositories/project-modules.repository';

describe('NotesService', () => {
  let service: NotesService;

  let repository: {
    findById: jest.Mock;
    findByIdGlobal: jest.Mock;
    findByCreator: jest.Mock;
    findByIds: jest.Mock;
    findVisibleByTenant: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  let sequences: {
    nextDisplayId: jest.Mock;
  };

  let enumRepository: {
    findByCategoryAndValue: jest.Mock;
    findValuesByIds: jest.Mock;
  };

  let noteMembers: {
    create: jest.Mock;
    deleteAllForNote: jest.Mock;
    findByNoteAndUser: jest.Mock;
    findByNoteIdsAndUser: jest.Mock;
    findNoteIdsByUser: jest.Mock;
  };

  let modulesRepository: {
    findById: jest.Mock;
  };

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      findByIdGlobal: jest.fn(),
      findByCreator: jest.fn(),
      findByIds: jest.fn(),
      findVisibleByTenant: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    sequences = {
      nextDisplayId: jest.fn().mockResolvedValue('NTE-0001'),
    };

    enumRepository = {
      findByCategoryAndValue: jest
        .fn()
        .mockResolvedValue({ id: 'visibility-private-id' }),

      findValuesByIds: jest
        .fn()
        .mockImplementation((ids: string[]) =>
          Promise.resolve(new Map(ids.map((id) => [id, id]))),
        ),
    };

    noteMembers = {
      create: jest.fn(),
      deleteAllForNote: jest.fn(),
      findByNoteAndUser: jest.fn().mockResolvedValue(undefined),
      findByNoteIdsAndUser: jest.fn().mockResolvedValue(new Set()),
      findNoteIdsByUser: jest.fn().mockResolvedValue([]),
    };

    modulesRepository = {
      findById: jest.fn(),
    };

    service = new NotesService(
      repository as unknown as NotesRepository,
      enumRepository as unknown as EnumRepository,
      sequences as unknown as TenantSequencesRepository,
      noteMembers as unknown as NoteMembersRepository,
      modulesRepository as unknown as ProjectModulesRepository,
    );
  });

  describe('create', () => {
    it('delegates directly to the repository, no enum resolution', async () => {
      repository.create.mockResolvedValue({
        id: 'note-1',
        visibilityId: 'visibility-private-id',
      });

      const result = await service.create('tenant-1', 'user-1', {
        title: 'Meeting Notes',
        content: 'Discussed timeline',
      });

      expect(repository.create).toHaveBeenCalledWith({
        projectId: undefined,
        tenantId: 'tenant-1',
        createdBy: 'user-1',
        title: 'Meeting Notes',
        content: 'Discussed timeline',
        moduleId: undefined,
        displayId: 'NTE-0001',
        visibilityId: 'visibility-private-id',
      });

      expect(result).toEqual({
        id: 'note-1',
        visibility: 'visibility-private-id',
      });
    });

    it('derives projectId from an independent module rather than trusting the caller', async () => {
      modulesRepository.findById.mockResolvedValue({
        id: 'module-1',
        projectId: null,
      });

      repository.create.mockResolvedValue({
        id: 'note-1',
        visibilityId: null,
      });

      await service.create('tenant-1', 'user-1', {
        title: 'Meeting Notes',
        moduleId: 'module-1',
        projectId: 'project-should-be-ignored',
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: undefined,
          moduleId: 'module-1',
        }),
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the note does not exist', async () => {
      repository.findById.mockResolvedValue(undefined);

      await expect(
        service.findOne('tenant-1', 'note-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the caller is neither creator nor member', async () => {
      repository.findById.mockResolvedValue({
        id: 'note-1',
        createdBy: 'owner-1',
      });

      await expect(
        service.findOne('tenant-1', 'note-1', 'outsider-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns the note when the caller is the creator', async () => {
      repository.findById.mockResolvedValue({
        id: 'note-1',
        createdBy: 'user-1',
        visibilityId: null,
      });

      const result = await service.findOne('tenant-1', 'note-1', 'user-1');

      expect(result).toEqual(
        expect.objectContaining({
          id: 'note-1',
        }),
      );
    });

    it('passes the createdAt timestamp straight through to the response', async () => {
      // Regression test: the notes table used to store this under a
      // differently-named column ("note_date"), which the service never
      // renamed — so the API response silently never had a createdAt field
      // at all, even though every other entity exposes one.
      repository.findById.mockResolvedValue({
        id: 'note-1',
        createdBy: 'user-1',
        visibilityId: null,
        createdAt: '2026-01-05T00:00:00.000Z',
      });

      const result = await service.findOne('tenant-1', 'note-1', 'user-1');

      expect(result).toEqual(
        expect.objectContaining({
          createdAt: '2026-01-05T00:00:00.000Z',
        }),
      );
    });

    it('returns the note when the caller is a note member', async () => {
      repository.findById.mockResolvedValue({
        id: 'note-1',
        createdBy: 'owner-1',
        visibilityId: null,
      });

      noteMembers.findByNoteAndUser.mockResolvedValue({
        id: 'member-row',
      });

      const result = await service.findOne('tenant-1', 'note-1', 'member-1');

      expect(result).toEqual(
        expect.objectContaining({
          id: 'note-1',
        }),
      );
    });
  });

  describe('listForCaller', () => {
    it('returns every note the caller created or was added to, across tenants', async () => {
      repository.findByCreator.mockResolvedValue([
        {
          id: 'note-1',
          createdBy: 'user-1',
          visibilityId: null,
        },
      ]);

      noteMembers.findNoteIdsByUser.mockResolvedValue(['note-1', 'note-2']);

      repository.findByIds.mockResolvedValue([
        {
          id: 'note-2',
          createdBy: 'owner-2',
          visibilityId: null,
        },
      ]);

      const result = await service.listForCaller('user-1');

      expect(repository.findByIds).toHaveBeenCalledWith(['note-2']);
      expect(result.map((note) => note.id)).toEqual(['note-1', 'note-2']);
    });
  });

  describe('findOneForCaller', () => {
    it('returns the note from its own tenant even when the caller belongs to a different tenant', async () => {
      repository.findByIdGlobal.mockResolvedValue({
        id: 'note-1',
        tenantId: 'tenant-2',
        createdBy: 'owner-1',
        visibilityId: null,
      });

      noteMembers.findByNoteAndUser.mockResolvedValue({
        id: 'member-row',
      });

      const result = await service.findOneForCaller('note-1', 'member-1');

      expect(noteMembers.findByNoteAndUser).toHaveBeenCalledWith(
        'tenant-2',
        'note-1',
        'member-1',
      );

      expect(result).toEqual(
        expect.objectContaining({
          id: 'note-1',
        }),
      );
    });

    it('throws NotFoundException when the note does not exist in any tenant', async () => {
      repository.findByIdGlobal.mockResolvedValue(undefined);

      await expect(
        service.findOneForCaller('note-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the caller cannot access the note', async () => {
      repository.findByIdGlobal.mockResolvedValue({
        id: 'note-1',
        tenantId: 'tenant-1',
        createdBy: 'owner-1',
      });

      await expect(
        service.findOneForCaller('note-1', 'outsider-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('list', () => {
    it('returns a paginated list of visible notes', async () => {
      repository.findVisibleByTenant.mockResolvedValue({
        data: [
          {
            id: 'note-1',
            createdBy: 'user-1',
            visibilityId: null,
          },
          {
            id: 'note-2',
            createdBy: 'owner-2',
            visibilityId: null,
          },
        ],
        totalItems: 45,
      });

      const result = await service.list(
        'tenant-1',
        'user-1',
        2,
        20,
        'project-1',
      );

      expect(repository.findVisibleByTenant).toHaveBeenCalledWith(
        'tenant-1',
        'user-1',
        20,
        20,
        'project-1',
      );

      expect(noteMembers.findByNoteIdsAndUser).not.toHaveBeenCalled();

      expect(result.data.map((note) => note.id)).toEqual(['note-1', 'note-2']);

      expect(result.meta).toEqual({
        page: 2,
        pageSize: 20,
        totalItems: 45,
        totalPages: 3,
      });
    });
  });

  describe('update', () => {
    it('throws NotFoundException if the note does not exist', async () => {
      repository.findById.mockResolvedValue(undefined);

      await expect(
        service.update('tenant-1', 'note-1', 'user-1', {
          title: 'Updated',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException if the caller cannot access the note', async () => {
      repository.findById.mockResolvedValue({
        id: 'note-1',
        createdBy: 'owner-1',
      });

      await expect(
        service.update('tenant-1', 'note-1', 'outsider-1', {
          title: 'Updated',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('throws NotFoundException if the note does not exist', async () => {
      repository.findById.mockResolvedValue(undefined);

      await expect(
        service.delete('tenant-1', 'note-1', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException if the caller is not the creator', async () => {
      repository.findById.mockResolvedValue({
        id: 'note-1',
        createdBy: 'owner-1',
      });

      await expect(
        service.delete('tenant-1', 'note-1', 'outsider-1'),
      ).rejects.toThrow(ForbiddenException);

      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('returns the deleted note when the caller is the creator', async () => {
      repository.findById.mockResolvedValue({
        id: 'note-1',
        createdBy: 'user-1',
      });

      repository.delete.mockResolvedValue({
        id: 'note-1',
        visibilityId: null,
      });

      const result = await service.delete('tenant-1', 'note-1', 'user-1');

      expect(result).toEqual({
        id: 'note-1',
        visibility: null,
      });
    });
  });

  describe('deleteForCaller', () => {
    it('throws NotFoundException when the note does not exist in any tenant', async () => {
      repository.findByIdGlobal.mockResolvedValue(undefined);

      await expect(service.deleteForCaller('note-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('resolves the note real tenant and delegates to the access-checked delete', async () => {
      repository.findByIdGlobal.mockResolvedValue({
        id: 'note-1',
        tenantId: 'tenant-2',
        createdBy: 'user-1',
      });

      repository.findById.mockResolvedValue({
        id: 'note-1',
        createdBy: 'user-1',
      });

      repository.delete.mockResolvedValue({
        id: 'note-1',
        visibilityId: null,
      });

      await service.deleteForCaller('note-1', 'user-1');

      expect(repository.delete).toHaveBeenCalledWith('tenant-2', 'note-1');
    });
  });
});
