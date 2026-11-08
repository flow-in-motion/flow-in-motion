import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import {
  assertAllFits,
  buildPaginationMeta,
  listPageSize,
} from '../../common/pagination';
import {
  CreateExaminationDto,
  CreateJournalReviewDto,
  ReviewKind,
  UpdateExaminationDto,
  UpdateJournalReviewDto,
} from './dto/review.dto';
import { ReviewsRepository, ReviewUpdate } from './reviews.repository';

const commonFields = ['requestedOn', 'dueOn'] as const;
const examFields = [
  'studentName',
  'studentNumber',
  'supervisorName1',
  'supervisorName2',
  'universityName',
  'school',
  'country',
  'thesisTitle',
  'degreeType',
  'fee',
  'abstract',
] as const;
const journalFields = [
  'journalName',
  'manuscriptReference',
  'manuscriptTitle',
  'journalRanking',
] as const;

@Injectable()
export class ReviewsService {
  constructor(private readonly repository: ReviewsRepository) {}

  async list(
    tenantId: string,
    userId: string,
    kind: ReviewKind,
    query: PaginationQueryDto,
  ) {
    const requestedSize = query.pageSize ?? 20;
    const size = listPageSize(requestedSize);
    const result = await this.repository.page(
      tenantId,
      userId,
      kind,
      query.search,
      query.page ?? 1,
      size,
    );
    assertAllFits(requestedSize, result.totalItems);
    return {
      data: result.data,
      meta: buildPaginationMeta(result.page, size, result.totalItems),
    };
  }
  private async owned(
    tenantId: string,
    userId: string,
    kind: ReviewKind,
    id: string,
  ) {
    const row = await this.repository.findOwned(tenantId, userId, kind, id);
    if (!row) throw new NotFoundException('Review record not found');
    return row;
  }
  async detail(tenantId: string, userId: string, kind: ReviewKind, id: string) {
    const row = await this.owned(tenantId, userId, kind, id);
    return { ...row, notes: await this.repository.notes(tenantId, id) };
  }

  private values(kind: ReviewKind, input: object): ReviewUpdate {
    const source = input as Record<string, unknown>;
    const fields = [
      ...commonFields,
      ...(kind === ReviewKind.Examination ? examFields : journalFields),
    ];
    const output = Object.fromEntries(
      fields
        .filter((key) => source[key] !== undefined)
        .map((key) => [
          key,
          typeof source[key] === 'string'
            ? source[key].trim() || null
            : source[key],
        ]),
    ) as ReviewUpdate;
    const required =
      kind === ReviewKind.Examination ? 'studentName' : 'manuscriptTitle';
    if (source[required] !== undefined && !output[required])
      throw new BadRequestException(
        kind === ReviewKind.Examination
          ? 'Student name is required'
          : 'Manuscript title is required',
      );
    return output;
  }
  private dates(
    requestedOn: string | null | undefined,
    dueOn: string | null | undefined,
  ) {
    if (requestedOn && dueOn && dueOn < requestedOn)
      throw new BadRequestException(
        'Due date cannot be before the date request received',
      );
  }
  async create(
    tenantId: string,
    userId: string,
    kind: ReviewKind,
    dto: CreateExaminationDto | CreateJournalReviewDto,
  ) {
    const values = this.values(kind, dto);
    if (
      !(kind === ReviewKind.Examination
        ? values.studentName
        : values.manuscriptTitle)
    )
      throw new BadRequestException('A name or title is required');
    this.dates(values.requestedOn, values.dueOn);
    // The existing request transaction covers the parent and optional initial note.
    const row = await this.repository.create({
      ...values,
      tenantId,
      ownerUserId: userId,
      kind,
    });
    const initialNote = dto.initialNote?.trim();
    if (initialNote)
      await this.repository.createNote(tenantId, row.id, initialNote);
    return row;
  }
  async update(
    tenantId: string,
    userId: string,
    kind: ReviewKind,
    id: string,
    dto: UpdateExaminationDto | UpdateJournalReviewDto,
  ) {
    const current = await this.owned(tenantId, userId, kind, id);
    const values = this.values(kind, dto);
    this.dates(
      values.requestedOn === undefined
        ? current.requestedOn
        : values.requestedOn,
      values.dueOn === undefined ? current.dueOn : values.dueOn,
    );
    const row = await this.repository.update(
      tenantId,
      userId,
      kind,
      id,
      values,
    );
    if (!row) throw new NotFoundException('Review record not found');
    return row;
  }
  async remove(tenantId: string, userId: string, kind: ReviewKind, id: string) {
    if (!(await this.repository.remove(tenantId, userId, kind, id)))
      throw new NotFoundException('Review record not found');
    return { message: 'Review record deleted' };
  }
  async saveNote(
    tenantId: string,
    userId: string,
    kind: ReviewKind,
    id: string,
    content: string,
    noteId?: string,
  ) {
    await this.owned(tenantId, userId, kind, id);
    if (!content.trim()) throw new BadRequestException('Note cannot be blank');
    const note = noteId
      ? await this.repository.updateNote(tenantId, id, noteId, content.trim())
      : await this.repository.createNote(tenantId, id, content.trim());
    if (!note) throw new NotFoundException('Note not found');
    return note;
  }
  async removeNote(
    tenantId: string,
    userId: string,
    kind: ReviewKind,
    id: string,
    noteId: string,
  ) {
    await this.owned(tenantId, userId, kind, id);
    if (!(await this.repository.removeNote(tenantId, id, noteId)))
      throw new NotFoundException('Note not found');
    return { message: 'Note deleted' };
  }
}
