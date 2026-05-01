import { NextFunction } from 'grammy';
import { BotContext } from '../types';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

export async function adminGuard(ctx: BotContext, next: NextFunction) {
  if (!ctx.from) return;

  const telegramId = ctx.from.id;
  
  // Implicit Root Admin check from environment variables
  if (telegramId.toString() === ctx.env.ADMIN_TELEGRAM_ID) {
    ctx.userRole = 'admin';
    return await next();
  }

  // Check database for role
  try {
    const user = await ctx.db.select().from(users).where(eq(users.telegramId, telegramId)).get();
    
    if (user?.role === 'admin') {
      ctx.userRole = 'admin';
      return await next();
    } else if (user?.role === 'banned') {
       // Silently drop requests from banned users
       return;
    }
  } catch (error) {
    console.error('Database error in admin middleware:', error);
  }

  // Unauthorized response
  await ctx.reply("⛔️ Access Denied. This command requires Administrator privileges.");
}
