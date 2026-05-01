import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey(),
  telegramId: integer('telegram_id').notNull().unique(),
  username: text('username'),
  firstName: text('first_name'),
  role: text('role', { enum: ['user', 'admin', 'superadmin'] }).default('user').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
