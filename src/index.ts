import { Hono } from 'hono';
import { webhookCallback } from 'grammy';
import { drizzle } from 'drizzle-orm/d1';
import { createBot } from './bot';
import { Env, BotContext } from './types';

const app = new Hono<{ Bindings: Env }>();

app.get('/', (c) => c.text('Edge-Native Bot Server is running.'));

// Run this route ONCE after deployment to bind the webhook
app.get('/setup', async (c) => {
  const bot = createBot(c.env.BOT_TOKEN);
  const url = new URL(c.req.url);
  const webhookUrl = `${url.protocol}//${url.host}/webhook`;
  
  await bot.api.setWebhook(webhookUrl, { secret_token: c.env.WEBHOOK_SECRET });
  
  return c.json({ success: true, webhookUrl, status: "Secure webhook configured." });
});

app.post('/webhook', async (c) => {
  const secretToken = c.req.header('X-Telegram-Bot-Api-Secret-Token');
  if (secretToken !== c.env.WEBHOOK_SECRET) {
    return c.json({ error: "Unauthorized access" }, 401);
  }

  const bot = createBot(c.env.BOT_TOKEN);
  
  bot.use(async (ctx: BotContext, next) => {
    ctx.env = c.env;
    ctx.db = drizzle(c.env.DB);
    await next();
  });

  const handleUpdate = webhookCallback(bot, 'hono');
  return handleUpdate(c);
});

export default app;
