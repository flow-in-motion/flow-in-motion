import {
    pgTable,
    uuid,
    text,
    timestamp,
    index,
  } from 'drizzle-orm/pg-core';
  import { tasks } from './tasks';
  
  export const taskDescriptionEntries = pgTable(
    'task_description_entries',
    {
      id: uuid('id').defaultRandom().primaryKey(),
      taskId: uuid('task_id')
        .notNull()
        .references(() => tasks.id, { onDelete: 'cascade' }),
      content: text('content').notNull(),
      createdAt: timestamp('created_at', { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp('updated_at', { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => ({
      taskUpdatedAtIndex: index(
        'task_description_entries_task_id_updated_at_id_idx',
      ).on(table.taskId, table.updatedAt, table.id),
    }),
  );
  