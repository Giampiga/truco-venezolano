import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const rooms = sqliteTable(
  'rooms',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull().unique(),
    ownerId: text('owner_id').notNull(),
    isPrivate: integer('is_private').notNull(),
    status: text('status').notNull(),
    revision: integer('revision').notNull(),
    updatedAt: integer('updated_at').notNull(),
    data: text('data').notNull(),
  },
  (table) => [
    index('rooms_lobby').on(table.status, table.isPrivate, table.updatedAt),
    index('rooms_owner').on(table.ownerId, table.status),
  ],
);
