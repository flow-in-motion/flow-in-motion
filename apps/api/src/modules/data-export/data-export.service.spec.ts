import { InternalServerErrorException } from '@nestjs/common';
import { DataExportRepository } from './data-export.repository';
import { DataExportService } from './data-export.service';
import {
  EXPORT_COLLECTIONS,
  type ExportCollections,
} from './data-export.types';

describe('DataExportService', () => {
  function setup() {
    const collections: ExportCollections = {
      projects: [],
      papers: [],
      tasks: [],
      taskDescriptionEntries: [],
      notes: [],
      noteEntries: [],
      journalSubmissions: [],
      conferences: [],
      conferenceProjects: [],
      conferencePapers: [],
      fundings: [],
      fundingProjects: [],
      fundingPapers: [],
      fundingNotes: [],
      fundingTasks: [],
      calendarEvents: [],
      referenceValues: [],
    };

    const repository = {
      readResearchData: jest.fn().mockResolvedValue(collections),
    };
    const service = new DataExportService(
      repository as unknown as DataExportRepository,
    );

    return { collections, repository, service };
  }

  it('preserves complete records and histories and reports their counts', async () => {
    const { collections, repository, service } = setup();

    collections.tasks = Array.from({ length: 25 }, (_, index) => ({
      id: `task-${index}`,
      title: `Task ${index}`,
    }));
    collections.notes = [
      {
        id: 'note-1',
        title: 'Research notes',
        content: 'Latest update\n\nOriginal entry',
      },
    ];
    collections.noteEntries = [
      {
        id: 'entry-2',
        note_id: 'note-1',
        content: 'Latest update',
        created_at: '2026-10-23T01:00:00.000Z',
      },
      {
        id: 'entry-1',
        note_id: 'note-1',
        content: 'Original entry',
        created_at: '2026-10-22T01:00:00.000Z',
      },
    ];
    collections.papers = [
      {
        id: 'paper-1',
        archived_at: '2026-10-23T02:00:00.000Z',
      },
    ];

    const result = await service.exportForCaller('user-1');

    expect(repository.readResearchData).toHaveBeenCalledWith('user-1');
    expect(result.collections).toEqual(collections);
    expect(result.counts.tasks).toBe(25);
    expect(result.counts.notes).toBe(1);
    expect(result.counts.noteEntries).toBe(2);
    expect(result.counts.papers).toBe(1);
    expect(result.counts.conferences).toBe(0);
    expect(result.includesRetainedArchivedRecords).toBe(true);
    expect(Number.isNaN(Date.parse(result.exportedAt))).toBe(false);
  });

  it('returns zero counts for an empty account', async () => {
    const { service } = setup();

    const result = await service.exportForCaller('user-1');

    for (const collection of EXPORT_COLLECTIONS) {
      expect(result.collections[collection]).toEqual([]);
      expect(result.counts[collection]).toBe(0);
    }
  });

  it('fails rather than returning an incomplete export structure', async () => {
    const { collections, service } = setup();
    Reflect.deleteProperty(collections, 'noteEntries');

    await expect(service.exportForCaller('user-1')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
