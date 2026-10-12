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
    },
    (table) => ({
      noteCreatedAtIndex: index(
        'note_entries_note_id_created_at_id_idx',
      ).on(table.noteId, table.createdAt, table.id),
    }),
  );