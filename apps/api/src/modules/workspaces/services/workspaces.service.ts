import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  tenantMemberships,
  tenants,
  workspaceContexts,
} from '@research-tracker/migrations';
import { DrizzleService } from '../../../db/drizzle.service';
import { WorkspacesRepository } from '../repositories/workspaces.repository';
import {
  buildPaginationMeta,
  paginationOffset,
} from '../../../common/pagination';
import { ProjectsService } from '../../projects/services/projects.service';

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly repository: WorkspacesRepository,
    private readonly drizzle: DrizzleService,
    private readonly projectsService: ProjectsService,
  ) {}

  async createWorkspace(ownerUserId: string, name: string) {
    const slug = `${slugify(name)}-${Date.now()}`;

    const [tenant] = await this.drizzle.db
      .insert(tenants)
      .values({
        name,
        slug,
        ownerUserId,
        status: 'active',
      })
      .returning();

    if (!tenant) {
      throw new ConflictException('Failed to create workspace');
    }

    await this.drizzle.db.insert(tenantMemberships).values({
      tenantId: tenant.id,
      userId: ownerUserId,
      role: 'owner',
      status: 'active',
      invitedAt: new Date(),
      joinedAt: new Date(),
    });

    await this.drizzle.db
      .insert(workspaceContexts)
      .values({
        userId: ownerUserId,
        tenantId: tenant.id,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: workspaceContexts.userId,
        set: { tenantId: tenant.id, updatedAt: new Date() },
      });
    await this.projectsService.create(
      ownerUserId,
      tenant.id,
      { title: 'General', status: 'Active' },
      { isGeneral: true },
    );
    return { ...tenant, membershipRole: 'owner' as const };
  }

  async listWorkspaces(userId: string, page: number, pageSize: number) {
    const offset = paginationOffset(page, pageSize);

    const { data, totalItems } = await this.repository.findPageByMemberUserId(
      userId,
      offset,
      pageSize,
    );

    return {
      data,
      meta: buildPaginationMeta(page, pageSize, totalItems),
    };
  }

  async getCurrentWorkspace(userId: string) {
    const current = await this.repository.findCurrentByUserId(userId);
    if (current) {
      return current;
    }

    const [fallback] = await this.repository.findAllByMemberUserId(userId);
    if (!fallback) {
      throw new NotFoundException('You do not belong to any workspace yet');
    }

    await this.repository.setCurrentWorkspace(userId, fallback.id);
    return fallback;
  }

  async switchCurrentWorkspace(userId: string, tenantId: string) {
    const workspace = await this.repository.findWorkspaceForMember(
      userId,
      tenantId,
    );
    if (!workspace) {
      throw new NotFoundException('Workspace is unavailable to this user');
    }

    await this.repository.setCurrentWorkspace(userId, tenantId);
    return workspace;
  }

  async deleteWorkspace(userId: string, tenantId: string) {
    const deleted = await this.repository.deleteById(tenantId, userId);
    if (!deleted) {
      throw new NotFoundException(
        'Workspace not found, or you are not its owner',
      );
    }
    return deleted;
  }
}
