import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReviewsRepository } from './reviews.repository';
import { ReviewsService } from './reviews.service';
import { ReviewKind } from './dto/review.dto';

describe('Private reviews service', () => {
  let service: ReviewsService;
  let repo: Record<
    | 'page'
    | 'findOwned'
    | 'create'
    | 'update'
    | 'remove'
    | 'notes'
    | 'createNote'
    | 'updateNote'
    | 'removeNote',
    jest.Mock
  >;
  beforeEach(() => {
    repo = Object.fromEntries(
      [
        'page',
        'findOwned',
        'create',
        'update',
        'remove',
        'notes',
        'createNote',
        'updateNote',
        'removeNote',
      ].map((key) => [key, jest.fn()]),
    ) as typeof repo;
    repo.findOwned.mockResolvedValue({
      id: 'record',
      requestedOn: '2027-01-15',
      dueOn: '2027-02-15',
    });
    repo.create.mockResolvedValue({ id: 'record' });
    repo.update.mockResolvedValue({ id: 'record' });
    repo.notes.mockResolvedValue([]);
    repo.createNote.mockResolvedValue({ id: 'note' });
    service = new ReviewsService(repo as unknown as ReviewsRepository);
  });
  it('creates two independent kinds with caller ownership and only submitted fields', async () => {
    await service.create('workspace', 'owner', ReviewKind.Examination, {
      studentName: ' Student ',
    });
    expect(repo.create).toHaveBeenLastCalledWith({
      kind: 'examination',
      tenantId: 'workspace',
      ownerUserId: 'owner',
      studentName: 'Student',
    });
    await service.create('workspace', 'owner', ReviewKind.Journal, {
      manuscriptTitle: ' Manuscript ',
      journalRanking: ' A* ',
      initialNote: ' Initial note ',
    });
    expect(repo.create).toHaveBeenLastCalledWith({
      kind: 'journal',
      tenantId: 'workspace',
      ownerUserId: 'owner',
      manuscriptTitle: 'Manuscript',
      journalRanking: 'A*',
    });
    expect(repo.createNote).toHaveBeenCalledWith(
      'workspace',
      'record',
      'Initial note',
    );
  });
  it('does not create empty notes and refuses blank required fields', async () => {
    await service.create('w', 'u', ReviewKind.Examination, {
      studentName: 'Student',
      initialNote: '   ',
    });
    expect(repo.createNote).not.toHaveBeenCalled();
    await expect(
      service.create('w', 'u', ReviewKind.Journal, { manuscriptTitle: ' ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('retains omitted fields, clears explicit optional fields and checks merged dates on partial edits', async () => {
    await service.update('w', 'u', ReviewKind.Examination, 'r', { fee: null });
    expect(repo.update).toHaveBeenLastCalledWith('w', 'u', 'examination', 'r', {
      fee: null,
    });
    await expect(
      service.update('w', 'u', ReviewKind.Examination, 'r', {
        requestedOn: '2027-03-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await service.update('w', 'u', ReviewKind.Examination, 'r', {
      requestedOn: null,
      dueOn: '2027-01-01',
    });
  });
  it('returns not found for missing, wrong-kind or other-owner records before reading or writing notes', async () => {
    repo.findOwned.mockResolvedValue(undefined);
    await expect(
      service.detail('w', 'u', ReviewKind.Journal, 'foreign'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.saveNote('w', 'u', ReviewKind.Examination, 'foreign', 'Note'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.removeNote('w', 'u', ReviewKind.Examination, 'foreign', 'note'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.notes).not.toHaveBeenCalled();
    expect(repo.createNote).not.toHaveBeenCalled();
    expect(repo.removeNote).not.toHaveBeenCalled();
  });
  it('keeps note editing scoped to its parent and preserves metadata', async () => {
    repo.updateNote.mockResolvedValue({ id: 'note' });
    await service.saveNote(
      'w',
      'u',
      ReviewKind.Journal,
      'record',
      ' Updated\nnote ',
      'note',
    );
    expect(repo.updateNote).toHaveBeenCalledWith(
      'w',
      'record',
      'note',
      'Updated\nnote',
    );
    expect(repo.update).not.toHaveBeenCalled();
    repo.updateNote.mockResolvedValue(undefined);
    await expect(
      service.saveNote(
        'w',
        'u',
        ReviewKind.Journal,
        'record',
        'Text',
        'wrong-parent-note',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
  it('uses server pagination and a server-wide total', async () => {
    repo.page.mockResolvedValue({
      data: [{ id: 'twenty-fourth' }],
      totalItems: 24,
      page: 2,
    });
    const result = await service.list('w', 'u', ReviewKind.Journal, {
      page: 2,
      pageSize: 20,
      search: 'title',
    });
    expect(repo.page).toHaveBeenCalledWith('w', 'u', 'journal', 'title', 2, 20);
    expect(result.meta).toEqual({
      page: 2,
      pageSize: 20,
      totalItems: 24,
      totalPages: 2,
    });
    repo.page.mockResolvedValue({ data: [], totalItems: 5001, page: 1 });
    await expect(
      service.list('w', 'u', ReviewKind.Journal, { pageSize: 'all' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('does not report successful deletion for another user or kind', async () => {
    repo.remove.mockResolvedValue(undefined);
    await expect(
      service.remove('w', 'u', ReviewKind.Examination, 'r'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.remove).toHaveBeenCalledWith('w', 'u', 'examination', 'r');
  });
});
