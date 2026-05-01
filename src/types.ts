import { Context } from 'grammy';
import { DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './db/schema';

export interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  ADMIN_TELEGRAM_ID: string;
  APIRONE_ACCOUNT: string;
  PUBLIC_WEBHOOK_URL: string;
}

// Extend the standard grammY context with our database and environment
export interface BotContext extends Context {
  db: DrizzleD1Database<typeof schema>;
  env: Env;
  userRole?: 'admin' | 'user' | 'banned';
}
