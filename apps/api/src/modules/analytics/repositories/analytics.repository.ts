import { Injectable } from '@nestjs/common';
import { analyticsEvents } from '@research-tracker/migrations';
import { sql } from 'drizzle-orm';
import { DrizzleService } from '../../../db/drizzle.service';

export interface TrendMetric {
  current: number;
  previous: number;
}

export interface ResearchInsightsSummary {
  windowDays: number;
  headlines: {
    papersMoved: TrendMetric;
    submissionsLogged: TrendMetric;
    accepted: TrendMetric;
    rejected: TrendMetric;
    revisionRequests: TrendMetric;
    tasksCompleted: TrendMetric;
    activeMembers: TrendMetric;
  };
  stageMovements: Array<{
    fromStage: string;
    toStage: string;
    papers: number;
  }>;
  pipelineNow: Array<{
    stage: string;
    papers: number;
    medianDays: number | null;
  }>;
  paperStatuses: Array<{ status: string; papers: number }>;
  submissions: {
    logged: number;
    accepted: number;
    rejected: number;
    withdrawn: number;
    acceptanceRate: number | null;
    medianDecisionDays: number | null;
    awaitingDecision: number;
    oldestAwaitingDays: number | null;
    journals: Array<{
      journal: string;
      submissions: number;
      accepted: number;
      rejected: number;
    }>;
  };
  currentlyWith: Array<{ holder: string; papers: number }>;
  work: {
    tasksCreated: number;
    tasksCompleted: number;
    overdueTasks: number;
    estimatedOpenHours: number;
    medianTaskCompletionDays: number | null;
    fundingByStatus: Array<{ status: string; applications: number }>;
    awardedByCurrency: Array<{ currency: string; amount: number }>;
    fundingDeadlines: number;
    conferencesAdded: number;
    conferencePaperLinks: number;
    conferenceDeadlines: number;
  };
  team: {
    registeredMembers: number;
    dailyActivity: Array<{
      day: string;
      activeMembers: number;
      pageVisits: number;
    }>;
    pages: Array<{
      page: string;
      visits: number;
      members: number;
      adoptionPercent: number;
    }>;
    members: Array<{
      userId: string;
      name: string;
      email: string;
      sessions: number;
      pageVisits: number;
      projectsAdded: number;
      papersAdded: number;
      tasksAdded: number;
      notesAdded: number;
      lastActive: string | null;
    }>;
  };
}

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  async create(values: {
    tenantId: string;
    userId: string;
    name: string;
    path?: string;
    sessionId?: string;
    pageKey?: string;
    featureKey?: string;
    properties?: Record<string, unknown>;
  }) {
    const [row] = await this.drizzle.db
      .insert(analyticsEvents)
      .values(values)
      .returning();

    return row;
  }

  /**
   * Returns the complete owner-only Insights payload in one database round
   * trip. Aggregation stays in Postgres so no paper/task/member rows are sent
   * to the API merely to be counted.
   */
  async researchInsights(
    tenantId: string,
    currentSince: Date,
    previousSince: Date,
    periodEnd: Date,
  ): Promise<Omit<ResearchInsightsSummary, 'windowDays'>> {
    const result = await this.drizzle.db.execute(sql`
      WITH params AS (
        SELECT
          ${tenantId}::uuid AS tenant_id,
          ${currentSince.toISOString()}::timestamptz AS current_since,
          ${previousSince.toISOString()}::timestamptz AS previous_since,
          ${periodEnd.toISOString()}::timestamptz AS period_end,
          ((${currentSince.toISOString()}::timestamptz
            AT TIME ZONE 'Australia/Sydney')::date + 1) AS current_since_date,
          (${periodEnd.toISOString()}::timestamptz
            AT TIME ZONE 'Australia/Sydney')::date AS today_date,
          ((${periodEnd.toISOString()}::timestamptz
            AT TIME ZONE 'Australia/Sydney')::date + 1) AS period_end_date
      ),
      headline_periods AS (
        SELECT
          period,
          start_at,
          end_at,
          (start_at AT TIME ZONE 'Australia/Sydney')::date + 1 AS start_date,
          (end_at AT TIME ZONE 'Australia/Sydney')::date + 1 AS end_date
        FROM (
          SELECT 'current'::text AS period, current_since AS start_at,
            period_end AS end_at FROM params
          UNION ALL
          SELECT 'previous', previous_since, current_since FROM params
        ) ranges
      ),
      headline_values AS (
        SELECT
          period.period,
          (
            SELECT count(DISTINCT event.entity_id)::int
            FROM research_change_events event, params
            WHERE event.tenant_id = params.tenant_id
              AND event.entity_type = 'paper'
              AND event.field_name = 'pipeline_stage'
              AND event.action = 'updated'
              AND event.from_value IS NOT NULL
              AND event.to_value IS DISTINCT FROM event.from_value
              AND event.changed_at >= period.start_at
              AND event.changed_at < period.end_at
          ) AS papers_moved,
          (
            SELECT count(*)::int
            FROM module_submissions submission, params
            WHERE submission.tenant_id = params.tenant_id
              AND submission.submitted_date >= period.start_date
              AND submission.submitted_date < period.end_date
          ) AS submissions_logged,
          (
            SELECT count(*)::int
            FROM module_submissions submission, params
            WHERE submission.tenant_id = params.tenant_id
              AND submission.status = 'Accepted'
              AND submission.decision_date >= period.start_date
              AND submission.decision_date < period.end_date
          ) AS accepted,
          (
            SELECT count(*)::int
            FROM module_submissions submission, params
            WHERE submission.tenant_id = params.tenant_id
              AND submission.status = 'Rejected'
              AND submission.decision_date >= period.start_date
              AND submission.decision_date < period.end_date
          ) AS rejected,
          (
            SELECT count(*)::int
            FROM research_change_events event, params
            WHERE event.tenant_id = params.tenant_id
              AND event.entity_type = 'submission'
              AND event.field_name = 'status'
              AND event.to_value = to_jsonb('Revision requested'::text)
              AND event.changed_at >= period.start_at
              AND event.changed_at < period.end_at
          ) AS revision_requests,
          (
            SELECT count(*)::int
            FROM research_change_events event, params
            WHERE event.tenant_id = params.tenant_id
              AND event.entity_type = 'task'
              AND event.field_name = 'status'
              AND event.to_value = to_jsonb('Complete'::text)
              AND event.changed_at >= period.start_at
              AND event.changed_at < period.end_at
          ) AS tasks_completed,
          (
            SELECT count(DISTINCT event.user_id)::int
            FROM analytics_events event, params
            WHERE event.tenant_id = params.tenant_id
              AND event.name = 'page_view'
              AND event.created_at >= period.start_at
              AND event.created_at < period.end_at
          ) AS active_members
        FROM headline_periods period
      ),
      headline AS (
        SELECT jsonb_build_object(
          'papersMoved', jsonb_build_object(
            'current', max(papers_moved) FILTER (WHERE period = 'current'),
            'previous', max(papers_moved) FILTER (WHERE period = 'previous')
          ),
          'submissionsLogged', jsonb_build_object(
            'current', max(submissions_logged) FILTER (WHERE period = 'current'),
            'previous', max(submissions_logged) FILTER (WHERE period = 'previous')
          ),
          'accepted', jsonb_build_object(
            'current', max(accepted) FILTER (WHERE period = 'current'),
            'previous', max(accepted) FILTER (WHERE period = 'previous')
          ),
          'rejected', jsonb_build_object(
            'current', max(rejected) FILTER (WHERE period = 'current'),
            'previous', max(rejected) FILTER (WHERE period = 'previous')
          ),
          'revisionRequests', jsonb_build_object(
            'current', max(revision_requests) FILTER (WHERE period = 'current'),
            'previous', max(revision_requests) FILTER (WHERE period = 'previous')
          ),
          'tasksCompleted', jsonb_build_object(
            'current', max(tasks_completed) FILTER (WHERE period = 'current'),
            'previous', max(tasks_completed) FILTER (WHERE period = 'previous')
          ),
          'activeMembers', jsonb_build_object(
            'current', max(active_members) FILTER (WHERE period = 'current'),
            'previous', max(active_members) FILTER (WHERE period = 'previous')
          )
        ) AS value
        FROM headline_values
      ),
      stage_movement_rows AS (
        SELECT
          event.from_value #>> '{}' AS from_stage,
          event.to_value #>> '{}' AS to_stage,
          count(DISTINCT event.entity_id)::int AS papers
        FROM research_change_events event, params
        WHERE event.tenant_id = params.tenant_id
          AND event.entity_type = 'paper'
          AND event.field_name = 'pipeline_stage'
          AND event.action = 'updated'
          AND event.from_value IS NOT NULL
          AND event.to_value IS NOT NULL
          AND event.from_value IS DISTINCT FROM event.to_value
          AND event.changed_at >= params.current_since
          AND event.changed_at < params.period_end
        GROUP BY event.from_value, event.to_value
        ORDER BY papers DESC, from_stage, to_stage
      ),
      effective_stages AS (
        SELECT stage.value, stage.sort_order
        FROM "enum" stage, params
        WHERE stage.category = 'module_pipeline_stage'
          AND stage.project_id IS NULL
          AND stage.module_id IS NULL
          AND stage.hidden = false
          AND (
            stage.tenant_id = params.tenant_id
            OR (
              stage.tenant_id IS NULL
              AND NOT EXISTS (
                SELECT 1 FROM "enum" tenant_stage
                WHERE tenant_stage.tenant_id = params.tenant_id
                  AND tenant_stage.category = 'module_pipeline_stage'
              )
            )
          )
      ),
      current_papers AS (
        SELECT stage.value AS stage, paper.pipeline_stage_changed_at
        FROM modules paper
        INNER JOIN "enum" stage ON stage.id = paper.pipeline_stage_id
        LEFT JOIN projects parent_project ON parent_project.id = paper.project_id
        CROSS JOIN params
        WHERE paper.tenant_id = params.tenant_id
          AND paper.archived_at IS NULL
          AND (paper.project_id IS NULL OR parent_project.archived_at IS NULL)
      ),
      pipeline_rows AS (
        SELECT
          stage.value AS stage,
          stage.sort_order,
          count(paper.stage)::int AS papers,
          round(percentile_cont(0.5) WITHIN GROUP (
            ORDER BY GREATEST(
              0,
              extract(epoch FROM (params.period_end - paper.pipeline_stage_changed_at))
                / 86400
            )
          ))::int AS median_days
        FROM effective_stages stage
        CROSS JOIN params
        LEFT JOIN current_papers paper ON paper.stage = stage.value
        GROUP BY stage.value, stage.sort_order
        ORDER BY stage.sort_order, stage.value
      ),
      paper_status_rows AS (
        SELECT
          COALESCE(paper_status.value, 'Not set') AS status,
          count(*)::int AS papers
        FROM modules paper
        LEFT JOIN "enum" paper_status ON paper_status.id = paper.status_id
        LEFT JOIN projects parent_project ON parent_project.id = paper.project_id
        CROSS JOIN params
        WHERE paper.tenant_id = params.tenant_id
          AND paper.archived_at IS NULL
          AND (paper.project_id IS NULL OR parent_project.archived_at IS NULL)
        GROUP BY COALESCE(paper_status.value, 'Not set')
        ORDER BY papers DESC, status
      ),
      submission_journal_rows AS (
        SELECT
          submission.journal_name AS journal,
          count(*)::int AS submissions,
          count(*) FILTER (WHERE submission.status = 'Accepted')::int AS accepted,
          count(*) FILTER (WHERE submission.status = 'Rejected')::int AS rejected
        FROM module_submissions submission, params
        WHERE submission.tenant_id = params.tenant_id
          AND submission.submitted_date >= params.current_since_date
          AND submission.submitted_date < params.period_end_date
        GROUP BY submission.journal_name
        ORDER BY submissions DESC, submission.journal_name
        LIMIT 8
      ),
      submission_summary AS (
        SELECT jsonb_build_object(
          'logged', count(*) FILTER (
            WHERE submission.submitted_date >= params.current_since_date
              AND submission.submitted_date < params.period_end_date
          )::int,
          'accepted', count(*) FILTER (
            WHERE submission.status = 'Accepted'
              AND submission.decision_date >= params.current_since_date
              AND submission.decision_date < params.period_end_date
          )::int,
          'rejected', count(*) FILTER (
            WHERE submission.status = 'Rejected'
              AND submission.decision_date >= params.current_since_date
              AND submission.decision_date < params.period_end_date
          )::int,
          'withdrawn', count(*) FILTER (
            WHERE submission.status = 'Withdrawn'
              AND submission.decision_date >= params.current_since_date
              AND submission.decision_date < params.period_end_date
          )::int,
          'acceptanceRate', round(
            100.0 * count(*) FILTER (
              WHERE submission.status = 'Accepted'
                AND submission.decision_date >= params.current_since_date
                AND submission.decision_date < params.period_end_date
            ) / NULLIF(count(*) FILTER (
              WHERE submission.status IN ('Accepted', 'Rejected')
                AND submission.decision_date >= params.current_since_date
                AND submission.decision_date < params.period_end_date
            ), 0),
            1
          ),
          'medianDecisionDays', round(percentile_cont(0.5) WITHIN GROUP (
            ORDER BY submission.decision_date - submission.submitted_date
          ) FILTER (
            WHERE submission.decision_date IS NOT NULL
              AND submission.status IN ('Accepted', 'Rejected', 'Withdrawn')
              AND submission.decision_date >= params.current_since_date
              AND submission.decision_date < params.period_end_date
          ))::int,
          'awaitingDecision', count(*) FILTER (
            WHERE submission.status IN ('Submitted', 'Under review')
          )::int,
          'oldestAwaitingDays', max(
            params.today_date - submission.submitted_date
          ) FILTER (
            WHERE submission.status IN ('Submitted', 'Under review')
          ),
          'journals', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'journal', journal,
              'submissions', submissions,
              'accepted', accepted,
              'rejected', rejected
            ) ORDER BY submissions DESC, journal)
            FROM submission_journal_rows
          ), '[]'::jsonb)
        ) AS value
        FROM module_submissions submission
        CROSS JOIN params
        WHERE submission.tenant_id = params.tenant_id
      ),
      currently_with_rows AS (
        SELECT
          COALESCE(paper.currently_with_type, 'not_set') AS holder,
          count(*)::int AS papers
        FROM modules paper
        LEFT JOIN projects parent_project ON parent_project.id = paper.project_id
        CROSS JOIN params
        WHERE paper.tenant_id = params.tenant_id
          AND paper.archived_at IS NULL
          AND (paper.project_id IS NULL OR parent_project.archived_at IS NULL)
        GROUP BY COALESCE(paper.currently_with_type, 'not_set')
        ORDER BY papers DESC, holder
      ),
      task_numbers AS (
        SELECT
          count(*) FILTER (
            WHERE task.created_at >= params.current_since
              AND task.created_at < params.period_end
          )::int AS tasks_created,
          (
            SELECT count(*)::int
            FROM research_change_events event, params event_params
            WHERE event.tenant_id = event_params.tenant_id
              AND event.entity_type = 'task'
              AND event.field_name = 'status'
              AND event.to_value = to_jsonb('Complete'::text)
              AND event.changed_at >= event_params.current_since
              AND event.changed_at < event_params.period_end
          ) AS tasks_completed,
          count(*) FILTER (
            WHERE (task_status.value IS NULL OR task_status.value <> 'Complete')
              AND task.due_date < params.today_date
          )::int AS overdue_tasks,
          COALESCE(sum(task.estimated_hours) FILTER (
            WHERE task_status.value IS NULL OR task_status.value <> 'Complete'
          ), 0)::float8 AS estimated_open_hours,
          (
            SELECT round(percentile_cont(0.5) WITHIN GROUP (
              ORDER BY extract(epoch FROM (event.changed_at - completed_task.created_at))
                / 86400
            ))::int
            FROM research_change_events event
            INNER JOIN tasks completed_task ON completed_task.id = event.entity_id
            CROSS JOIN params event_params
            WHERE event.tenant_id = event_params.tenant_id
              AND event.entity_type = 'task'
              AND event.field_name = 'status'
              AND event.to_value = to_jsonb('Complete'::text)
              AND event.changed_at >= event_params.current_since
              AND event.changed_at < event_params.period_end
          ) AS median_task_completion_days
        FROM tasks task
        LEFT JOIN "enum" task_status ON task_status.id = task.status_id
        LEFT JOIN projects task_project ON task_project.id = task.project_id
        LEFT JOIN modules task_paper ON task_paper.id = task.module_id
        LEFT JOIN projects task_paper_project
          ON task_paper_project.id = task_paper.project_id
        CROSS JOIN params
        WHERE task.tenant_id = params.tenant_id
          AND (task.project_id IS NULL OR task_project.archived_at IS NULL)
          AND (
            task.module_id IS NULL
            OR (
              task_paper.archived_at IS NULL
              AND (
                task_paper.project_id IS NULL
                OR task_paper_project.archived_at IS NULL
              )
            )
          )
      ),
      funding_status_rows AS (
        SELECT COALESCE(funding.status, 'Not set') AS status,
          count(*)::int AS applications
        FROM fundings funding, params
        WHERE funding.tenant_id = params.tenant_id
        GROUP BY COALESCE(funding.status, 'Not set')
        ORDER BY applications DESC, status
      ),
      awarded_currency_rows AS (
        SELECT COALESCE(NULLIF(funding.currency, ''), 'Unspecified') AS currency,
          COALESCE(sum(funding.amount), 0)::float8 AS amount
        FROM fundings funding, params
        WHERE funding.tenant_id = params.tenant_id
          AND funding.status = 'Awarded'
        GROUP BY COALESCE(NULLIF(funding.currency, ''), 'Unspecified')
        ORDER BY amount DESC, currency
      ),
      work_summary AS (
        SELECT jsonb_build_object(
          'tasksCreated', task_numbers.tasks_created,
          'tasksCompleted', task_numbers.tasks_completed,
          'overdueTasks', task_numbers.overdue_tasks,
          'estimatedOpenHours', task_numbers.estimated_open_hours,
          'medianTaskCompletionDays', task_numbers.median_task_completion_days,
          'fundingByStatus', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'status', status,
              'applications', applications
            ) ORDER BY applications DESC, status)
            FROM funding_status_rows
          ), '[]'::jsonb),
          'awardedByCurrency', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'currency', currency,
              'amount', amount
            ) ORDER BY amount DESC, currency)
            FROM awarded_currency_rows
          ), '[]'::jsonb),
          'fundingDeadlines', (
            SELECT count(*)::int
            FROM fundings funding, params
            WHERE funding.tenant_id = params.tenant_id
              AND funding.application_deadline >= params.today_date
              AND funding.application_deadline < params.today_date + 30
          ),
          'conferencesAdded', (
            SELECT count(*)::int
            FROM conferences conference, params
            WHERE conference.tenant_id = params.tenant_id
              AND conference.created_at >= params.current_since
              AND conference.created_at < params.period_end
          ),
          'conferencePaperLinks', (
            SELECT count(*)::int
            FROM conference_modules link, params
            WHERE link.tenant_id = params.tenant_id
          ),
          'conferenceDeadlines', (
            SELECT count(*)::int
            FROM conferences conference, params
            WHERE conference.tenant_id = params.tenant_id
              AND conference.submission_due >= params.today_date
              AND conference.submission_due < params.today_date + 30
          )
        ) AS value
        FROM task_numbers
      ),
      registered_members AS (
        SELECT count(*)::int AS count
        FROM tenant_memberships membership, params
        WHERE membership.tenant_id = params.tenant_id
          AND membership.status = 'active'
          AND membership.joined_at IS NOT NULL
      ),
      daily_activity_rows AS (
        SELECT
          to_char(
            timezone('Australia/Sydney', event.created_at),
            'YYYY-MM-DD'
          ) AS day,
          count(DISTINCT event.user_id)::int AS active_members,
          count(*)::int AS page_visits
        FROM analytics_events event, params
        WHERE event.tenant_id = params.tenant_id
          AND event.name = 'page_view'
          AND event.created_at >= params.current_since
          AND event.created_at < params.period_end
        GROUP BY day
        ORDER BY day
      ),
      page_rows AS (
        SELECT
          COALESCE(event.page_key, 'legacy_unclassified') AS page,
          count(*)::int AS visits,
          count(DISTINCT event.user_id)::int AS members,
          round(
            100.0 * count(DISTINCT event.user_id)
            / NULLIF((SELECT count FROM registered_members), 0),
            1
          ) AS adoption_percent
        FROM analytics_events event, params
        WHERE event.tenant_id = params.tenant_id
          AND event.name = 'page_view'
          AND event.created_at >= params.current_since
          AND event.created_at < params.period_end
        GROUP BY COALESCE(event.page_key, 'legacy_unclassified')
        ORDER BY visits DESC, page
      ),
      member_event_rows AS (
        SELECT
          event.user_id,
          count(DISTINCT event.session_id) FILTER (
            WHERE event.session_id IS NOT NULL
          )::int AS sessions,
          count(*) FILTER (WHERE event.name = 'page_view')::int AS page_visits
        FROM analytics_events event, params
        WHERE event.tenant_id = params.tenant_id
          AND event.created_at >= params.current_since
          AND event.created_at < params.period_end
        GROUP BY event.user_id
      ),
      member_last_active AS (
        SELECT event.user_id, max(event.created_at) AS last_active
        FROM analytics_events event, params
        WHERE event.tenant_id = params.tenant_id
          AND event.name = 'page_view'
        GROUP BY event.user_id
      ),
      member_project_rows AS (
        SELECT project.user_id, count(*)::int AS added
        FROM projects project, params
        WHERE project.tenant_id = params.tenant_id
          AND project.created_at >= params.current_since
          AND project.created_at < params.period_end
        GROUP BY project.user_id
      ),
      member_paper_rows AS (
        SELECT paper.created_by AS user_id, count(*)::int AS added
        FROM modules paper, params
        WHERE paper.tenant_id = params.tenant_id
          AND paper.created_by IS NOT NULL
          AND paper.created_at >= params.current_since
          AND paper.created_at < params.period_end
        GROUP BY paper.created_by
      ),
      member_task_rows AS (
        SELECT task.created_by AS user_id, count(*)::int AS added
        FROM tasks task, params
        WHERE task.tenant_id = params.tenant_id
          AND task.created_at >= params.current_since
          AND task.created_at < params.period_end
        GROUP BY task.created_by
      ),
      member_note_rows AS (
        SELECT note.created_by AS user_id, count(*)::int AS added
        FROM notes note, params
        WHERE note.tenant_id = params.tenant_id
          AND note.created_at >= params.current_since
          AND note.created_at < params.period_end
        GROUP BY note.created_by
      ),
      member_rows AS (
        SELECT
          app_user.id AS user_id,
          COALESCE(
            NULLIF(app_user.display_name, ''),
            NULLIF(app_user.full_name, ''),
            app_user.email
          ) AS name,
          app_user.email,
          COALESCE(member_event.sessions, 0) AS sessions,
          COALESCE(member_event.page_visits, 0) AS page_visits,
          COALESCE(member_project.added, 0) AS projects_added,
          COALESCE(member_paper.added, 0) AS papers_added,
          COALESCE(member_task.added, 0) AS tasks_added,
          COALESCE(member_note.added, 0) AS notes_added,
          member_last.last_active
        FROM tenant_memberships membership
        INNER JOIN users app_user ON app_user.id = membership.user_id
        LEFT JOIN member_event_rows member_event
          ON member_event.user_id = membership.user_id
        LEFT JOIN member_last_active member_last
          ON member_last.user_id = membership.user_id
        LEFT JOIN member_project_rows member_project
          ON member_project.user_id = membership.user_id
        LEFT JOIN member_paper_rows member_paper
          ON member_paper.user_id = membership.user_id
        LEFT JOIN member_task_rows member_task
          ON member_task.user_id = membership.user_id
        LEFT JOIN member_note_rows member_note
          ON member_note.user_id = membership.user_id
        CROSS JOIN params
        WHERE membership.tenant_id = params.tenant_id
          AND membership.status = 'active'
          AND membership.joined_at IS NOT NULL
        ORDER BY page_visits DESC, name, app_user.email
      ),
      team_summary AS (
        SELECT jsonb_build_object(
          'registeredMembers', (SELECT count FROM registered_members),
          'dailyActivity', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'day', day,
              'activeMembers', active_members,
              'pageVisits', page_visits
            ) ORDER BY day)
            FROM daily_activity_rows
          ), '[]'::jsonb),
          'pages', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'page', page,
              'visits', visits,
              'members', members,
              'adoptionPercent', adoption_percent
            ) ORDER BY visits DESC, page)
            FROM page_rows
          ), '[]'::jsonb),
          'members', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'userId', user_id,
              'name', name,
              'email', email,
              'sessions', sessions,
              'pageVisits', page_visits,
              'projectsAdded', projects_added,
              'papersAdded', papers_added,
              'tasksAdded', tasks_added,
              'notesAdded', notes_added,
              'lastActive', last_active
            ) ORDER BY page_visits DESC, name, email)
            FROM member_rows
          ), '[]'::jsonb)
        ) AS value
      )
      SELECT jsonb_build_object(
        'headlines', (SELECT value FROM headline),
        'stageMovements', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'fromStage', from_stage,
            'toStage', to_stage,
            'papers', papers
          ) ORDER BY papers DESC, from_stage, to_stage)
          FROM stage_movement_rows
        ), '[]'::jsonb),
        'pipelineNow', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'stage', stage,
            'papers', papers,
            'medianDays', median_days
          ) ORDER BY sort_order, stage)
          FROM pipeline_rows
        ), '[]'::jsonb),
        'paperStatuses', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'status', status,
            'papers', papers
          ) ORDER BY papers DESC, status)
          FROM paper_status_rows
        ), '[]'::jsonb),
        'submissions', (SELECT value FROM submission_summary),
        'currentlyWith', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'holder', holder,
            'papers', papers
          ) ORDER BY papers DESC, holder)
          FROM currently_with_rows
        ), '[]'::jsonb),
        'work', (SELECT value FROM work_summary),
        'team', (SELECT value FROM team_summary)
      ) AS summary
    `);

    return result.rows[0]?.summary as Omit<
      ResearchInsightsSummary,
      'windowDays'
    >;
  }
}
