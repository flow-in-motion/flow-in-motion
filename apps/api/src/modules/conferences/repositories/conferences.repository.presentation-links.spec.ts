import { ConflictException } from '@nestjs/common';

import { DrizzleService } from '../../../db/drizzle.service';
import { ConferencesRepository } from './conferences.repository';

interface LinkFixture {
  moduleId: string;
  presentedDate: string | null;
  presentationType: string | null;
  paperTitle: string | null;
  abstract: string | null;
  notes: string | null;
}

function makeLink(
  moduleId: string,
  presentedDate: string | null = null,
): LinkFixture {
  return {
    moduleId,
    presentedDate,
    presentationType: null,
    paperTitle: null,
    abstract: null,
    notes: null,
  };
}

function setup(existingLinks: LinkFixture[]) {
  const returning = jest.fn().mockResolvedValue([{ id: 'conference-1' }]);
  const updateWhere = jest.fn().mockReturnValue({ returning });
  const set = jest.fn().mockReturnValue({ where: updateWhere });

  const lock = jest.fn().mockResolvedValue(existingLinks);
  const selectWhere = jest.fn().mockReturnValue({ for: lock });
  const from = jest.fn().mockReturnValue({ where: selectWhere });

  const deleteWhere = jest.fn().mockResolvedValue([]);
  const onConflictDoNothing = jest.fn().mockResolvedValue([]);
  const values = jest.fn().mockReturnValue({ onConflictDoNothing });

  const db = {
    update: jest.fn().mockReturnValue({ set }),
    select: jest.fn().mockReturnValue({ from }),
    delete: jest.fn().mockReturnValue({ where: deleteWhere }),
    insert: jest.fn().mockReturnValue({ values }),
  };

  const repository = new ConferencesRepository({
    db,
  } as unknown as DrizzleService);

  return { repository, db, values };
}

describe('conference paper-link updates', () => {
  it('preserves existing presentation links when saving the same papers', async () => {
    const { repository, db } = setup([makeLink('paper-1', '2026-10-01')]);

    await repository.update(
      'tenant-1',
      'conference-1',
      { name: 'Updated conference' },
      undefined,
      ['paper-1'],
    );

    expect(db.delete).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('inserts only newly selected papers', async () => {
    const { repository, db, values } = setup([
      makeLink('paper-1', '2026-10-01'),
    ]);

    await repository.update('tenant-1', 'conference-1', {}, undefined, [
      'paper-1',
      'paper-2',
      'paper-2',
    ]);

    expect(db.delete).not.toHaveBeenCalled();
    expect(values).toHaveBeenCalledWith([
      {
        tenantId: 'tenant-1',
        conferenceId: 'conference-1',
        moduleId: 'paper-2',
      },
    ]);
  });

  it('prevents unlinking papers with recorded presentation details', async () => {
    const { repository, db } = setup([makeLink('paper-1', '2026-10-01')]);

    await expect(
      repository.update('tenant-1', 'conference-1', {}, undefined, []),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(db.delete).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('also protects abstract-only presentation details', async () => {
    const { repository, db } = setup([
      { ...makeLink('paper-1'), abstract: 'Our submitted abstract' },
    ]);

    await expect(
      repository.update('tenant-1', 'conference-1', {}, undefined, []),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(db.delete).not.toHaveBeenCalled();
  });

  it('allows unlinking planned papers without presentation details', async () => {
    const { repository, db } = setup([makeLink('paper-1')]);

    await repository.update('tenant-1', 'conference-1', {}, undefined, []);

    expect(db.delete).toHaveBeenCalledTimes(1);
    expect(db.insert).not.toHaveBeenCalled();
  });
});
