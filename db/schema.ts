import { sqliteTable, text, integer, primaryKey, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
export const ratings=sqliteTable('ratings',{
  runId:text('run_id').notNull(),voterHash:text('voter_hash').notNull(),score:integer('score').notNull(),createdAt:integer('created_at').notNull(),updatedAt:integer('updated_at').notNull()
},t=>[primaryKey({columns:[t.runId,t.voterHash]}),check('ratings_score_1_10',sql`${t.score} >= 1 AND ${t.score} <= 10 AND typeof(${t.score}) = 'integer'`)]);
export const ratingLimits=sqliteTable('rating_limits',{
  key:text('key').primaryKey(),bucket:integer('bucket').notNull(),count:integer('count').notNull(),ticket:text('ticket').notNull()
},t=>[check('rating_limits_count_positive',sql`${t.count} > 0`)]);
