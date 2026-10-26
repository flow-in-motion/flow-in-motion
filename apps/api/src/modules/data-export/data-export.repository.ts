import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DrizzleService } from '../../db/drizzle.service';
import type { ExportCollections } from './data-export.types';
import { getRequestContext } from '../../db/request-context';
import type { ExportRecord } from './data-export.types';

@Injectable()
export class DataExportRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async readResearchData(userId: string): Promise<ExportCollections> {
    const result = await this.drizzle.db.execute<{
      collections: ExportCollections;
    }>(sql`
      WITH
      caller AS (
        SELECT ${userId}::uuid AS id
      ),
      active_memberships AS (
        SELECT membership.tenant_id
        FROM public.tenant_memberships AS membership
        CROSS JOIN caller
        WHERE membership.user_id = caller.id
          AND membership.status = 'active'
      ),
      export_projects AS (
        SELECT project.*
        FROM public.projects AS project
        CROSS JOIN caller
        WHERE project.user_id = caller.id
          OR EXISTS (
            SELECT 1
            FROM public.project_collaborators AS collaborator
            WHERE collaborator.project_id = project.id
              AND collaborator.tenant_id = project.tenant_id
              AND collaborator.user_id = caller.id
          )
      ),
      export_papers AS (
        SELECT paper.*
        FROM public.modules AS paper
        CROSS JOIN caller
        WHERE EXISTS (
          SELECT 1
          FROM public.module_collaborators AS collaborator
          WHERE collaborator.module_id = paper.id
            AND collaborator.tenant_id = paper.tenant_id
            AND collaborator.user_id = caller.id
        )
        OR EXISTS (
          SELECT 1
          FROM public.projects AS parent
          WHERE parent.id = paper.project_id
            AND parent.tenant_id = paper.tenant_id
            AND parent.user_id = caller.id
        )
      ),
      export_tasks AS (
        SELECT task.*
        FROM public.tasks AS task
        CROSS JOIN caller
        WHERE task.created_by = caller.id
          OR EXISTS (
            SELECT 1
            FROM public.task_members AS member
            WHERE member.task_id = task.id
              AND member.tenant_id = task.tenant_id
              AND member.user_id = caller.id
          )
      ),
      export_notes AS (
        SELECT note.*
        FROM public.notes AS note
        CROSS JOIN caller
        WHERE note.created_by = caller.id
          OR EXISTS (
            SELECT 1
            FROM public.note_members AS member
            WHERE member.note_id = note.id
              AND member.tenant_id = note.tenant_id
              AND member.user_id = caller.id
          )
      ),
      export_task_entries AS (
        SELECT entry.*
        FROM public.task_description_entries AS entry
        INNER JOIN export_tasks AS task
          ON task.id = entry.task_id
      ),
      export_note_entries AS (
        SELECT entry.*
        FROM public.note_entries AS entry
        INNER JOIN export_notes AS note
          ON note.id = entry.note_id
      ),
      export_submissions AS (
        SELECT submission.*
        FROM public.module_submissions AS submission
        INNER JOIN export_papers AS paper
          ON paper.id = submission.module_id
          AND paper.tenant_id = submission.tenant_id
      ),
      export_conferences AS (
        SELECT conference.*
        FROM public.conferences AS conference
        CROSS JOIN caller
        WHERE conference.owner_user_id = caller.id
          OR EXISTS (
            SELECT 1
            FROM public.conference_projects AS link
            INNER JOIN public.project_collaborators AS collaborator
              ON collaborator.project_id = link.project_id
              AND collaborator.tenant_id = link.tenant_id
            WHERE link.conference_id = conference.id
              AND link.tenant_id = conference.tenant_id
              AND collaborator.user_id = caller.id
          )
          OR public.is_conference_module_collaborator(
            conference.id,
            caller.id
          )
      ),
      export_conference_projects AS (
        SELECT link.*
        FROM public.conference_projects AS link
        INNER JOIN export_conferences AS conference
          ON conference.id = link.conference_id
          AND conference.tenant_id = link.tenant_id
        INNER JOIN export_projects AS project
          ON project.id = link.project_id
          AND project.tenant_id = link.tenant_id
      ),
      export_conference_papers AS (
        SELECT link.*
        FROM public.conference_modules AS link
        INNER JOIN export_conferences AS conference
          ON conference.id = link.conference_id
          AND conference.tenant_id = link.tenant_id
        INNER JOIN export_papers AS paper
          ON paper.id = link.module_id
          AND paper.tenant_id = link.tenant_id
      ),
      export_fundings AS (
        SELECT funding.*
        FROM public.fundings AS funding
        CROSS JOIN caller
        WHERE funding.owner_user_id = caller.id
          OR public.can_access_funding(funding.id, caller.id)
      ),
      export_funding_projects AS (
        SELECT link.*
        FROM public.funding_projects AS link
        INNER JOIN export_fundings AS funding
          ON funding.id = link.funding_id
          AND funding.tenant_id = link.tenant_id
        INNER JOIN export_projects AS project
          ON project.id = link.project_id
          AND project.tenant_id = link.tenant_id
      ),
      export_funding_papers AS (
        SELECT link.*
        FROM public.funding_modules AS link
        INNER JOIN export_fundings AS funding
          ON funding.id = link.funding_id
          AND funding.tenant_id = link.tenant_id
        INNER JOIN export_papers AS paper
          ON paper.id = link.module_id
          AND paper.tenant_id = link.tenant_id
      ),
      export_funding_notes AS (
        SELECT link.*
        FROM public.funding_notes AS link
        INNER JOIN export_fundings AS funding
          ON funding.id = link.funding_id
          AND funding.tenant_id = link.tenant_id
        INNER JOIN export_notes AS note
          ON note.id = link.note_id
          AND note.tenant_id = link.tenant_id
      ),
      export_funding_tasks AS (
        SELECT link.*
        FROM public.funding_tasks AS link
        INNER JOIN export_fundings AS funding
          ON funding.id = link.funding_id
          AND funding.tenant_id = link.tenant_id
        INNER JOIN export_tasks AS task
          ON task.id = link.task_id
          AND task.tenant_id = link.tenant_id
      ),
      export_calendar_events AS (
        SELECT event.*
        FROM public.calendar_events AS event
        WHERE event.tenant_id IN (
          SELECT tenant_id FROM active_memberships
        )
      ),
      referenced_enum_ids AS (
        SELECT status_id AS id FROM export_projects
        UNION SELECT importance_id FROM export_projects
        UNION SELECT status_id FROM export_papers
        UNION SELECT priority_id FROM export_papers
        UNION SELECT pipeline_stage_id FROM export_papers
        UNION SELECT status_id FROM export_tasks
        UNION SELECT priority_id FROM export_tasks
        UNION SELECT visibility_id FROM export_tasks
        UNION SELECT visibility_id FROM export_notes
      ),
      export_reference_values AS (
        SELECT value.*
        FROM public."enum" AS value
        WHERE value.id IN (
          SELECT id FROM referenced_enum_ids WHERE id IS NOT NULL
        )
      )
      SELECT jsonb_build_object(
        'projects', COALESCE(
          (
  SELECT jsonb_agg(
    to_jsonb(row) || jsonb_build_object(
      'collaborators',
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'display_name', collaborator_user.display_name,
              'role', collaborator_role.value
            )
            ORDER BY collaborator_user.display_name, collaborator.user_id
          )
          FROM public.project_collaborators AS collaborator
          INNER JOIN public.users AS collaborator_user
            ON collaborator_user.id = collaborator.user_id
          INNER JOIN public."enum" AS collaborator_role
            ON collaborator_role.id = collaborator.role_id
          WHERE collaborator.project_id = row.id
            AND collaborator.tenant_id = row.tenant_id
            AND collaborator_role.category = 'project_role'
            AND collaborator_role.value <> 'Owner'
        ),
        '[]'::jsonb
      )
    )
    ORDER BY row.id
  )
  FROM export_projects AS row
), '[]'::jsonb
        ),
        'papers', COALESCE(
          (
  SELECT jsonb_agg(
    to_jsonb(row) || jsonb_build_object(
      'assigned_to_display_name',
      COALESCE(
        (
          SELECT assigned_user.display_name
          FROM public.users AS assigned_user
          WHERE assigned_user.id = row.assigned_to_user_id
        ),
        (
          SELECT assigned_invitation.name
          FROM public.module_invitations AS assigned_invitation
          WHERE assigned_invitation.id = row.assigned_to_invitation_id
            AND assigned_invitation.module_id = row.id
        )
      )
    )
    ORDER BY row.id
  )
  FROM export_papers AS row
), '[]'::jsonb
        ),
        'tasks', COALESCE(
          (SELECT jsonb_agg(to_jsonb(row) ORDER BY row.id)
           FROM export_tasks AS row), '[]'::jsonb
        ),
        'taskDescriptionEntries', COALESCE(
          (SELECT jsonb_agg(
             to_jsonb(row) ORDER BY row.updated_at DESC, row.id DESC
           ) FROM export_task_entries AS row), '[]'::jsonb
        ),
        'notes', COALESCE(
          (SELECT jsonb_agg(to_jsonb(row) ORDER BY row.id)
           FROM export_notes AS row), '[]'::jsonb
        ),
        'noteEntries', COALESCE(
          (SELECT jsonb_agg(
             to_jsonb(row) ORDER BY row.updated_at DESC, row.id DESC
           ) FROM export_note_entries AS row), '[]'::jsonb
        ),
        'journalSubmissions', COALESCE(
          (SELECT jsonb_agg(
             to_jsonb(row)
             ORDER BY row.submitted_date DESC, row.created_at DESC, row.id DESC
           ) FROM export_submissions AS row), '[]'::jsonb
        ),
        'conferences', COALESCE(
          (SELECT jsonb_agg(to_jsonb(row) ORDER BY row.id)
           FROM export_conferences AS row), '[]'::jsonb
        ),
        'conferenceProjects', COALESCE(
          (SELECT jsonb_agg(to_jsonb(row) ORDER BY row.id)
           FROM export_conference_projects AS row), '[]'::jsonb
        ),
        'conferencePapers', COALESCE(
          (SELECT jsonb_agg(to_jsonb(row) ORDER BY row.id)
           FROM export_conference_papers AS row), '[]'::jsonb
        ),
        'fundings', COALESCE(
          (SELECT jsonb_agg(to_jsonb(row) ORDER BY row.id)
           FROM export_fundings AS row), '[]'::jsonb
        ),
        'fundingProjects', COALESCE(
          (SELECT jsonb_agg(to_jsonb(row) ORDER BY row.id)
           FROM export_funding_projects AS row), '[]'::jsonb
        ),
        'fundingPapers', COALESCE(
          (SELECT jsonb_agg(to_jsonb(row) ORDER BY row.id)
           FROM export_funding_papers AS row), '[]'::jsonb
        ),
        'fundingNotes', COALESCE(
          (SELECT jsonb_agg(to_jsonb(row) ORDER BY row.id)
           FROM export_funding_notes AS row), '[]'::jsonb
        ),
        'fundingTasks', COALESCE(
          (SELECT jsonb_agg(to_jsonb(row) ORDER BY row.id)
           FROM export_funding_tasks AS row), '[]'::jsonb
        ),
        'calendarEvents', COALESCE(
          (SELECT jsonb_agg(
             to_jsonb(row) ORDER BY row.event_date, row.id
           ) FROM export_calendar_events AS row), '[]'::jsonb
        ),
        'referenceValues', COALESCE(
          (SELECT jsonb_agg(to_jsonb(row) ORDER BY row.id)
           FROM export_reference_values AS row), '[]'::jsonb
        )
      ) AS collections
    `);

    const row = result.rows[0];
    if (!row) {
      throw new Error('The data export query returned no result');
    }

    row.collections.conferencePapers = await this.readConferencePaperLinks(
      userId,
      row.collections,
    );

    return row.collections;
  }
  private async readConferencePaperLinks(
    userId: string,
    collections: ExportCollections,
  ): Promise<ExportRecord[]> {
    const context = getRequestContext();

    if (!context?.tx || context.userId !== userId) {
      throw new Error(
        'Conference presentation export requires an authenticated request transaction',
      );
    }

    const db = context.tx;
    const settings = await db.execute<{ tenant_id: string | null }>(sql`
      SELECT current_setting('app.current_tenant_id', true) AS tenant_id
    `);
    const originalTenantId = settings.rows[0]?.tenant_id ?? '';

    const tenantIds = new Set(
      collections.papers
        .map((paper) => paper.tenant_id)
        .filter((tenantId): tenantId is string => typeof tenantId === 'string'),
    );

    const links: ExportRecord[] = [];

    // Run sequentially because each query uses this transaction's
    // current workspace setting.
    for (const tenantId of tenantIds) {
      const paperIds = collections.papers
        .filter((paper) => paper.tenant_id === tenantId)
        .map((paper) => paper.id)
        .filter((id): id is string => typeof id === 'string');

      const conferenceIds = collections.conferences
        .filter((conference) => conference.tenant_id === tenantId)
        .map((conference) => conference.id)
        .filter((id): id is string => typeof id === 'string');

      if (paperIds.length === 0 || conferenceIds.length === 0) continue;

      await db.execute(sql`
        SELECT set_config('app.current_tenant_id', ${tenantId}, true)
      `);

      const result = await db.execute<{ record: ExportRecord }>(sql`
        SELECT to_jsonb(link) AS record
        FROM public.conference_modules AS link
        WHERE link.tenant_id = ${tenantId}::uuid
          AND link.module_id IN (
            ${sql.join(
              paperIds.map((id) => sql`${id}::uuid`),
              sql`, `,
            )}
          )
          AND link.conference_id IN (
            ${sql.join(
              conferenceIds.map((id) => sql`${id}::uuid`),
              sql`, `,
            )}
          )
        ORDER BY link.id
      `);

      links.push(...result.rows.map((row) => row.record));
    }

    await db.execute(sql`
      SELECT set_config(
        'app.current_tenant_id',
        ${originalTenantId},
        true
      )
    `);

    return links;
  }
}
