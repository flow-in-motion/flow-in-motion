import { Injectable, NotFoundException } from '@nestjs/common';
import {
  invitations,
  moduleInvitations,
  noteInvitations,
  projectInvitations,
  taskInvitations,
  users,
} from '@research-tracker/migrations';
import { and, eq, sql, type AnyColumn } from 'drizzle-orm';
import { DrizzleService } from '../../db/drizzle.service';
import { SupabaseAdminService } from '../auth/supabase-admin.service';

interface AccountIdentity {
  id: string;
  email: string;
  externalAuthId: string;
}

@Injectable()
export class AccountDeletionService {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly supabaseAdmin: SupabaseAdminService,
  ) {}

  async deleteAccount(identity: AccountIdentity): Promise<void> {
    const emailMatches = (column: AnyColumn) =>
      sql`lower(${column}) = lower(${identity.email})`;

    // Invitations addressed to this email are personal data even when a
    // different user created them, so remove those before deleting the user.
    await this.drizzle.db
      .delete(invitations)
      .where(emailMatches(invitations.email));
    await this.drizzle.db
      .delete(projectInvitations)
      .where(emailMatches(projectInvitations.email));
    await this.drizzle.db
      .delete(moduleInvitations)
      .where(emailMatches(moduleInvitations.email));
    await this.drizzle.db
      .delete(taskInvitations)
      .where(emailMatches(taskInvitations.email));
    await this.drizzle.db
      .delete(noteInvitations)
      .where(emailMatches(noteInvitations.email));

    const [deletedUser] = await this.drizzle.db
      .delete(users)
      .where(
        and(
          eq(users.id, identity.id),
          eq(users.externalAuthId, identity.externalAuthId),
        ),
      )
      .returning({ id: users.id });

    if (!deletedUser) {
      throw new NotFoundException('User not found');
    }

    // This executes before the request transaction commits. If Supabase
    // rejects the Auth deletion, throwing here rolls the application-data
    // deletion back instead of leaving a partially deleted account.
    await this.supabaseAdmin.deleteUser(identity.externalAuthId);
  }
}
