CREATE TABLE "research_change_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"field_name" text,
	"from_value" jsonb,
	"to_value" jsonb,
	"changed_by" uuid,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "research_change_events_entity_type_check" CHECK ("research_change_events"."entity_type" IN ('paper', 'submission', 'task', 'funding')),
	CONSTRAINT "research_change_events_action_check" CHECK ("research_change_events"."action" IN ('created', 'updated', 'deleted'))
);
--> statement-breakpoint
ALTER TABLE "research_change_events" ADD CONSTRAINT "research_change_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_change_events" ADD CONSTRAINT "research_change_events_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "research_change_events_tenant_id_changed_at_idx" ON "research_change_events" USING btree ("tenant_id","changed_at");--> statement-breakpoint
CREATE INDEX "research_change_events_tenant_entity_field_changed_at_idx" ON "research_change_events" USING btree ("tenant_id","entity_type","field_name","changed_at");--> statement-breakpoint
CREATE INDEX "research_change_events_entity_changed_at_idx" ON "research_change_events" USING btree ("entity_type","entity_id","changed_at");--> statement-breakpoint

-- Workflow history is private application data. It is reachable only through
-- the API runtime role, with owners able to read their workspace and ordinary
-- members able to append only events attributed to their authenticated user.
ALTER TABLE "research_change_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "research_change_events" FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON TABLE "research_change_events" FROM anon, authenticated, service_role;--> statement-breakpoint
REVOKE ALL ON TABLE "research_change_events" FROM research_tracker_app;--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "research_change_events" TO research_tracker_app;--> statement-breakpoint

CREATE POLICY research_change_events_owner_select
ON "research_change_events"
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM tenants
    WHERE tenants.id = research_change_events.tenant_id
      AND tenants.owner_user_id = NULLIF(
        current_setting('app.current_user_id', true),
        ''
      )::uuid
  )
);--> statement-breakpoint

CREATE POLICY research_change_events_actor_insert
ON "research_change_events"
FOR INSERT
WITH CHECK (
  changed_by = NULLIF(
    current_setting('app.current_user_id', true),
    ''
  )::uuid
);--> statement-breakpoint

-- The request interceptor sets app.current_user_id inside the transaction (and
-- app.current_tenant_id on tenant-scoped routes). These trigger functions
-- capture the genuine actor from every present and future UI entry point.
CREATE OR REPLACE FUNCTION internal.record_paper_research_changes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  actor_id uuid := NULLIF(
    current_setting('app.current_user_id', true),
    ''
  )::uuid;
  old_stage jsonb;
  new_stage jsonb;
  old_status jsonb;
  new_status jsonb;
  old_priority jsonb;
  new_priority jsonb;
  old_holder jsonb;
  new_holder jsonb;
BEGIN
  IF actor_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.pipeline_stage_id IS NOT NULL THEN
      SELECT to_jsonb(value) INTO new_stage
      FROM "enum" WHERE id = NEW.pipeline_stage_id;

      INSERT INTO research_change_events (
        tenant_id, entity_type, entity_id, action, field_name,
        from_value, to_value, changed_by, changed_at
      ) VALUES (
        NEW.tenant_id, 'paper', NEW.id, 'created', 'pipeline_stage',
        NULL, new_stage, actor_id,
        COALESCE(NEW.pipeline_stage_changed_at, NEW.created_at, now())
      );
    END IF;

    IF NEW.status_id IS NOT NULL THEN
      SELECT to_jsonb(value) INTO new_status
      FROM "enum" WHERE id = NEW.status_id;

      INSERT INTO research_change_events (
        tenant_id, entity_type, entity_id, action, field_name,
        from_value, to_value, changed_by
      ) VALUES (
        NEW.tenant_id, 'paper', NEW.id, 'created', 'status',
        NULL, new_status, actor_id
      );
    END IF;

    IF NEW.priority_id IS NOT NULL THEN
      SELECT to_jsonb(value) INTO new_priority
      FROM "enum" WHERE id = NEW.priority_id;

      INSERT INTO research_change_events (
        tenant_id, entity_type, entity_id, action, field_name,
        from_value, to_value, changed_by
      ) VALUES (
        NEW.tenant_id, 'paper', NEW.id, 'created', 'priority',
        NULL, new_priority, actor_id
      );
    END IF;

    IF NEW.currently_with_type IS NOT NULL THEN
      new_holder := jsonb_strip_nulls(jsonb_build_object(
        'type', NEW.currently_with_type,
        'userId', NEW.assigned_to_user_id,
        'invitationId', NEW.assigned_to_invitation_id
      ));

      INSERT INTO research_change_events (
        tenant_id, entity_type, entity_id, action, field_name,
        from_value, to_value, changed_by
      ) VALUES (
        NEW.tenant_id, 'paper', NEW.id, 'created', 'currently_with',
        NULL, new_holder, actor_id
      );
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.pipeline_stage_id IS DISTINCT FROM OLD.pipeline_stage_id THEN
    SELECT to_jsonb(value) INTO old_stage
    FROM "enum" WHERE id = OLD.pipeline_stage_id;
    SELECT to_jsonb(value) INTO new_stage
    FROM "enum" WHERE id = NEW.pipeline_stage_id;

    INSERT INTO research_change_events (
      tenant_id, entity_type, entity_id, action, field_name,
      from_value, to_value, changed_by, changed_at
    ) VALUES (
      NEW.tenant_id, 'paper', NEW.id, 'updated', 'pipeline_stage',
      old_stage, new_stage, actor_id,
      COALESCE(NEW.pipeline_stage_changed_at, now())
    );
  END IF;

  IF NEW.status_id IS DISTINCT FROM OLD.status_id THEN
    SELECT to_jsonb(value) INTO old_status
    FROM "enum" WHERE id = OLD.status_id;
    SELECT to_jsonb(value) INTO new_status
    FROM "enum" WHERE id = NEW.status_id;

    INSERT INTO research_change_events (
      tenant_id, entity_type, entity_id, action, field_name,
      from_value, to_value, changed_by
    ) VALUES (
      NEW.tenant_id, 'paper', NEW.id, 'updated', 'status',
      old_status, new_status, actor_id
    );
  END IF;

  IF NEW.priority_id IS DISTINCT FROM OLD.priority_id THEN
    SELECT to_jsonb(value) INTO old_priority
    FROM "enum" WHERE id = OLD.priority_id;
    SELECT to_jsonb(value) INTO new_priority
    FROM "enum" WHERE id = NEW.priority_id;

    INSERT INTO research_change_events (
      tenant_id, entity_type, entity_id, action, field_name,
      from_value, to_value, changed_by
    ) VALUES (
      NEW.tenant_id, 'paper', NEW.id, 'updated', 'priority',
      old_priority, new_priority, actor_id
    );
  END IF;

  IF ROW(
    NEW.currently_with_type,
    NEW.assigned_to_user_id,
    NEW.assigned_to_invitation_id
  ) IS DISTINCT FROM ROW(
    OLD.currently_with_type,
    OLD.assigned_to_user_id,
    OLD.assigned_to_invitation_id
  ) THEN
    old_holder := jsonb_strip_nulls(jsonb_build_object(
      'type', OLD.currently_with_type,
      'userId', OLD.assigned_to_user_id,
      'invitationId', OLD.assigned_to_invitation_id
    ));
    new_holder := jsonb_strip_nulls(jsonb_build_object(
      'type', NEW.currently_with_type,
      'userId', NEW.assigned_to_user_id,
      'invitationId', NEW.assigned_to_invitation_id
    ));

    INSERT INTO research_change_events (
      tenant_id, entity_type, entity_id, action, field_name,
      from_value, to_value, changed_by
    ) VALUES (
      NEW.tenant_id, 'paper', NEW.id, 'updated', 'currently_with',
      old_holder, new_holder, actor_id
    );
  END IF;

  IF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
    INSERT INTO research_change_events (
      tenant_id, entity_type, entity_id, action, field_name,
      from_value, to_value, changed_by
    ) VALUES (
      NEW.tenant_id, 'paper', NEW.id, 'updated', 'archived',
      to_jsonb(OLD.archived_at IS NOT NULL),
      to_jsonb(NEW.archived_at IS NOT NULL),
      actor_id
    );
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION internal.record_submission_research_changes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  actor_id uuid := NULLIF(
    current_setting('app.current_user_id', true),
    ''
  )::uuid;
BEGIN
  IF actor_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO research_change_events (
      tenant_id, entity_type, entity_id, action,
      to_value, changed_by
    ) VALUES (
      NEW.tenant_id,
      'submission',
      NEW.id,
      'created',
      jsonb_strip_nulls(jsonb_build_object(
        'paperId', NEW.module_id,
        'status', NEW.status,
        'journal', NEW.journal_name,
        'submittedDate', NEW.submitted_date,
        'decisionDate', NEW.decision_date
      )),
      actor_id
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO research_change_events (
      tenant_id, entity_type, entity_id, action,
      from_value, changed_by
    ) VALUES (
      OLD.tenant_id,
      'submission',
      OLD.id,
      'deleted',
      jsonb_strip_nulls(jsonb_build_object(
        'paperId', OLD.module_id,
        'status', OLD.status,
        'journal', OLD.journal_name,
        'submittedDate', OLD.submitted_date,
        'decisionDate', OLD.decision_date
      )),
      actor_id
    );
    RETURN OLD;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO research_change_events (
      tenant_id, entity_type, entity_id, action, field_name,
      from_value, to_value, changed_by
    ) VALUES (
      NEW.tenant_id, 'submission', NEW.id, 'updated', 'status',
      to_jsonb(OLD.status), to_jsonb(NEW.status), actor_id
    );
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION internal.record_task_research_changes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  actor_id uuid := NULLIF(
    current_setting('app.current_user_id', true),
    ''
  )::uuid;
  old_status jsonb;
  new_status jsonb;
BEGIN
  IF actor_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status_id IS NOT NULL THEN
      SELECT to_jsonb(value) INTO new_status
      FROM "enum" WHERE id = NEW.status_id;

      INSERT INTO research_change_events (
        tenant_id, entity_type, entity_id, action, field_name,
        from_value, to_value, changed_by
      ) VALUES (
        NEW.tenant_id, 'task', NEW.id, 'created', 'status',
        NULL, new_status, actor_id
      );
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status_id IS DISTINCT FROM OLD.status_id THEN
    SELECT to_jsonb(value) INTO old_status
    FROM "enum" WHERE id = OLD.status_id;
    SELECT to_jsonb(value) INTO new_status
    FROM "enum" WHERE id = NEW.status_id;

    INSERT INTO research_change_events (
      tenant_id, entity_type, entity_id, action, field_name,
      from_value, to_value, changed_by
    ) VALUES (
      NEW.tenant_id, 'task', NEW.id, 'updated', 'status',
      old_status, new_status, actor_id
    );
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION internal.record_funding_research_changes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  actor_id uuid := NULLIF(
    current_setting('app.current_user_id', true),
    ''
  )::uuid;
BEGIN
  IF actor_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.status IS NOT NULL THEN
    INSERT INTO research_change_events (
      tenant_id, entity_type, entity_id, action, field_name,
      from_value, to_value, changed_by
    ) VALUES (
      NEW.tenant_id, 'funding', NEW.id, 'created', 'status',
      NULL, to_jsonb(NEW.status), actor_id
    );
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO research_change_events (
      tenant_id, entity_type, entity_id, action, field_name,
      from_value, to_value, changed_by
    ) VALUES (
      NEW.tenant_id, 'funding', NEW.id, 'updated', 'status',
      to_jsonb(OLD.status), to_jsonb(NEW.status), actor_id
    );
  END IF;

  RETURN NEW;
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION internal.record_paper_research_changes() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION internal.record_submission_research_changes() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION internal.record_task_research_changes() FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION internal.record_funding_research_changes() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION internal.record_paper_research_changes() TO research_tracker_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION internal.record_submission_research_changes() TO research_tracker_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION internal.record_task_research_changes() TO research_tracker_app;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION internal.record_funding_research_changes() TO research_tracker_app;--> statement-breakpoint

CREATE TRIGGER record_paper_research_changes
AFTER INSERT OR UPDATE OF
  pipeline_stage_id,
  status_id,
  priority_id,
  currently_with_type,
  assigned_to_user_id,
  assigned_to_invitation_id,
  archived_at
ON modules
FOR EACH ROW
EXECUTE FUNCTION internal.record_paper_research_changes();--> statement-breakpoint

CREATE TRIGGER record_submission_research_changes
AFTER INSERT OR UPDATE OF status OR DELETE
ON module_submissions
FOR EACH ROW
EXECUTE FUNCTION internal.record_submission_research_changes();--> statement-breakpoint

CREATE TRIGGER record_task_research_changes
AFTER INSERT OR UPDATE OF status_id
ON tasks
FOR EACH ROW
EXECUTE FUNCTION internal.record_task_research_changes();--> statement-breakpoint

CREATE TRIGGER record_funding_research_changes
AFTER INSERT OR UPDATE OF status
ON fundings
FOR EACH ROW
EXECUTE FUNCTION internal.record_funding_research_changes();--> statement-breakpoint

-- Seed one neutral baseline for each existing paper's current stage. These
-- rows support "time in current stage" from launch without inventing any
-- earlier transitions or attributing historical actions to a user.
INSERT INTO research_change_events (
  tenant_id,
  entity_type,
  entity_id,
  action,
  field_name,
  from_value,
  to_value,
  changed_by,
  changed_at
)
SELECT
  paper.tenant_id,
  'paper',
  paper.id,
  'created',
  'pipeline_stage',
  NULL,
  to_jsonb(stage.value),
  NULL,
  COALESCE(paper.pipeline_stage_changed_at, paper.created_at, now())
FROM modules paper
INNER JOIN "enum" stage ON stage.id = paper.pipeline_stage_id
WHERE paper.pipeline_stage_id IS NOT NULL;
