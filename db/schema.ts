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

export const ratings = sqliteTable(
  'ratings',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    format: text('format').notNull(),
    name: text('name').notNull(),
    rating: integer('rating').notNull(),
    games: integer('games').notNull(),
    wins: integer('wins').notNull(),
  },
  (t) => [index('ratings_leaderboard').on(t.format, t.rating)],
);

export const rankedResults = sqliteTable(
  'ranked_results',
  {
    roomId: text('room_id').primaryKey(),
    token: text('token').notNull(),
    rated: integer('rated').notNull().default(1),
    format: text('format').notNull(),
    createdAt: integer('created_at').notNull(),
    data: text('data').notNull(),
  },
  (t) => [index('ranked_results_recent').on(t.createdAt)],
);

export const matchmakingQueue = sqliteTable(
  'matchmaking_queue',
  {
    userId: text('user_id').primaryKey(),
    ticket: text('ticket').notNull(),
    name: text('name').notNull(),
    format: text('format').notNull(),
    rating: integer('rating').notNull(),
    joinedAt: integer('joined_at').notNull(),
    seenAt: integer('seen_at').notNull(),
    roomId: text('room_id'),
  },
  (t) => [index('matchmaking_waiting').on(t.format, t.roomId, t.seenAt)],
);
