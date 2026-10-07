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

@Injectable()
export class UsersService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly supabaseAdmin: SupabaseAdminService,
  ) {}

  /**
   * Search active registered users visible under RLS, together with contacts
   * this user has previously invited to a project, paper, task, or note.
   *
   * Results are deduplicated by normalized email. When a registered user is
   * visible, it takes precedence; otherwise, the most recently updated
   * invitation supplies the contact details.
   */
  async search(query: string, invitedByUserId: string, limit = 8) {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const pattern = `%${trimmed}%`;
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
            AND (
              users.display_name ILIKE ${pattern}
              OR users.email ILIKE ${pattern}
            )
  
          UNION ALL
  
          SELECT
            'contact:' || lower(project_invitations.email) AS id,
            COALESCE(
              NULLIF(BTRIM(project_invitations.name), ''),
              project_invitations.email
            ) AS display_name,
            project_invitations.email,
            project_invitations.affiliation,
            1 AS source_priority,
            project_invitations.updated_at
          FROM project_invitations
          WHERE project_invitations.invited_by = ${invitedByUserId}
            AND (
              project_invitations.name ILIKE ${pattern}
              OR project_invitations.email ILIKE ${pattern}
            )
  
          UNION ALL
  
          SELECT
            'contact:' || lower(module_invitations.email) AS id,
            COALESCE(
              NULLIF(BTRIM(module_invitations.name), ''),
              module_invitations.email
            ) AS display_name,
            module_invitations.email,
            module_invitations.affiliation,
            1 AS source_priority,
            module_invitations.updated_at
          FROM module_invitations
          WHERE module_invitations.invited_by = ${invitedByUserId}
            AND (
              module_invitations.name ILIKE ${pattern}
              OR module_invitations.email ILIKE ${pattern}
            )
  
          UNION ALL
  
          SELECT
            'contact:' || lower(task_invitations.email) AS id,
            COALESCE(
              NULLIF(BTRIM(task_invitations.name), ''),
              task_invitations.email
            ) AS display_name,
            task_invitations.email,
            task_invitations.affiliation,
            1 AS source_priority,
            task_invitations.updated_at
          FROM task_invitations
          WHERE task_invitations.invited_by = ${invitedByUserId}
            AND (
              task_invitations.name ILIKE ${pattern}
              OR task_invitations.email ILIKE ${pattern}
            )
  
          UNION ALL
  
          SELECT
            'contact:' || lower(note_invitations.email) AS id,
            COALESCE(
              NULLIF(BTRIM(note_invitations.name), ''),
              note_invitations.email
            ) AS display_name,
            note_invitations.email,
            note_invitations.affiliation,
            1 AS source_priority,
            note_invitations.updated_at
          FROM note_invitations
          WHERE note_invitations.invited_by = ${invitedByUserId}
            AND (
              note_invitations.name ILIKE ${pattern}
              OR note_invitations.email ILIKE ${pattern}
            )
        ),
        ranked AS (
          SELECT
            id,
            display_name,
            email,
            affiliation,
            ROW_NUMBER() OVER (
              PARTITION BY lower(email)
              ORDER BY source_priority, updated_at DESC
            ) AS email_rank
          FROM candidates
        )
        SELECT
          id,
          display_name,
          email,
          affiliation
        FROM ranked
        WHERE email_rank = 1
        ORDER BY lower(display_name), lower(email)
        LIMIT ${limit}
      `);

    return (
      result.rows as Array<{
        id: string;
        display_name: string;
        email: string;
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
    const [existing] = await this.drizzle.db
      .select()
      .from(users)
      .where(eq(users.externalAuthId, externalAuthId));

    if (!existing) {
      throw new NotFoundException('User not found');
    }

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

    const [created] = await this.drizzle.db
      .insert(users)
      .values({
        externalAuthId,
        email,
        displayName,
        status: 'active',
      })
      .returning();

    return created;
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

    if (!updated) {
      throw new NotFoundException('User not found');
    }

    return updated;
  }
}
