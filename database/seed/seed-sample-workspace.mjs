import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const root = path.resolve(import.meta.dirname, '..', '..');
const requireFromApi = createRequire(path.join(root, 'apps', 'api', 'package.json'));
const { Client } = requireFromApi('pg');

function loadEnv(filePath) {
  const values = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

const env = { ...loadEnv(path.join(root, '.env')), ...process.env };
const sslMode = env.POSTGRES_SSL_MODE || 'require';
const ssl =
  sslMode === 'disable'
    ? false
    : sslMode === 'verify-full'
      ? {
          rejectUnauthorized: true,
          ca: env.POSTGRES_SSL_CA?.replace(/\\n/g, '\n'),
        }
      : { rejectUnauthorized: false };
const dryRun = process.argv.includes('--dry-run');
const listWorkspaces = process.argv.includes('--list-workspaces');
const dedupe = process.argv.includes('--dedupe');
const workspaceSlug = process.argv.find((argument) => argument.startsWith('--workspace='))?.split('=', 2)[1];

const client = new Client({
  host: env.POSTGRES_HOST,
  port: Number(env.POSTGRES_PORT || 5432),
  database: env.POSTGRES_DB,
  user: env.POSTGRES_RUNTIME_USER,
  password: env.POSTGRES_RUNTIME_PASSWORD,
  ssl,
});

const projectStagePool = [
  'Concept',
  'Planning',
  'Active Research',
  'Consolidation & Review',
  'Dissemination',
  'Completed',
];

const projects = [
  {
    key: 'coastal',
    title: '[Sample] Coastal Heat Resilience Study',
    description: 'Evaluate how coastal neighbourhoods experience and respond to extreme heat, combining field sensors with community interviews.',
    researchArea: 'Environmental health and climate resilience',
    status: 'Active',
    stage: 'Active Research',
    importance: 'High',
    scheduledFor: '2026-08-10',
    dueDate: '2026-11-30',
    totalBudget: '28500.00',
    targetJournals: 'Environmental Research; Cities & Health',
  },
  {
    key: 'screening',
    title: '[Sample] AI-Assisted Literature Screening',
    description: 'Compare manual and AI-assisted screening workflows for speed, agreement, transparency, and reviewer confidence.',
    researchArea: 'Research methods and responsible AI',
    status: 'Active',
    stage: 'Planning',
    importance: 'Critical',
    scheduledFor: '2026-09-01',
    dueDate: '2027-01-15',
    totalBudget: '12000.00',
    targetJournals: 'Research Synthesis Methods; Systematic Reviews',
  },
  {
    key: 'sleep',
    title: '[Sample] Community Sleep & Wellbeing Survey',
    description: 'Analyse community survey data to understand relationships between sleep quality, work patterns, and reported wellbeing.',
    researchArea: 'Population health and wellbeing',
    status: 'Review',
    stage: 'Consolidation & Review',
    importance: 'Medium',
    scheduledFor: '2026-05-18',
    dueDate: '2026-10-23',
    totalBudget: '18500.00',
    targetJournals: 'Sleep Health; BMC Public Health',
  },
];

const modules = [
  {
    key: 'fieldwork', project: 'coastal', title: '[Sample] Fieldwork & Sensor Deployment',
    description: 'Site selection, equipment calibration, deployment logs, and community fieldwork coordination.',
    status: 'Active', stage: 'Data Collection',
    stages: ['Preparation & Setup', 'Data Collection', 'Data Preparation', 'Data Analysis', 'Published / Complete'],
  },
  {
    key: 'heat-analysis', project: 'coastal', title: '[Sample] Heat Exposure Analysis',
    description: 'Clean sensor feeds, derive exposure indicators, and model variation across neighbourhoods.',
    status: 'Active', stage: 'Data Analysis',
    stages: ['Data Preparation', 'Data Analysis', 'Interpretation & Synthesis', 'Internal Review', 'Published / Complete'],
  },
  {
    key: 'protocol', project: 'screening', title: '[Sample] Screening Protocol',
    description: 'Define eligibility criteria, reviewer guidance, conflict resolution, and audit requirements.',
    status: 'Active', stage: 'Study Design & Protocol',
    stages: ['Concept & Ideation', 'Literature Review', 'Study Design & Protocol', 'Preparation & Setup', 'Published / Complete'],
  },
  {
    key: 'evidence', project: 'screening', title: '[Sample] Evidence Synthesis',
    description: 'Pilot the screening workflow, assess agreement, and synthesise findings for the methods paper.',
    status: 'Active', stage: 'Literature Review',
    stages: ['Literature Review', 'Data Collection', 'Data Analysis', 'Drafting & Writing', 'Under External Review', 'Published / Complete'],
  },
  {
    key: 'survey-report', project: 'sleep', title: '[Sample] Survey Report & Manuscript',
    description: 'Consolidate survey results, visualise key patterns, and prepare the manuscript and stakeholder report.',
    status: 'Review', stage: 'Drafting & Writing',
    stages: ['Data Preparation', 'Data Analysis', 'Interpretation & Synthesis', 'Drafting & Writing', 'Internal Review', 'Published / Complete'],
  },
];

const tasks = [
  { title: '[Sample] Calibrate field sensors', description: 'Run calibration checks and record offsets before the next deployment.', project: 'coastal', module: 'fieldwork', status: 'Underway', priority: 'High', hours: '4.00', due: '2026-09-02' },
  { title: '[Sample] Confirm fieldwork schedule', description: 'Confirm site contacts, access windows, and the field team roster.', project: 'coastal', module: 'fieldwork', status: 'To do', priority: 'Critical', hours: '2.50', due: '2026-08-29' },
  { title: '[Sample] Clean temperature dataset', description: 'Flag sensor gaps, standardise timestamps, and document exclusion rules.', project: 'coastal', module: 'heat-analysis', status: 'To do', priority: 'High', hours: '8.00', due: '2026-09-12' },
  { title: '[Sample] Finalise inclusion criteria', description: 'Resolve edge cases and prepare examples for the reviewer handbook.', project: 'screening', module: 'protocol', status: 'Underway', priority: 'Critical', hours: '5.00', due: '2026-09-05' },
  { title: '[Sample] Pilot 100 abstracts', description: 'Run a paired pilot and calculate reviewer and AI-assisted agreement.', project: 'screening', module: 'evidence', status: 'To do', priority: 'High', hours: '10.00', due: '2026-09-18' },
  { title: '[Sample] Validate survey dataset', description: 'Check missingness, coding consistency, and analysis-ready variable labels.', project: 'sleep', module: 'survey-report', status: 'Complete', priority: 'High', hours: '6.00', due: '2026-08-22' },
  { title: '[Sample] Draft results narrative', description: 'Write the first results section around the approved tables and figures.', project: 'sleep', module: 'survey-report', status: 'Underway', priority: 'Medium', hours: '8.00', due: '2026-09-09' },
  { title: '[Sample] Prepare stakeholder briefing', description: 'Create a concise summary of findings, limitations, and recommended next steps.', project: 'sleep', module: 'survey-report', status: 'Waiting', priority: 'Medium', hours: '4.00', due: '2026-09-21' },
];

const notes = [
  { title: '[Sample] Coastal study kickoff decisions', content: 'Agreed to prioritise three contrasting neighbourhoods. Sensor placement will be paired with short resident interviews, and all deployment changes will be recorded in the fieldwork module.', project: 'coastal', module: 'fieldwork', noteDate: '2026-08-12T09:30:00+10:00' },
  { title: '[Sample] Fieldwork observation — western site', content: 'Afternoon shade conditions differed from the site plan. Add a second ambient sensor near the community centre and annotate the change before analysis.', project: 'coastal', module: 'fieldwork', noteDate: '2026-08-24T15:45:00+10:00' },
  { title: '[Sample] Screening protocol decision', content: 'Borderline studies will remain in the title/abstract set and be resolved during full-text review. The AI recommendation is advisory and must retain an auditable reviewer decision.', project: 'screening', module: 'protocol', noteDate: '2026-08-21T11:00:00+10:00' },
  { title: '[Sample] Survey analysis checkpoint', content: 'Primary models are stable after the missing-data sensitivity check. Next review should focus on subgroup interpretation and avoiding causal language in the discussion.', project: 'sleep', module: 'survey-report', noteDate: '2026-08-25T10:15:00+10:00' },
  { title: '[Sample] Weekly research roundup', content: 'This week: fieldwork preparation is on track, screening criteria need one final review, and the sleep survey manuscript has moved into drafting. Prioritise the two critical tasks before Friday.', noteDate: '2026-08-25T16:00:00+10:00' },
];

async function enumId(category, value) {
  const result = await client.query(
    `select id from "enum"
       where category = $1 and value = $2
         and project_id is null and module_id is null
       order by (tenant_id is null) desc, sort_order
       limit 1`,
    [category, value],
  );
  if (!result.rows[0]) throw new Error(`Missing enum value ${category}/${value}`);
  return result.rows[0].id;
}

async function enumMap(category, values) {
  const entries = [];
  for (const value of values) entries.push([value, await enumId(category, value)]);
  return Object.fromEntries(entries);
}

async function nextDisplayId(tenantId, entityType, prefix) {
  await client.query(
    `insert into tenant_sequences (tenant_id, entity_type, last_value)
     values ($1, $2, 0)
     on conflict (tenant_id, entity_type) do nothing`,
    [tenantId, entityType],
  );
  const result = await client.query(
    `update tenant_sequences
        set last_value = last_value + 1, updated_at = now()
      where tenant_id = $1 and entity_type = $2
      returning last_value`,
    [tenantId, entityType],
  );
  return `${prefix}-${String(result.rows[0].last_value).padStart(4, '0')}`;
}

async function createScopedStages({ tenantId, projectId = null, moduleId = null, category, values }) {
  const ids = new Map();
  for (const [index, value] of values.entries()) {
    const result = await client.query(
      `insert into "enum" (tenant_id, project_id, module_id, category, value, sort_order)
       values ($1, $2, $3, $4, $5, $6)
       returning id`,
      [tenantId, projectId, moduleId, category, value, index + 1],
    );
    ids.set(value, result.rows[0].id);
  }
  return ids;
}

async function main() {
  await client.connect();

  const contextResult = await client.query(
    `select wc.tenant_id, wc.user_id, wc.updated_at, t.name as tenant_name, t.slug as tenant_slug,
            u.display_name, tm.role
       from workspace_contexts wc
       join tenants t on t.id = wc.tenant_id and t.status = 'active'
       join users u on u.id = wc.user_id and u.status = 'active'
       join tenant_memberships tm on tm.tenant_id = wc.tenant_id and tm.user_id = wc.user_id and tm.status = 'active'
      order by wc.updated_at desc`,
  );
  if (listWorkspaces) {
    for (const candidate of contextResult.rows) {
      console.log(`${candidate.tenant_slug}\t${candidate.tenant_name}\t${candidate.display_name}\t${candidate.role}`);
    }
    return;
  }

  const context = workspaceSlug
    ? contextResult.rows.find((candidate) => candidate.tenant_slug === workspaceSlug)
    : contextResult.rows[0];
  if (!context) throw new Error('No active workspace context was found.');

  if (!dryRun && !workspaceSlug && contextResult.rows.length > 1) {
    throw new Error('Multiple active workspace contexts exist. Run with --workspace=<slug> to select one explicitly.');
  }

  await client.query(`select set_config('app.current_user_id', $1, false)`, [context.user_id]);
  await client.query(`select set_config('app.current_tenant_id', $1, false)`, [context.tenant_id]);

  const projectCount = await client.query(
    `select count(*)::int as count from projects where tenant_id = $1 and archived_at is null`,
    [context.tenant_id],
  );

  console.log(`Target workspace: ${context.tenant_name}`);
  console.log(`Workspace user: ${context.display_name} (${context.role})`);
  console.log(`Existing active projects: ${projectCount.rows[0].count}`);

  if (dedupe) {
    await client.query('begin');
    try {
      await client.query(`select set_config('app.current_user_id', $1, true)`, [context.user_id]);
      await client.query(`select set_config('app.current_tenant_id', $1, true)`, [context.tenant_id]);
      const removedProjects = await client.query(
        `with ranked as (
           select id, row_number() over (partition by title order by created_at, id) as copy_number
             from projects
            where tenant_id = $1 and title like '[Sample] %'
         )
         delete from projects p using ranked r
          where p.id = r.id and r.copy_number > 1
         returning p.id`,
        [context.tenant_id],
      );
      const removedNotes = await client.query(
        `with ranked as (
           select id, row_number() over (partition by title order by note_date, id) as copy_number
             from notes
            where tenant_id = $1 and project_id is null and module_id is null and title like '[Sample] %'
         )
         delete from notes n using ranked r
          where n.id = r.id and r.copy_number > 1
         returning n.id`,
        [context.tenant_id],
      );
      await client.query('commit');
      console.log(`Removed ${removedProjects.rowCount} duplicate sample projects and ${removedNotes.rowCount} duplicate standalone notes.`);
      return;
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  }

  const existing = await client.query(
    `select count(*)::int as count from projects where tenant_id = $1 and title like '[Sample] %'`,
    [context.tenant_id],
  );
  if (existing.rows[0].count > 0) {
    const ownerRoleId = await enumId('project_role', 'Owner');
    const repaired = await client.query(
      `insert into project_collaborators (tenant_id, project_id, user_id, role_id)
       select p.tenant_id, p.id, p.user_id, $2
         from projects p
        where p.tenant_id = $1 and p.title like '[Sample] %' and p.archived_at is null
       on conflict (project_id, user_id) do nothing
       returning id`,
      [context.tenant_id, ownerRoleId],
    );
    console.log(`Sample data already exists (${existing.rows[0].count} sample projects); no duplicates created.`);
    console.log(`Repaired ${repaired.rowCount} missing project owner links.`);
    return;
  }

  if (dryRun) {
    console.log(`Dry run: would create ${projects.length} projects, ${modules.length} modules, ${tasks.length} tasks, and ${notes.length} notes.`);
    return;
  }

  await client.query('begin');
  try {
    await client.query(`select set_config('app.current_user_id', $1, true)`, [context.user_id]);
    await client.query(`select set_config('app.current_tenant_id', $1, true)`, [context.tenant_id]);

    const projectStatus = await enumMap('project_status', ['Active', 'Review']);
    const importance = await enumMap('importance', ['Medium', 'High', 'Critical']);
    const taskStatus = await enumMap('task_status', ['To do', 'Underway', 'Waiting', 'Complete']);
    const visibilityPrivate = await enumId('visibility', 'Private');
    const ownerRoleId = await enumId('project_role', 'Owner');

    const projectIds = new Map();
    for (const project of projects) {
      const displayId = await nextDisplayId(context.tenant_id, 'project', 'PRJ');
      const inserted = await client.query(
        `insert into projects
          (display_id, user_id, tenant_id, title, description, research_area, status_id, importance_id,
           scheduled_for, due_date, total_budget, target_journals)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         returning id`,
        [displayId, context.user_id, context.tenant_id, project.title, project.description, project.researchArea,
          projectStatus[project.status], importance[project.importance], project.scheduledFor, project.dueDate,
          project.totalBudget, project.targetJournals],
      );
      const projectId = inserted.rows[0].id;
      await client.query(
        `insert into project_collaborators (tenant_id, project_id, user_id, role_id)
         values ($1, $2, $3, $4)`,
        [context.tenant_id, projectId, context.user_id, ownerRoleId],
      );
      const stages = await createScopedStages({ tenantId: context.tenant_id, projectId, category: 'project_pipeline_stage', values: projectStagePool });
      await client.query('update projects set pipeline_stage_id = $1 where id = $2', [stages.get(project.stage), projectId]);
      projectIds.set(project.key, projectId);
    }

    const moduleIds = new Map();
    for (const module of modules) {
      const displayId = await nextDisplayId(context.tenant_id, 'module', 'MOD');
      const inserted = await client.query(
        `insert into modules
          (display_id, project_id, tenant_id, title, description, status_id, assigned_to_user_id)
         values ($1,$2,$3,$4,$5,$6,$7)
         returning id`,
        [displayId, projectIds.get(module.project), context.tenant_id, module.title, module.description,
          projectStatus[module.status], context.user_id],
      );
      const moduleId = inserted.rows[0].id;
      const stages = await createScopedStages({ tenantId: context.tenant_id, moduleId, category: 'module_pipeline_stage', values: module.stages });
      await client.query('update modules set pipeline_stage_id = $1 where id = $2', [stages.get(module.stage), moduleId]);
      moduleIds.set(module.key, moduleId);
    }

    for (const task of tasks) {
      const displayId = await nextDisplayId(context.tenant_id, 'task', 'TSK');
      await client.query(
        `insert into tasks
          (display_id, tenant_id, project_id, module_id, created_by, title, description, status_id,
           priority_id, visibility_id, estimated_hours, due_date)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [displayId, context.tenant_id, projectIds.get(task.project), moduleIds.get(task.module), context.user_id,
          task.title, task.description, taskStatus[task.status], importance[task.priority], visibilityPrivate,
          task.hours, task.due],
      );
    }

    for (const note of notes) {
      const displayId = await nextDisplayId(context.tenant_id, 'note', 'NTE');
      await client.query(
        `insert into notes
          (display_id, tenant_id, project_id, module_id, created_by, title, content, visibility_id, note_date)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [displayId, context.tenant_id, note.project ? projectIds.get(note.project) : null,
          note.module ? moduleIds.get(note.module) : null, context.user_id, note.title, note.content,
          visibilityPrivate, note.noteDate],
      );
    }

    await client.query('commit');
    console.log(`Created ${projects.length} projects, ${modules.length} modules, ${tasks.length} tasks, and ${notes.length} notes.`);
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
}

try {
  await main();
} finally {
  await client.end().catch(() => undefined);
}
