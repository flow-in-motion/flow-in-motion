import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { users } from '@research-tracker/migrations';
import { and, eq, ilike, inArray, or } from 'drizzle-orm';
import { DrizzleService } from '../../db/drizzle.service';
import type { AuthenticatedPrincipal } from '../auth/jwt.strategy';
import type { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly drizzle: DrizzleService) {}

  /**
   * Search users by name or email, across the whole platform (not scoped to
   * any one tenant) — used to find collaborators to invite onto a shared
   * task/note/project/module regardless of which workspace they belong to.
   */
  async search(query: string, limit = 8) {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const pattern = `%${trimmed}%`;
    return this.drizzle.db
      .select({
        id: users.id,
        displayName: users.displayName,
        email: users.email,
        affiliation: users.institution,
      })
      .from(users)
      .where(
        and(
          eq(users.status, 'active'),
          or(ilike(users.displayName, pattern), ilike(users.email, pattern)),
        ),
      )
      .orderBy(users.displayName)
      .limit(limit);
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
