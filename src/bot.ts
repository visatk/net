import { Bot } from "grammy";
import { BotContext } from "./types";
import { users } from "./db/schema";
import { requireAdmin } from "./middleware/admin";

export function createBot(token: string) {
  const bot = new Bot<BotContext>(token);

  // --- Global Middleware: Auto-sync users to D1 ---
  bot.use(async (ctx, next) => {
    if (ctx.from) {
      const now = new Date();
      try {
        await ctx.db.insert(users).values({
          telegramId: ctx.from.id,
          username: ctx.from.username,
          firstName: ctx.from.first_name,
          role: 'user',
          createdAt: now,
        }).onConflictDoNothing({ target: users.telegramId });
      } catch (error) {
        console.error("Failed to sync user state:", error);
      }
    }
    await next();
  });

  // --- Public Commands ---
  bot.command("start", async (ctx) => {
    const welcomeMessage = `
🚀 **Welcome to the Edge-Native Platform**

Your secure session has been established. Use the menu below to navigate your vault and access services.

*Powered by the elite community at @drkingbd.*
    `;
    await ctx.reply(welcomeMessage, { parse_mode: "Markdown" });
  });

  bot.command("ping", async (ctx) => {
    const start = Date.now();
    const msg = await ctx.reply("Pinging Edge servers...");
    const latency = Date.now() - start;
    await ctx.api.editMessageText(ctx.chat.id, msg.message_id, `⚡️ Edge Latency: ${latency}ms`);
  });

  // --- Admin Protected Commands ---
  const adminFeature = bot.filter((ctx) => ctx.hasCommand("stats") || ctx.hasCommand("broadcast"));
  adminFeature.use(requireAdmin);

  adminFeature.command("stats", async (ctx) => {
    const allUsers = await ctx.db.select().from(users);
    const adminCount = allUsers.filter(u => u.role === 'admin' || u.role === 'superadmin').length;
    
    await ctx.reply(`📊 **System Analytics**\n\nTotal Users: ${allUsers.length}\nAdmins: ${adminCount}\nStatus: Operational`, { parse_mode: "Markdown" });
  });

  adminFeature.command("broadcast", async (ctx) => {
    const messagePayload = ctx.match;
    
    if (!messagePayload) {
      await ctx.reply("⚠️ **Invalid Syntax**\nUsage: `/broadcast <your message>`", { parse_mode: "Markdown" });
      return;
    }

    const statusMsg = await ctx.reply("⏳ Initializing broadcast protocol... fetching user registry.");

    try {
      const userRegistry = await ctx.db.select({ telegramId: users.telegramId }).from(users);
      let successCount = 0;
      let failCount = 0;

      const BATCH_SIZE = 25; 
      const DELAY_MS = 1000;

      await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, `🚀 Broadcasting to ${userRegistry.length} users in batches...`);

      for (let i = 0; i < userRegistry.length; i += BATCH_SIZE) {
        const batch = userRegistry.slice(i, i + BATCH_SIZE);
        
        const deliveryPromises = batch.map(async (u) => {
          try {
            await ctx.api.sendMessage(u.telegramId, messagePayload, { 
              parse_mode: "Markdown",
              disable_web_page_preview: true 
            });
            successCount++;
          } catch (error) {
            failCount++; 
          }
        });

        await Promise.all(deliveryPromises);

        if (i + BATCH_SIZE < userRegistry.length) {
          await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
      }

      const report = `
✅ **Broadcast Protocol Complete**

📢 **Payload:** 
${messagePayload}

📊 **Telemetry:**
- Successfully Delivered: **${successCount}**
- Bounced/Blocked: **${failCount}**

*Join @drkingbd for community updates and support.*
      `;

      await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, report, { parse_mode: "Markdown" });

    } catch (error) {
      console.error("Broadcast Execution Failure:", error);
      await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, "🚨 **Critical Error:** Broadcast failed during execution. Check Worker logs.");
    }
  });

  return bot;
}
