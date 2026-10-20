import { and, eq, inArray, sql } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { users } from '@research-tracker/migrations';
import type { DrizzleService } from '../db/drizzle.service';

/** Where to look for people already attached to a project, paper, task or note. */
export interface CollaboratorEmailSources {
  invitations: {
    table: PgTable;
    entityId: PgColumn;
    email: PgColumn;
    status: PgColumn;
  };
  members: { table: PgTable; entityId: PgColumn; userId: PgColumn };
  owner: { table: PgTable; id: PgColumn; userId: PgColumn };
}

export const DUPLICATE_COLLABORATOR_MESSAGE =
  'This person has already been added as a collaborator.';

/**
 * True when the email (already normalised to lower case) belongs to the
 * owner, an existing collaborator/member, or an open (draft or pending)
 * invitation on the given item.
 */
export async function isEmailAlreadyOnEntity(
  drizzle: DrizzleService,
  sources: CollaboratorEmailSources,
  entityId: string,
  email: string,
): Promise<boolean> {
  const db = drizzle.db;

  const [invitation] = await db
    .select({ found: sql<number>`1` })
    .from(sources.invitations.table)
    .where(
      and(
        eq(sources.invitations.entityId, entityId),
        sql`lower(${sources.invitations.email}) = ${email}`,
        inArray(sources.invitations.status, ['draft', 'pending']),
      ),
    )
    .limit(1);
  if (invitation) return true;

  const [member] = await db
    .select({ found: sql<number>`1` })
    .from(sources.members.table)
    .innerJoin(users, eq(users.id, sources.members.userId))
    .where(
      and(
        eq(sources.members.entityId, entityId),
        sql`lower(${users.email}) = ${email}`,
      ),
    )
    .limit(1);
  if (member) return true;

  const [owner] = await db
    .select({ found: sql<number>`1` })
    .from(sources.owner.table)
    .innerJoin(users, eq(users.id, sources.owner.userId))
    .where(
      and(
        eq(sources.owner.id, entityId),
        sql`lower(${users.email}) = ${email}`,
      ),
    )
    .limit(1);
  return Boolean(owner);
}
