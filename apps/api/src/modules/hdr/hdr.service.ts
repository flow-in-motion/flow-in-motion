import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  assertAllFits,
  buildPaginationMeta,
  listPageSize,
} from '../../common/pagination';
import {
  CreateHdrPersonDto,
  ListHdrPeopleDto,
  UpdateHdrPersonDto,
} from './dto/hdr-person.dto';
import { HdrRepository } from './hdr.repository';

@Injectable()
export class HdrService {
  constructor(private readonly repository: HdrRepository) {}

  counts(tenantId: string, userId: string) {
    return this.repository.counts(tenantId, userId);
  }

  async list(tenantId: string, userId: string, query: ListHdrPeopleDto) {
    const requestedSize = query.pageSize ?? 20;
    const pageSize = listPageSize(requestedSize);
    const { data, totals, page } = await this.repository.page(
      tenantId,
      userId,
      query,
      query.page ?? 1,
      pageSize,
    );
    assertAllFits(requestedSize, totals.totalItems);
    const links = await this.repository.links(
      tenantId,
      userId,
      data.map((p) => p.id),
    );
    return {
      data: data.map((person) => this.withLinks(person, links)),
      counts: {
        currentStudents: totals.currentStudents,
        potentialStudents: totals.potentialStudents,
        visitingScholars: totals.visitingScholars,
      },
      meta: buildPaginationMeta(page, pageSize, totals.totalItems),
    };
  }

  async create(tenantId: string, userId: string, dto: CreateHdrPersonDto) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Name is required');
    this.dates(dto.startDate, dto.submissionDueDate);
    const projectIds = [...new Set(dto.projectIds ?? [])];
    const paperIds = [...new Set(dto.paperIds ?? [])];
    await this.validateLinks(tenantId, userId, projectIds, paperIds);
    const person = await this.repository.create(
      {
        tenantId,
        ownerUserId: userId,
        name,
        type: dto.type ?? 'PhD',
        category: dto.category ?? 'Current',
        email: dto.email?.trim() || null,
        researchTopic: dto.researchTopic?.trim() || null,
        supervisionType: dto.supervisionType ?? null,
        startDate: dto.startDate ?? null,
        submissionDueDate: dto.submissionDueDate ?? null,
        conferences: dto.conferences?.trim() || null,
      },
      projectIds,
      paperIds,
    );
    if (dto.initialDiscussionNote?.trim())
      await this.repository.createNote(
        tenantId,
        person.id,
        dto.initialDiscussionNote.trim(),
      );
    return this.withLinks(
      person,
      await this.repository.links(tenantId, userId, [person.id]),
    );
  }

  async update(
    tenantId: string,
    personId: string,
    userId: string,
    dto: UpdateHdrPersonDto,
  ) {
    const current = await this.owned(tenantId, personId, userId);
    this.dates(
      dto.startDate === undefined ? current.startDate : dto.startDate,
      dto.submissionDueDate === undefined
        ? current.submissionDueDate
        : dto.submissionDueDate,
    );
    if (dto.name !== undefined && !dto.name.trim())
      throw new BadRequestException('Name is required');
    const projectIds =
      dto.projectIds === undefined ? undefined : [...new Set(dto.projectIds)];
    const paperIds =
      dto.paperIds === undefined ? undefined : [...new Set(dto.paperIds)];
    await this.validateLinks(
      tenantId,
      userId,
      projectIds ?? [],
      paperIds ?? [],
    );
    const person = await this.repository.update(
      tenantId,
      personId,
      userId,
      {
        name: dto.name?.trim(),
        type: dto.type,
        supervisionType: dto.supervisionType,
        startDate: dto.startDate,
        submissionDueDate: dto.submissionDueDate,
        conferences:
          dto.conferences === undefined
            ? undefined
            : dto.conferences?.trim() || null,
        category: dto.category,
        email: dto.email === undefined ? undefined : dto.email?.trim() || null,
        researchTopic:
          dto.researchTopic === undefined
            ? undefined
            : dto.researchTopic?.trim() || null,
      },
      projectIds,
      paperIds,
    );
    if (!person) throw new NotFoundException('HDR record not found');
    return this.withLinks(
      person,
      await this.repository.links(tenantId, userId, [person.id]),
    );
  }

  async remove(tenantId: string, personId: string, userId: string) {
    if (!(await this.repository.remove(tenantId, personId, userId)))
      throw new NotFoundException('HDR record not found');
    return { message: 'HDR record deleted' };
  }

  private dates(start?: string | null, due?: string | null) {
    if (start && due && due < start)
      throw new BadRequestException(
        'Submission due date cannot be before the start date',
      );
  }

  private async owned(tenantId: string, personId: string, userId: string) {
    const person = await this.repository.findOwned(tenantId, personId, userId);
    if (!person) throw new NotFoundException('HDR record not found');
    return person;
  }

  async notes(tenantId: string, personId: string, userId: string) {
    await this.owned(tenantId, personId, userId);
    return this.repository.notes(tenantId, personId);
  }

  async saveNote(
    tenantId: string,
    personId: string,
    userId: string,
    content: string,
    noteId?: string,
  ) {
    await this.owned(tenantId, personId, userId);
    if (!content.trim()) throw new BadRequestException('Note cannot be blank');
    const note = noteId
      ? await this.repository.updateNote(
          tenantId,
          personId,
          noteId,
          content.trim(),
        )
      : await this.repository.createNote(tenantId, personId, content.trim());
    if (!note) throw new NotFoundException('Note not found');
    return note;
  }

  async removeNote(
    tenantId: string,
    personId: string,
    userId: string,
    noteId: string,
  ) {
    await this.owned(tenantId, personId, userId);
    if (!(await this.repository.removeNote(tenantId, personId, noteId)))
      throw new NotFoundException('Note not found');
    return { message: 'Note deleted' };
  }

  private async validateLinks(
    tenantId: string,
    userId: string,
    projectIds: string[],
    paperIds: string[],
  ) {
    const [validProjects, validPapers] = await Promise.all([
      this.repository.validProjects(tenantId, userId, projectIds),
      this.repository.validPapers(tenantId, userId, paperIds),
    ]);
    if (
      validProjects.length !== projectIds.length ||
      validPapers.length !== paperIds.length
    )
      throw new ForbiddenException(
        'A selected project or paper is unavailable or inaccessible',
      );
  }

  private withLinks<T extends { id: string }>(
    person: T,
    links: Awaited<ReturnType<HdrRepository['links']>>,
  ) {
    return {
      ...person,
      projects: links.projects
        .filter((p) => p.personId === person.id)
        .map(({ personId: _personId, ...project }) => project),
      papers: links.papers
        .filter((p) => p.personId === person.id)
        .map(({ personId: _personId, ...paper }) => paper),
    };
  }
}
