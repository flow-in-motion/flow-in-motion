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
      },
      projectIds,
      paperIds,
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
    if (!(await this.repository.findOwned(tenantId, personId, userId)))
      throw new NotFoundException('HDR record not found');
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
