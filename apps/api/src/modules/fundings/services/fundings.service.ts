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
  ) {
    const pageSize = listPageSize(requestedPageSize);
    const { data, totalItems } = await this.repository.findVisiblePageByUser(
      tenantId,
      callerUserId,
      paginationOffset(page, pageSize),
      pageSize,
      search,
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
    return this.withLinks(tenantId, funding);
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
        status: input.status ?? null,
        notes: trimOptional(input.notes) ?? null,
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
        status: input.status,
        notes: trimOptional(input.notes),
      },
      projectIds,
      moduleIds,
    );
    if (!funding) throw new NotFoundException('Funding record not found');
    return this.withLinks(tenantId, funding);
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

  private async withLinks<T extends { id: string }>(
    tenantId: string,
    funding: T,
  ) {
    const [projects, papers] = await Promise.all([
      this.repository.findLinkedProjects(tenantId, funding.id),
      this.repository.findLinkedModules(tenantId, funding.id),
    ]);
    return { ...funding, projects, papers };
  }
}

function trimOptional(value: string | null | undefined) {
  if (value === undefined) return undefined;
  return value?.trim() || null;
}
