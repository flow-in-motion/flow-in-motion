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
  paginationOffset,
} from '../../../common/pagination';
import { CreateFundingDto } from '../dto/create-funding.dto';
import type {
  FundingSortDirection,
  FundingSortField,
} from '../dto/list-fundings-query.dto';
import { UpdateFundingDto } from '../dto/update-funding.dto';
import { FundingsRepository } from '../repositories/fundings.repository';

@Injectable()
export class FundingsService {
  constructor(private readonly repository: FundingsRepository) {}

  async list(
    tenantId: string,
    callerUserId: string,
    page: number,
    requestedPageSize: number | 'all',
    search?: string,
    sortBy?: FundingSortField,
    sortDirection?: FundingSortDirection,
  ) {
    const pageSize = listPageSize(requestedPageSize);
    const { data, totalItems } = await this.repository.findVisiblePageByUser(
      tenantId,
      callerUserId,
      paginationOffset(page, pageSize),
      pageSize,
      search,
      sortBy,
      sortDirection,
    );
    assertAllFits(requestedPageSize, totalItems);

    const { projectsByFunding, modulesByFunding } =
      await this.repository.findLinksForFundings(
        tenantId,
        data.map((funding) => funding.id),
      );

    return {
      data: data.map((funding) => ({
        ...funding,
        description: funding.notes,
        projects: projectsByFunding.get(funding.id) ?? [],
        papers: modulesByFunding.get(funding.id) ?? [],
      })),
      meta: buildPaginationMeta(page, pageSize, totalItems),
    };
  }

  async findOne(tenantId: string, fundingId: string, callerUserId: string) {
    const funding = await this.repository.findVisibleById(
      tenantId,
      fundingId,
      callerUserId,
    );
    if (!funding) throw new NotFoundException('Funding record not found');
    return this.withLinks(tenantId, funding, callerUserId, true);
  }

  async create(
    tenantId: string,
    callerUserId: string,
    input: CreateFundingDto,
  ) {
    const fundingBody = input.fundingBody.trim();
    if (!fundingBody) {
      throw new BadRequestException('Funding body is required');
    }
    const projectIds = [...new Set(input.projectIds)];
    const moduleIds = [...new Set(input.moduleIds)];
    await this.validateLinks(tenantId, projectIds, moduleIds, callerUserId);

    const funding = await this.repository.create(
      {
        tenantId,
        ownerUserId: callerUserId,
        fundingBody,
        scheme: trimOptional(input.scheme) ?? null,
        partners: trimOptional(input.partners) ?? null,
        amount: trimOptional(input.amount) ?? null,
        currency: trimOptional(input.currency)?.toUpperCase() ?? null,
        applicationDeadline: input.applicationDeadline ?? null,
        followUpDate: input.followUpDate ?? null,
        status: input.status ?? null,
        notes: trimOptional(input.description ?? input.notes) ?? null,
      },
      projectIds,
      moduleIds,
    );
    if (!funding)
      throw new NotFoundException('Failed to create funding record');
    return this.withLinks(tenantId, funding);
  }

  async update(
    tenantId: string,
    fundingId: string,
    callerUserId: string,
    input: UpdateFundingDto,
  ) {
    const existing = await this.repository.findVisibleById(
      tenantId,
      fundingId,
      callerUserId,
    );
    if (!existing) throw new NotFoundException('Funding record not found');
    if (existing.ownerUserId !== callerUserId) {
      throw new ForbiddenException(
        'Only the funding owner can update this record',
      );
    }
    if (input.fundingBody !== undefined && !input.fundingBody.trim()) {
      throw new BadRequestException('Funding body is required');
    }

    const projectIds = input.projectIds
      ? [...new Set(input.projectIds)]
      : undefined;
    const moduleIds = input.moduleIds
      ? [...new Set(input.moduleIds)]
      : undefined;
    await this.validateLinks(
      tenantId,
      projectIds ?? [],
      moduleIds ?? [],
      callerUserId,
    );

    const funding = await this.repository.update(
      tenantId,
      fundingId,
      {
        fundingBody: input.fundingBody?.trim(),
        scheme: trimOptional(input.scheme),
        partners: trimOptional(input.partners),
        amount: trimOptional(input.amount),
        currency: trimOptional(input.currency)?.toUpperCase(),
        applicationDeadline: input.applicationDeadline,
        followUpDate: input.followUpDate,
        status: input.status,
        notes: trimOptional(input.description ?? input.notes),
      },
      projectIds,
      moduleIds,
    );
    if (!funding) throw new NotFoundException('Funding record not found');
    return this.withLinks(tenantId, funding, callerUserId, true);
  }

  async remove(tenantId: string, fundingId: string, callerUserId: string) {
    const existing = await this.repository.findVisibleById(
      tenantId,
      fundingId,
      callerUserId,
    );
    if (!existing) throw new NotFoundException('Funding record not found');
    if (existing.ownerUserId !== callerUserId) {
      throw new ForbiddenException(
        'Only the funding owner can delete this record',
      );
    }
    const funding = await this.repository.remove(tenantId, fundingId);
    if (!funding) throw new NotFoundException('Funding record not found');
    return { message: 'Funding record deleted successfully', funding };
  }

  async attachNote(
    tenantId: string,
    fundingId: string,
    noteId: string,
    callerUserId: string,
  ) {
    await this.requireOwner(tenantId, fundingId, callerUserId);
    const note = await this.repository.findAccessibleNoteById(
      tenantId,
      noteId,
      callerUserId,
    );
    if (!note)
      throw new ForbiddenException('The selected note is inaccessible');
    await this.repository.attachNote(tenantId, fundingId, noteId);
    return this.findOne(tenantId, fundingId, callerUserId);
  }

  async detachNote(
    tenantId: string,
    fundingId: string,
    noteId: string,
    callerUserId: string,
  ) {
    await this.requireOwner(tenantId, fundingId, callerUserId);
    await this.repository.detachNote(tenantId, fundingId, noteId);
    return this.findOne(tenantId, fundingId, callerUserId);
  }

  async attachTask(
    tenantId: string,
    fundingId: string,
    taskId: string,
    callerUserId: string,
  ) {
    await this.requireOwner(tenantId, fundingId, callerUserId);
    const task = await this.repository.findAccessibleTaskById(
      tenantId,
      taskId,
      callerUserId,
    );
    if (!task)
      throw new ForbiddenException('The selected task is inaccessible');
    await this.repository.attachTask(tenantId, fundingId, taskId);
    return this.findOne(tenantId, fundingId, callerUserId);
  }

  async detachTask(
    tenantId: string,
    fundingId: string,
    taskId: string,
    callerUserId: string,
  ) {
    await this.requireOwner(tenantId, fundingId, callerUserId);
    await this.repository.detachTask(tenantId, fundingId, taskId);
    return this.findOne(tenantId, fundingId, callerUserId);
  }

  private async validateLinks(
    tenantId: string,
    projectIds: string[],
    moduleIds: string[],
    callerUserId: string,
  ) {
    const [projects, modules] = await Promise.all([
      this.repository.findAccessibleProjectsByIds(
        tenantId,
        projectIds,
        callerUserId,
      ),
      this.repository.findAccessibleModulesByIds(
        tenantId,
        moduleIds,
        callerUserId,
      ),
    ]);
    if (projects.length !== projectIds.length) {
      throw new ForbiddenException(
        'One or more selected projects are unavailable or inaccessible',
      );
    }
    if (modules.length !== moduleIds.length) {
      throw new ForbiddenException(
        'One or more selected papers are unavailable or inaccessible',
      );
    }
  }

  private async withLinks<T extends { id: string; notes?: string | null }>(
    tenantId: string,
    funding: T,
    callerUserId?: string,
    includeActivity = false,
  ) {
    const [projects, papers, linkedNotes, linkedTasks] = await Promise.all([
      this.repository.findLinkedProjects(tenantId, funding.id),
      this.repository.findLinkedModules(tenantId, funding.id),
      includeActivity && callerUserId
        ? this.repository.findLinkedNotes(tenantId, funding.id, callerUserId)
        : Promise.resolve([]),
      includeActivity && callerUserId
        ? this.repository.findLinkedTasks(tenantId, funding.id, callerUserId)
        : Promise.resolve([]),
    ]);
    return {
      ...funding,
      description: funding.notes ?? null,
      projects,
      papers,
      linkedNotes,
      tasks: linkedTasks,
    };
  }

  private async requireOwner(
    tenantId: string,
    fundingId: string,
    callerUserId: string,
  ) {
    const funding = await this.repository.findVisibleById(
      tenantId,
      fundingId,
      callerUserId,
    );
    if (!funding) throw new NotFoundException('Funding record not found');
    if (funding.ownerUserId !== callerUserId) {
      throw new ForbiddenException(
        'Only the funding owner can manage linked notes and tasks',
      );
    }
    return funding;
  }
}

function trimOptional(value: string | null | undefined) {
  if (value === undefined) return undefined;
  return value?.trim() || null;
}
