import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { users } from '@research-tracker/migrations';
import { eq, inArray, sql } from 'drizzle-orm';
import { DrizzleService } from '../../db/drizzle.service';
import type { AuthenticatedPrincipal } from '../auth/jwt.strategy';
import { SupabaseAdminService } from '../auth/supabase-admin.service';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import { userLookupCache } from './user-lookup-cache';

@Injectable()
export class UsersService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly supabaseAdmin: SupabaseAdminService,
  ) {}
  /**
   * Search active registered users visible under RLS and contacts this
   * caller previously invited.
   *
   * Deduplicate by normalized email, preferring registered-user identity.
   * Contacts added with only a name (and maybe an affiliation) are included
   * too, deduplicated by name, unless someone with that name has an email.
   * Results put names starting with the query and the caller's own contacts
   * first, so they aren't pushed out by other registered users.
   * Use a non-empty profile institution when available; otherwise use
   * the latest non-empty affiliation from the caller's invitations.
   */
  async search(query: string, invitedByUserId: string, limit = 20) {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const pattern = `%${trimmed}%`;
    const prefixPattern = `${trimmed}%`;
    const result = await this.drizzle.db.execute(sql`
        WITH candidates AS (
          SELECT
            users.id::text AS id,
            users.display_name,
            users.email,
            users.institution AS affiliation,
            0 AS source_priority,
            users.updated_at
          FROM users
          WHERE users.status = 'active'

          UNION ALL

          SELECT
            'contact:' || lower(BTRIM(project_invitations.email)) AS id,
            COALESCE(NULLIF(BTRIM(project_invitations.name), ''), BTRIM(project_invitations.email)) AS display_name,
            BTRIM(project_invitations.email) AS email,
            project_invitations.affiliation,
            1 AS source_priority,
            project_invitations.updated_at
          FROM project_invitations
          WHERE project_invitations.invited_by = ${invitedByUserId}
            AND NULLIF(BTRIM(project_invitations.email), '') IS NOT NULL

          UNION ALL

          -- Contacts added with only a name (and maybe an affiliation).
          SELECT
            'contact:name:' || lower(BTRIM(project_invitations.name)) AS id,
            BTRIM(project_invitations.name) AS display_name,
            NULL AS email,
            project_invitations.affiliation,
            2 AS source_priority,
            project_invitations.updated_at
          FROM project_invitations
          WHERE project_invitations.invited_by = ${invitedByUserId}
            AND NULLIF(BTRIM(project_invitations.email), '') IS NULL
            AND NULLIF(BTRIM(project_invitations.name), '') IS NOT NULL

          UNION ALL

          SELECT
            'contact:' || lower(BTRIM(module_invitations.email)) AS id,
            COALESCE(NULLIF(BTRIM(module_invitations.name), ''), BTRIM(module_invitations.email)) AS display_name,
            BTRIM(module_invitations.email) AS email,
            module_invitations.affiliation,
            1 AS source_priority,
            module_invitations.updated_at
          FROM module_invitations
          WHERE module_invitations.invited_by = ${invitedByUserId}
            AND NULLIF(BTRIM(module_invitations.email), '') IS NOT NULL

          UNION ALL

          -- Contacts added with only a name (and maybe an affiliation).
          SELECT
            'contact:name:' || lower(BTRIM(module_invitations.name)) AS id,
            BTRIM(module_invitations.name) AS display_name,
            NULL AS email,
            module_invitations.affiliation,
            2 AS source_priority,
            module_invitations.updated_at
          FROM module_invitations
          WHERE module_invitations.invited_by = ${invitedByUserId}
            AND NULLIF(BTRIM(module_invitations.email), '') IS NULL
            AND NULLIF(BTRIM(module_invitations.name), '') IS NOT NULL

          UNION ALL

          SELECT
            'contact:' || lower(BTRIM(task_invitations.email)) AS id,
            COALESCE(NULLIF(BTRIM(task_invitations.name), ''), BTRIM(task_invitations.email)) AS display_name,
            BTRIM(task_invitations.email) AS email,
            task_invitations.affiliation,
            1 AS source_priority,
            task_invitations.updated_at
          FROM task_invitations
          WHERE task_invitations.invited_by = ${invitedByUserId}
            AND NULLIF(BTRIM(task_invitations.email), '') IS NOT NULL

          UNION ALL

          -- Contacts added with only a name (and maybe an affiliation).
          SELECT
            'contact:name:' || lower(BTRIM(task_invitations.name)) AS id,
            BTRIM(task_invitations.name) AS display_name,
            NULL AS email,
            task_invitations.affiliation,
            2 AS source_priority,
            task_invitations.updated_at
          FROM task_invitations
          WHERE task_invitations.invited_by = ${invitedByUserId}
            AND NULLIF(BTRIM(task_invitations.email), '') IS NULL
            AND NULLIF(BTRIM(task_invitations.name), '') IS NOT NULL

          UNION ALL

          SELECT
            'contact:' || lower(BTRIM(note_invitations.email)) AS id,
            COALESCE(NULLIF(BTRIM(note_invitations.name), ''), BTRIM(note_invitations.email)) AS display_name,
            BTRIM(note_invitations.email) AS email,
            note_invitations.affiliation,
            1 AS source_priority,
            note_invitations.updated_at
          FROM note_invitations
          WHERE note_invitations.invited_by = ${invitedByUserId}
            AND NULLIF(BTRIM(note_invitations.email), '') IS NOT NULL

          UNION ALL

          -- Contacts added with only a name (and maybe an affiliation).
          SELECT
            'contact:name:' || lower(BTRIM(note_invitations.name)) AS id,
            BTRIM(note_invitations.name) AS display_name,
            NULL AS email,
            note_invitations.affiliation,
            2 AS source_priority,
            note_invitations.updated_at
          FROM note_invitations
          WHERE note_invitations.invited_by = ${invitedByUserId}
            AND NULLIF(BTRIM(note_invitations.email), '') IS NULL
            AND NULLIF(BTRIM(note_invitations.name), '') IS NOT NULL
        ),
        keyed AS (
          SELECT
            candidates.*,
            -- People with an email are identified by it; name-only contacts
            -- by their name.
            COALESCE(
              lower(BTRIM(email)),
              'name:' || lower(BTRIM(display_name))
            ) AS identity
          FROM candidates
        ),
        ranked AS (
          SELECT
            id,
            display_name,
            email,
            FIRST_VALUE(NULLIF(BTRIM(affiliation), '')) OVER (
              PARTITION BY identity
              ORDER BY
                CASE
                  WHEN NULLIF(BTRIM(affiliation), '') IS NULL THEN 1
                  ELSE 0
                END,
                source_priority,
                updated_at DESC NULLS LAST,
                id,
                affiliation
            ) AS affiliation,
            ROW_NUMBER() OVER (
              PARTITION BY identity
              ORDER BY
                source_priority,
                updated_at DESC NULLS LAST,
                id
            ) AS identity_rank,
            BOOL_OR(
              display_name ILIKE ${pattern}
              OR email ILIKE ${pattern}
            ) OVER (
              PARTITION BY identity
            ) AS matches_query,
            -- Skip a name-only contact when someone with the same name and an
            -- email is already a candidate, so the same person isn't listed twice.
            BOOL_OR(email IS NOT NULL) OVER (
              PARTITION BY lower(BTRIM(display_name))
            ) AS name_has_email
          FROM keyed
        )
        SELECT
          id,
          display_name,
          email,
          affiliation
        FROM ranked
        WHERE identity_rank = 1
          AND matches_query
          AND (email IS NOT NULL OR NOT name_has_email)
        -- Best matches first: names starting with the search, then the
        -- caller's own contacts, then everyone else alphabetically.
        ORDER BY
          CASE WHEN display_name ILIKE ${prefixPattern} THEN 0 ELSE 1 END,
          CASE WHEN id LIKE 'contact:%' THEN 0 ELSE 1 END,
          lower(display_name),
          lower(email) NULLS LAST
        LIMIT ${limit}
      `);

    return (
      result.rows as Array<{
        id: string;
        display_name: string;
        email: string | null;
        affiliation: string | null;
      }>
    ).map((row) => ({
      id: row.id,
      displayName: row.display_name,
      email: row.email,
      affiliation: row.affiliation,
    }));
  }

  async findSummariesByIds(userIds: string[]) {
    const uniqueIds = [...new Set(userIds)];
    if (uniqueIds.length === 0) return [];

    return this.drizzle.db
      .select({
        id: users.id,
        displayName: users.displayName,
        email: users.email,
        affiliation: users.institution,
      })
      .from(users)
      .where(inArray(users.id, uniqueIds));
  }

  async findByExternalAuthId(externalAuthId: string) {
    const cached = userLookupCache.get(externalAuthId);
    if (cached) return cached;

    const [existing] = await this.drizzle.db
      .select()
      .from(users)
      .where(eq(users.externalAuthId, externalAuthId));

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    userLookupCache.set(externalAuthId, existing);
    return existing;
  }

  async findOrProvisionFromPrincipal(principal: AuthenticatedPrincipal) {
    const externalAuthId = principal.sub;
    const [existing] = await this.drizzle.db
      .select()
      .from(users)
      .where(eq(users.externalAuthId, externalAuthId));

    // Existing correctly provisioned users do not require a network call on every request.
    if (existing && !existing.email.endsWith('@pending.local')) {
      return existing;
    }

    // Supabase access tokens remain valid until they expire even after an
    // Auth user is deleted. Confirm the identity still exists before any
    // provisioning path so a stale token cannot recreate a deleted account.
    await this.supabaseAdmin.assertUserExists(externalAuthId);

    const email = principal.email?.trim().toLowerCase();
    if (!email) {
      throw new UnauthorizedException(
        'Supabase access token does not contain an email claim',
      );
    }

    const displayName: string =
      principal.displayName?.trim() || email.split('@')[0] || email;

    userLookupCache.forget({ externalAuthId, id: existing?.id });

    if (existing) {
      const [updated] = await this.drizzle.db
        .update(users)
        .set({ email, displayName, updatedAt: new Date() })
        .where(eq(users.id, existing.id))
        .returning();
      return updated;
    }

    const [sameEmail] = await this.drizzle.db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (
      sameEmail?.externalAuthId &&
      sameEmail.externalAuthId !== externalAuthId
    ) {
      throw new ConflictException(
        'This email is already linked to another identity',
      );
    }

    if (sameEmail) {
      userLookupCache.forget({ id: sameEmail.id });
      const [linked] = await this.drizzle.db
        .update(users)
        .set({
          externalAuthId,
          displayName,
          status: 'active',
          updatedAt: new Date(),
        })
        .where(eq(users.id, sameEmail.id))
        .returning();
      return linked;
    }

    // The web app loads the account and the workspace at the same time, so
    // two requests can try to create a brand-new user at once. Skip the
    // insert if the other request got there first (Postgres waits for it to
    // commit), then read back the row it created.
    const [created] = await this.drizzle.db
      .insert(users)
      .values({
        externalAuthId,
        email,
        displayName,
        status: 'active',
      })
      .onConflictDoNothing()
      .returning();

    if (created) return created;

    const [concurrentlyCreated] = await this.drizzle.db
      .select()
      .from(users)
      .where(eq(users.externalAuthId, externalAuthId));

    if (!concurrentlyCreated) {
      throw new ConflictException(
        'This email is already linked to another identity',
      );
    }

    return concurrentlyCreated;
  }

  async updateProfile(userId: string, input: UpdateProfileDto) {
    const optionalText = (value: string | undefined) => {
      if (value === undefined) return undefined;
      return value.trim() || null;
    };

    const [updated] = await this.drizzle.db
      .update(users)
      .set({
        displayName: input.displayName?.trim(),
        jobTitle: optionalText(input.jobTitle),
        institution: optionalText(input.institution),
        department: optionalText(input.department),
        phone: optionalText(input.phone),
        researchInterests: optionalText(input.researchInterests),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    userLookupCache.forget({ id: userId });

    if (!updated) {
      throw new NotFoundException('User not found');
    }

    return updated;
  }
}
