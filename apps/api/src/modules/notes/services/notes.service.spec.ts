// apps/api/src/modules/notes/services/notes.service.spec.ts
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { NotesService } from './notes.service';
import { NotesRepository } from '../repositories/notes.repository';
import { TenantSequencesRepository } from '../../tenant-sequences/repositories/tenant-sequences.repository';
import { EnumRepository } from '../../enum/repositories/enum.repository';
import { NoteMembersRepository } from '../../note-members/repositories/note-members.repository';
import { ProjectModulesRepository } from '../../project-modules/repositories/project-modules.repository';
import { ProjectsRepository } from '../../projects/repositories/projects.repository';

describe('NotesService', () => {
  let service: NotesService;

  let repository: {
    findEntriesByNote: jest.Mock;
    appendEntry: jest.Mock;
    updateEntry: jest.Mock;
    deleteEntry: jest.Mock;
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
  let projectsRepository: { findById: jest.Mock };

  beforeEach(() => {
    repository = {
      findEntriesByNote: jest.fn().mockResolvedValue([]),
      appendEntry: jest.fn(),
      updateEntry: jest.fn(),
      deleteEntry: jest.fn(),
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
    projectsRepository = { findById: jest.fn() };

    service = new NotesService(
      repository as unknown as NotesRepository,
      enumRepository as unknown as EnumRepository,
      sequences as unknown as TenantSequencesRepository,
      noteMembers as unknown as NoteMembersRepository,
      modulesRepository as unknown as ProjectModulesRepository,
      projectsRepository as unknown as ProjectsRepository,
    );
  });

  describe('dated entries', () => {
    const initialEntry = {
      id: 'entry-1',
      noteId: 'note-1',
      content: 'Initial content',
      createdAt: '2026-10-12T06:00:00.000Z',
    };

    const newEntry = {
      id: 'entry-2',
      noteId: 'note-1',
      content: 'New content',
      createdAt: '2026-10-13T06:00:00.000Z',
    };

    beforeEach(() => {
      repository.findById.mockResolvedValue({
        id: 'note-1',
        tenantId: 'tenant-1',
        createdBy: 'user-1',
        content: 'Initial content',
        visibilityId: null,
      });

      repository.findEntriesByNote.mockResolvedValue([initialEntry]);
    });

    it('returns entry content and its original timestamp', async () => {
      const result = await service.findOne('tenant-1', 'note-1', 'user-1');

      expect(result.entries).toEqual([initialEntry]);
    });

    it('adds trimmed content and returns both entries', async () => {
      repository.appendEntry.mockResolvedValue({ id: 'note-1' });
      repository.findEntriesByNote
        .mockResolvedValueOnce([initialEntry])
        .mockResolvedValueOnce([newEntry, initialEntry]);

      const result = await service.appendEntry('tenant-1', 'note-1', 'user-1', {
        content: '  New content  ',
      });

      expect(repository.appendEntry).toHaveBeenCalledWith(
        'tenant-1',
        'note-1',
        'New content',
      );
      expect(result.entries).toEqual([newEntry, initialEntry]);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('rejects whitespace-only additions without writing', async () => {
      await expect(
        service.appendEntry('tenant-1', 'note-1', 'user-1', {
          content: ' \n\t ',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(repository.appendEntry).not.toHaveBeenCalled();
    });

    it('does not read entries or write content for an outsider', async () => {
      await expect(
        service.appendEntry('tenant-1', 'note-1', 'outsider-1', {
          content: 'New content',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(repository.findEntriesByNote).not.toHaveBeenCalled();
      expect(repository.appendEntry).not.toHaveBeenCalled();
    });

    it('allows a member to add content using the note real tenant', async () => {
      repository.findByIdGlobal.mockResolvedValue({
        id: 'note-1',
        tenantId: 'tenant-2',
        createdBy: 'owner-1',
        visibilityId: null,
      });
      repository.findById.mockResolvedValue({
        id: 'note-1',
        tenantId: 'tenant-2',
        createdBy: 'owner-1',
        visibilityId: null,
      });
      noteMembers.findByNoteAndUser.mockResolvedValue({
        id: 'membership-1',
      });
      repository.appendEntry.mockResolvedValue({ id: 'note-1' });

      await service.appendEntryForCaller('note-1', 'member-1', {
        content: 'New content',
      });

      expect(repository.appendEntry).toHaveBeenCalledWith(
        'tenant-2',
        'note-1',
        'New content',
      );
      expect(repository.findEntriesByNote).toHaveBeenCalledWith(
        'tenant-2',
        'note-1',
      );
    });

    it('rejects an outsider through the tenant-agnostic path', async () => {
      repository.findByIdGlobal.mockResolvedValue({
        id: 'note-1',
        tenantId: 'tenant-2',
        createdBy: 'owner-1',
      });

      await expect(
        service.appendEntryForCaller('note-1', 'outsider-1', {
          content: 'New content',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(repository.findEntriesByNote).not.toHaveBeenCalled();
      expect(repository.appendEntry).not.toHaveBeenCalled();
    });

    it('rejects replacement of earlier content', async () => {
      await expect(
        service.update('tenant-1', 'note-1', 'user-1', {
          content: 'Replacement content',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(repository.update).not.toHaveBeenCalled();
      expect(repository.appendEntry).not.toHaveBeenCalled();
    });

    it('updates note details without creating a content entry', async () => {
      repository.update.mockResolvedValue({ id: 'note-1' });

      await service.update('tenant-1', 'note-1', 'user-1', {
        title: 'Updated title',
        content: 'Initial content',
      });

      expect(repository.update).toHaveBeenCalledWith(
        'tenant-1',
        'note-1',
        expect.objectContaining({ title: 'Updated title' }),
      );
      expect(repository.update.mock.calls[0][2]).not.toHaveProperty('content');
      expect(repository.appendEntry).not.toHaveBeenCalled();
    });

    it('handles a note disappearing before the addition is saved', async () => {
      repository.appendEntry.mockResolvedValue(undefined);

      await expect(
        service.appendEntry('tenant-1', 'note-1', 'user-1', {
          content: 'New content',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    describe('editing an existing entry', () => {
      const editedEntry = {
        ...initialEntry,
        content: 'Corrected content',
        updatedAt: '2026-10-16T06:00:00.000Z',
      };

      it('saves trimmed content and returns the note with the edited entry', async () => {
        repository.updateEntry.mockResolvedValue({ id: 'note-1' });
        repository.findEntriesByNote
          .mockResolvedValueOnce([initialEntry])
          .mockResolvedValueOnce([editedEntry]);

        const result = await service.updateEntry(
          'tenant-1',
          'note-1',
          'entry-1',
          'user-1',
          { content: '  Corrected content  ' },
        );

        expect(repository.updateEntry).toHaveBeenCalledWith(
          'tenant-1',
          'note-1',
          'entry-1',
          'Corrected content',
        );
        expect(result.entries).toEqual([editedEntry]);
        // Editing must never append a new entry.
        expect(repository.appendEntry).not.toHaveBeenCalled();
      });

      it('rejects whitespace-only content without writing', async () => {
        await expect(
          service.updateEntry('tenant-1', 'note-1', 'entry-1', 'user-1', {
            content: ' \n\t ',
          }),
        ).rejects.toThrow(BadRequestException);

        expect(repository.updateEntry).not.toHaveBeenCalled();
      });

      it('returns not found when the entry does not belong to the note', async () => {
        repository.updateEntry.mockResolvedValue(undefined);

        await expect(
          service.updateEntry('tenant-1', 'note-1', 'missing', 'user-1', {
            content: 'Corrected content',
          }),
        ).rejects.toThrow(NotFoundException);
      });

      it('does not write anything for an outsider', async () => {
        await expect(
          service.updateEntry('tenant-1', 'note-1', 'entry-1', 'outsider-1', {
            content: 'Corrected content',
          }),
        ).rejects.toThrow(NotFoundException);

        expect(repository.updateEntry).not.toHaveBeenCalled();
      });

      it('allows a member to edit using the note real tenant', async () => {
        const note = {
          id: 'note-1',
          tenantId: 'tenant-2',
          createdBy: 'owner-1',
          visibilityId: null,
        };
        repository.findByIdGlobal.mockResolvedValue(note);
        repository.findById.mockResolvedValue(note);
        noteMembers.findByNoteAndUser.mockResolvedValue({ id: 'membership-1' });
        repository.updateEntry.mockResolvedValue({ id: 'note-1' });

        await service.updateEntryForCaller('note-1', 'entry-1', 'member-1', {
          content: 'Corrected content',
        });

        expect(repository.updateEntry).toHaveBeenCalledWith(
          'tenant-2',
          'note-1',
          'entry-1',
          'Corrected content',
        );
      });

      it('rejects an outsider through the tenant-agnostic path', async () => {
        repository.findByIdGlobal.mockResolvedValue({
          id: 'note-1',
          tenantId: 'tenant-2',
          createdBy: 'owner-1',
        });

        await expect(
          service.updateEntryForCaller('note-1', 'entry-1', 'outsider-1', {
            content: 'Corrected content',
          }),
        ).rejects.toThrow(NotFoundException);

        expect(repository.updateEntry).not.toHaveBeenCalled();
      });
    });

    describe('deleting an entry', () => {
      it('deletes the entry and returns the refreshed note', async () => {
        repository.deleteEntry.mockResolvedValue({ id: 'note-1' });
        repository.findEntriesByNote
          .mockResolvedValueOnce([initialEntry])
          .mockResolvedValueOnce([]);

        const result = await service.deleteEntry(
          'tenant-1',
          'note-1',
          'entry-1',
          'user-1',
        );

        expect(repository.deleteEntry).toHaveBeenCalledWith(
          'tenant-1',
          'note-1',
          'entry-1',
        );
        expect(result.entries).toEqual([]);
      });

      it('returns not found when the entry does not exist', async () => {
        repository.deleteEntry.mockResolvedValue(undefined);

        await expect(
          service.deleteEntry('tenant-1', 'note-1', 'missing', 'user-1'),
        ).rejects.toThrow(NotFoundException);
      });

      it('does not delete anything for an outsider', async () => {
        await expect(
          service.deleteEntry('tenant-1', 'note-1', 'entry-1', 'outsider-1'),
        ).rejects.toThrow(NotFoundException);

        expect(repository.deleteEntry).not.toHaveBeenCalled();
      });
    });
  });

  describe('create', () => {
    it('creates a note and returns its initial dated entry', async () => {
      const note = {
        id: 'note-1',
        tenantId: 'tenant-1',
        createdBy: 'user-1',
        content: 'Discussed timeline',
        visibilityId: 'visibility-private-id',
      };
      const entries = [
        {
          id: 'entry-1',
          noteId: 'note-1',
          content: 'Discussed timeline',
          createdAt: '2026-10-12T06:00:00.000Z',
        },
      ];

      repository.create.mockResolvedValue(note);
      repository.findById.mockResolvedValue(note);
      repository.findEntriesByNote.mockResolvedValue(entries);

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
        followUpDate: undefined,
      });

      expect(result).toEqual(
        expect.objectContaining({
          id: 'note-1',
          visibility: 'visibility-private-id',
          entries,
        }),
      );
      expect(repository.findEntriesByNote).toHaveBeenCalledWith(
        'tenant-1',
        'note-1',
      );
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
      repository.findById.mockResolvedValue({
        id: 'note-1',
        tenantId: 'tenant-1',
        createdBy: 'user-1',
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

    it('rejects a direct link to an archived or unknown project', async () => {
      projectsRepository.findById.mockResolvedValue(undefined);

      await expect(
        service.create('tenant-1', 'user-1', {
          title: 'Meeting Notes',
          projectId: 'archived-project',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
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
    it('rejects oversized All requests instead of returning a truncated list', async () => {
      repository.findVisibleByTenant.mockResolvedValue({
        data: [],
        totalItems: 5001,
      });
      await expect(
        service.list('tenant-1', 'user-1', 1, 'all'),
      ).rejects.toThrow('All is limited');
    });

    it('returns every matching row in one bounded All response', async () => {
      repository.findVisibleByTenant.mockResolvedValue({
        data: [1, 2, 3].map((id) => ({
          id: String(id),
          statusId: null,
          pipelineStageId: null,
          visibilityId: null,
          priorityId: null,
        })),
        totalItems: 3,
      });
      const result = await service.list('tenant-1', 'user-1', 7, 'all');
      expect(result.data.map((item) => item.id)).toEqual(['1', '2', '3']);
      expect(result.meta).toEqual({
        page: 1,
        pageSize: 5000,
        totalItems: 3,
        totalPages: 1,
      });
      expect(repository.findVisibleByTenant).toHaveBeenCalledTimes(1);
    });

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
        undefined,
        false,
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
    it.each([
      ['sets', '2026-11-20'],
      ['clears', null],
    ] as const)(
      '%s the follow-up date without changing content',
      async (_, followUpDate) => {
        const existing = {
          id: 'note-1',
          tenantId: 'tenant-1',
          createdBy: 'user-1',
          title: 'Test note',
          content: 'Existing content',
          projectId: null,
          moduleId: null,
          visibilityId: null,
          followUpDate: '2026-04-15',
        };

        repository.findById.mockResolvedValue(existing);
        repository.update.mockResolvedValue({
          ...existing,
          followUpDate,
        });

        await service.update('tenant-1', 'note-1', 'user-1', {
          followUpDate,
        });

        expect(repository.update).toHaveBeenCalledWith(
          'tenant-1',
          'note-1',
          expect.objectContaining({ followUpDate }),
        );
        expect(repository.appendEntry).not.toHaveBeenCalled();
        expect(repository.updateEntry).not.toHaveBeenCalled();
        expect(repository.deleteEntry).not.toHaveBeenCalled();
      },
    );

    it('leaves the follow-up date unchanged when omitted', async () => {
      const existing = {
        id: 'note-1',
        tenantId: 'tenant-1',
        createdBy: 'user-1',
        title: 'Test note',
        content: 'Existing content',
        projectId: null,
        moduleId: null,
        visibilityId: null,
        followUpDate: '2026-04-15',
      };

      repository.findById.mockResolvedValue(existing);
      repository.update.mockResolvedValue({
        ...existing,
        title: 'Updated title',
      });

      await service.update('tenant-1', 'note-1', 'user-1', {
        title: 'Updated title',
      });

      expect(repository.update).toHaveBeenCalledWith(
        'tenant-1',
        'note-1',
        expect.objectContaining({
          title: 'Updated title',
          followUpDate: undefined,
        }),
      );
    });

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

  describe('paper note pins', () => {
    const existingNote = () => ({
      id: 'note-1',
      tenantId: 'tenant-1',
      createdBy: 'user-1',
      title: 'Test note',
      content: 'Existing content',
      projectId: null,
      moduleId: 'module-1',
      modulePinned: true,
      visibilityId: null,
    });

    beforeEach(() => {
      repository.findById.mockResolvedValue(existingNote());
      repository.update.mockResolvedValue(existingNote());
      modulesRepository.findById.mockImplementation(
        (_tenantId: string, moduleId: string) =>
          Promise.resolve({
            id: moduleId,
            projectId: null,
          }),
      );
    });

    it.each([true, false])('saves modulePinned=%s', async (modulePinned) => {
      await service.update('tenant-1', 'note-1', 'user-1', {
        modulePinned,
      });

      expect(repository.update).toHaveBeenCalledWith(
        'tenant-1',
        'note-1',
        expect.objectContaining({ modulePinned }),
      );
      expect(repository.appendEntry).not.toHaveBeenCalled();
      expect(repository.updateEntry).not.toHaveBeenCalled();
      expect(repository.deleteEntry).not.toHaveBeenCalled();
    });

    it('preserves the pin when editing other note details', async () => {
      await service.update('tenant-1', 'note-1', 'user-1', {
        title: 'Updated title',
      });

      expect(repository.update).toHaveBeenCalledWith(
        'tenant-1',
        'note-1',
        expect.objectContaining({
          title: 'Updated title',
          modulePinned: undefined,
        }),
      );
    });

    it('resets the pin when moving to another paper', async () => {
      await service.update('tenant-1', 'note-1', 'user-1', {
        moduleId: 'module-2',
      });

      expect(repository.update).toHaveBeenCalledWith(
        'tenant-1',
        'note-1',
        expect.objectContaining({
          moduleId: 'module-2',
          modulePinned: false,
        }),
      );
    });

    it('preserves the pin when the paper link stays the same', async () => {
      await service.update('tenant-1', 'note-1', 'user-1', {
        moduleId: 'module-1',
      });

      expect(repository.update).toHaveBeenCalledWith(
        'tenant-1',
        'note-1',
        expect.objectContaining({
          moduleId: 'module-1',
          modulePinned: undefined,
        }),
      );
    });

    it('resets the pin when unlinking from a paper', async () => {
      const input = {
        moduleId: null,
      } as unknown as Parameters<NotesService['update']>[3];

      await service.update('tenant-1', 'note-1', 'user-1', input);

      expect(repository.update).toHaveBeenCalledWith(
        'tenant-1',
        'note-1',
        expect.objectContaining({
          moduleId: null,
          modulePinned: false,
        }),
      );
    });

    it('rejects pinning a note without a linked paper', async () => {
      repository.findById.mockResolvedValue({
        ...existingNote(),
        moduleId: null,
        modulePinned: false,
      });

      await expect(
        service.update('tenant-1', 'note-1', 'user-1', {
          modulePinned: true,
        }),
      ).rejects.toThrow('Only notes linked to a paper can be pinned');

      expect(repository.update).not.toHaveBeenCalled();
    });

    it('rejects pin changes from a caller without note access', async () => {
      await expect(
        service.update('tenant-1', 'note-1', 'outsider-1', {
          modulePinned: true,
        }),
      ).rejects.toThrow(NotFoundException);

      expect(repository.update).not.toHaveBeenCalled();
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
