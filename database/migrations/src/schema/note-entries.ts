import {
    pgTable,
    uuid,
    text,
    timestamp,
    index,
  } from 'drizzle-orm/pg-core';
  import { notes } from './notes';
  
  export const noteEntries = pgTable(
    'note_entries',
    {
      id: uuid('id').defaultRandom().primaryKey(),
      noteId: uuid('note_id')
        .notNull()
        .references(() => notes.id, { onDelete: 'cascade' }),
      content: text('content').notNull(),
      createdAt: timestamp('created_at', { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp('updated_at', { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => ({
      noteUpdatedAtIndex: index(
        'note_entries_note_id_updated_at_id_idx',
      ).on(table.noteId, table.updatedAt, table.id),
    }),
  );