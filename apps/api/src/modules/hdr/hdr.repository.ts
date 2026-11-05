import { Injectable } from '@nestjs/common';
import {
  hdrPapers,
  hdrPeople,
  hdrProjects,
  modules,
  projects,
} from '@research-tracker/migrations';
import { and, asc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { DrizzleService } from '../../db/drizzle.service';
import { searchPattern } from '../../common/pagination';
import { ListHdrPeopleDto } from './dto/hdr-person.dto';

type PersonValues = typeof hdrPeople.$inferInsert;
type PersonUpdate = Partial<
  Pick<PersonValues, 'name' | 'type' | 'category' | 'email' | 'researchTopic'>
>;

@Injectable()
export class HdrRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  private owned(tenantId: string, userId: string) {
    return and(
      eq(hdrPeople.tenantId, tenantId),
      eq(hdrPeople.ownerUserId, userId),
    );
  }

  private visibleProject(tenantId: string, userId: string) {
    return and(
      eq(projects.tenantId, tenantId),
      isNull(projects.archivedAt),
      or(
        eq(projects.userId, userId),
        sql<boolean>`public.is_project_collaborator(${projects.id}, ${userId}::uuid)`,
      ),
    );
  }

  private visiblePaper(tenantId: string, userId: string) {
    return and(
      eq(modules.tenantId, tenantId),
      isNull(modules.archivedAt),
      sql<boolean>`(${modules.projectId} IS NULL OR EXISTS (
        SELECT 1 FROM public.projects p WHERE p.id = ${modules.projectId}
          AND p.tenant_id = ${modules.tenantId} AND p.archived_at IS NULL
      ))`,
      sql<boolean>`public.check_module_access(${modules.tenantId}, ${modules.id}, ${userId}::uuid)`,
    );
  }

  async page(
    tenantId: string,
    userId: string,
    query: ListHdrPeopleDto,
    page: number,
    pageSize: number,
  ) {
    const filters = and(
      query.type ? eq(hdrPeople.type, query.type) : undefined,
      query.category ? eq(hdrPeople.category, query.category) : undefined,
      query.search?.trim()
        ? or(
            ilike(hdrPeople.name, searchPattern(query.search.trim())),
            ilike(hdrPeople.email, searchPattern(query.search.trim())),
            ilike(hdrPeople.researchTopic, searchPattern(query.search.trim())),
          )
        : undefined,
    );
    const [totals] = await this.drizzle.db
      .select({
        totalItems: sql<number>`count(*) FILTER (WHERE ${filters ?? sql`true`})::int`,
        currentStudents: sql<number>`count(*) FILTER (WHERE ${hdrPeople.type} <> 'Visiting scholar' AND ${hdrPeople.category} = 'Current')::int`,
        potentialStudents: sql<number>`count(*) FILTER (WHERE ${hdrPeople.type} <> 'Visiting scholar' AND ${hdrPeople.category} = 'Potential')::int`,
        visitingScholars: sql<number>`count(*) FILTER (WHERE ${hdrPeople.type} = 'Visiting scholar')::int`,
      })
      .from(hdrPeople)
      .where(this.owned(tenantId, userId));
    if (!totals) throw new Error('HDR totals could not be loaded');
    // Clamp after deletions and filter changes; counts always span every page.
    const safePage = Math.min(
      page,
      Math.max(1, Math.ceil(totals.totalItems / pageSize)),
    );
    const data = await this.drizzle.db
      .select()
      .from(hdrPeople)
      .where(and(this.owned(tenantId, userId), filters))
      .orderBy(asc(hdrPeople.name), asc(hdrPeople.id))
      .offset((safePage - 1) * pageSize)
      .limit(pageSize);
    return { data, totals, page: safePage };
  }

  async findOwned(tenantId: string, personId: string, userId: string) {
    const [person] = await this.drizzle.db
      .select()
      .from(hdrPeople)
      .where(and(this.owned(tenantId, userId), eq(hdrPeople.id, personId)));
    return person;
  }

  async validProjects(tenantId: string, userId: string, ids: string[]) {
    if (!ids.length) return [];
    return this.drizzle.db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(this.visibleProject(tenantId, userId), inArray(projects.id, ids)),
      );
  }

  async validPapers(tenantId: string, userId: string, ids: string[]) {
    if (!ids.length) return [];
    return this.drizzle.db
      .select({ id: modules.id })
      .from(modules)
      .where(
        and(this.visiblePaper(tenantId, userId), inArray(modules.id, ids)),
      );
  }

  async links(tenantId: string, userId: string, personIds: string[]) {
    if (!personIds.length) return { projects: [], papers: [] };
    const [projectRows, paperRows] = await Promise.all([
      this.drizzle.db
        .select({
          personId: hdrProjects.personId,
          id: projects.id,
          title: projects.title,
        })
        .from(hdrProjects)
        .innerJoin(projects, eq(projects.id, hdrProjects.projectId))
        .innerJoin(hdrPeople, eq(hdrPeople.id, hdrProjects.personId))
        .where(
          and(
            this.owned(tenantId, userId),
            eq(hdrProjects.tenantId, tenantId),
            inArray(hdrProjects.personId, personIds),
            this.visibleProject(tenantId, userId),
          ),
        )
        .orderBy(asc(projects.title)),
      this.drizzle.db
        .select({
          personId: hdrPapers.personId,
          id: modules.id,
          title: modules.title,
          shortTitle: modules.shortTitle,
          displayId: modules.displayId,
        })
        .from(hdrPapers)
        .innerJoin(modules, eq(modules.id, hdrPapers.paperId))
        .innerJoin(hdrPeople, eq(hdrPeople.id, hdrPapers.personId))
        .where(
          and(
            this.owned(tenantId, userId),
            eq(hdrPapers.tenantId, tenantId),
            inArray(hdrPapers.personId, personIds),
            this.visiblePaper(tenantId, userId),
          ),
        )
        .orderBy(asc(modules.title)),
    ]);
    return { projects: projectRows, papers: paperRows };
  }

  async create(values: PersonValues, projectIds: string[], paperIds: string[]) {
    // The request interceptor owns the transaction, including every link write.
    const tx = this.drizzle.db;
    {
      const [person] = await tx.insert(hdrPeople).values(values).returning();
      if (!person) throw new Error('HDR record could not be created');
      if (projectIds.length)
        await tx.insert(hdrProjects).values(
          projectIds.map((projectId) => ({
            tenantId: person.tenantId,
            personId: person.id,
            projectId,
          })),
        );
      if (paperIds.length)
        await tx.insert(hdrPapers).values(
          paperIds.map((paperId) => ({
            tenantId: person.tenantId,
            personId: person.id,
            paperId,
          })),
        );
      return person;
    }
  }

  async update(
    tenantId: string,
    personId: string,
    userId: string,
    values: PersonUpdate,
    projectIds?: string[],
    paperIds?: string[],
  ) {
    // The request interceptor owns the transaction, including every link write.
    const tx = this.drizzle.db;
    {
      const [person] = await tx
        .update(hdrPeople)
        .set({ ...values, updatedAt: new Date() })
        .where(and(this.owned(tenantId, userId), eq(hdrPeople.id, personId)))
        .returning();
      if (!person) return undefined;
      // Only change links explicitly submitted. Hidden/archived links can also be removed.
      if (projectIds !== undefined) {
        await tx
          .delete(hdrProjects)
          .where(
            and(
              eq(hdrProjects.personId, personId),
              eq(hdrProjects.tenantId, tenantId),
            ),
          );
        if (projectIds.length)
          await tx.insert(hdrProjects).values(
            projectIds.map((projectId) => ({
              tenantId,
              personId,
              projectId,
            })),
          );
      }
      if (paperIds !== undefined) {
        await tx
          .delete(hdrPapers)
          .where(
            and(
              eq(hdrPapers.personId, personId),
              eq(hdrPapers.tenantId, tenantId),
            ),
          );
        if (paperIds.length)
          await tx
            .insert(hdrPapers)
            .values(
              paperIds.map((paperId) => ({ tenantId, personId, paperId })),
            );
      }
      return person;
    }
  }

  async remove(tenantId: string, personId: string, userId: string) {
    const [person] = await this.drizzle.db
      .delete(hdrPeople)
      .where(and(this.owned(tenantId, userId), eq(hdrPeople.id, personId)))
      .returning({ id: hdrPeople.id });
    return person;
  }
}
