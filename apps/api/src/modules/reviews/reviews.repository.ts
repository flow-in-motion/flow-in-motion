import { Injectable } from '@nestjs/common';
import {
  academicReviewNotes,
  academicReviews,
} from '@research-tracker/migrations';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { DrizzleService } from '../../db/drizzle.service';
import { searchPattern } from '../../common/pagination';
import { ReviewKind } from './dto/review.dto';

type ReviewValues = typeof academicReviews.$inferInsert;
export type ReviewUpdate = Partial<
  Omit<ReviewValues, 'id' | 'tenantId' | 'ownerUserId' | 'kind' | 'createdAt'>
>;

@Injectable()
export class ReviewsRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  private owned(tenantId: string, userId: string, kind: ReviewKind) {
    return and(
      eq(academicReviews.tenantId, tenantId),
      eq(academicReviews.ownerUserId, userId),
      eq(academicReviews.kind, kind),
    );
  }

  async page(
    tenantId: string,
    userId: string,
    kind: ReviewKind,
    search: string | undefined,
    page: number,
    pageSize: number,
  ) {
    const pattern = search?.trim() ? searchPattern(search.trim()) : null;
    const where = and(
      this.owned(tenantId, userId, kind),
      pattern
        ? or(
            ilike(academicReviews.studentName, pattern),
            ilike(academicReviews.studentNumber, pattern),
            ilike(academicReviews.universityName, pattern),
            ilike(academicReviews.thesisTitle, pattern),
            ilike(academicReviews.supervisorName1, pattern),
            ilike(academicReviews.supervisorName2, pattern),
            ilike(academicReviews.journalName, pattern),
            ilike(academicReviews.manuscriptTitle, pattern),
            ilike(academicReviews.manuscriptReference, pattern),
            ilike(academicReviews.journalRanking, pattern),
          )
        : undefined,
    );
    const [count] = await this.drizzle.db
      .select({ totalItems: sql<number>`count(*)::int` })
      .from(academicReviews)
      .where(where);
    const totalItems = count?.totalItems ?? 0;
    const safePage = Math.min(
      page,
      Math.max(1, Math.ceil(totalItems / pageSize)),
    );
    // Full abstracts and notes are fetched only when an individual record is opened.
    const data = await this.drizzle.db
      .select({
        id: academicReviews.id,
        kind: academicReviews.kind,
        studentName: academicReviews.studentName,
        universityName: academicReviews.universityName,
        thesisTitle: academicReviews.thesisTitle,
        degreeType: academicReviews.degreeType,
        journalName: academicReviews.journalName,
        manuscriptReference: academicReviews.manuscriptReference,
        manuscriptTitle: academicReviews.manuscriptTitle,
        journalRanking: academicReviews.journalRanking,
        requestedOn: academicReviews.requestedOn,
        dueOn: academicReviews.dueOn,
      })
      .from(academicReviews)
      .where(where)
      .orderBy(desc(academicReviews.createdAt), desc(academicReviews.id))
      .offset((safePage - 1) * pageSize)
      .limit(pageSize);
    return { data, totalItems, page: safePage };
  }

  async findOwned(
    tenantId: string,
    userId: string,
    kind: ReviewKind,
    id: string,
  ) {
    const [row] = await this.drizzle.db
      .select()
      .from(academicReviews)
      .where(
        and(this.owned(tenantId, userId, kind), eq(academicReviews.id, id)),
      );
    return row;
  }
  async create(values: ReviewValues) {
    const [row] = await this.drizzle.db
      .insert(academicReviews)
      .values(values)
      .returning();
    if (!row) throw new Error('Review could not be created');
    return row;
  }
  async update(
    tenantId: string,
    userId: string,
    kind: ReviewKind,
    id: string,
    values: ReviewUpdate,
  ) {
    const [row] = await this.drizzle.db
      .update(academicReviews)
      .set({ ...values, updatedAt: new Date() })
      .where(
        and(this.owned(tenantId, userId, kind), eq(academicReviews.id, id)),
      )
      .returning();
    return row;
  }
  async remove(tenantId: string, userId: string, kind: ReviewKind, id: string) {
    const [row] = await this.drizzle.db
      .delete(academicReviews)
      .where(
        and(this.owned(tenantId, userId, kind), eq(academicReviews.id, id)),
      )
      .returning({ id: academicReviews.id });
    return row;
  }
  async notes(tenantId: string, id: string) {
    return this.drizzle.db
      .select()
      .from(academicReviewNotes)
      .where(
        and(
          eq(academicReviewNotes.tenantId, tenantId),
          eq(academicReviewNotes.reviewId, id),
        ),
      )
      .orderBy(
        desc(academicReviewNotes.createdAt),
        desc(academicReviewNotes.id),
      );
  }
  async createNote(tenantId: string, reviewId: string, content: string) {
    const [note] = await this.drizzle.db
      .insert(academicReviewNotes)
      .values({ tenantId, reviewId, content })
      .returning();
    if (!note) throw new Error('Note could not be created');
    return note;
  }
  async updateNote(
    tenantId: string,
    reviewId: string,
    noteId: string,
    content: string,
  ) {
    const [note] = await this.drizzle.db
      .update(academicReviewNotes)
      .set({ content, updatedAt: new Date() })
      .where(
        and(
          eq(academicReviewNotes.tenantId, tenantId),
          eq(academicReviewNotes.reviewId, reviewId),
          eq(academicReviewNotes.id, noteId),
        ),
      )
      .returning();
    return note;
  }
  async removeNote(tenantId: string, reviewId: string, noteId: string) {
    const [note] = await this.drizzle.db
      .delete(academicReviewNotes)
      .where(
        and(
          eq(academicReviewNotes.tenantId, tenantId),
          eq(academicReviewNotes.reviewId, reviewId),
          eq(academicReviewNotes.id, noteId),
        ),
      )
      .returning({ id: academicReviewNotes.id });
    return note;
  }
}
