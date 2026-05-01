import { handleGeneralCommands, TelegramMessage } from './commands/start';
import { handleGenCommand } from './commands/gen';
import { handleChkCommand } from './commands/chk';
import { handleFakeCommand } from './commands/fake';
import { sendTelegramMessage } from './utils/telegram';

export interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  // Optional: Add a secret token to verify requests actually come from Telegram
  WEBHOOK_SECRET?: string; 
}

export default {
  /**
   * Main fetch handler for the Cloudflare Worker.
   * Receives incoming webhook POST requests from Telegram.
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // 1. Security Check & Method Validation
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Optional but recommended: Check Telegram's X-Telegram-Bot-Api-Secret-Token
    if (env.WEBHOOK_SECRET && request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 403 });
    }

    try {
      const update = await request.json<any>();

      // 2. Early Return for non-message updates (e.g., edited messages, inline queries)
      // Modify this if you plan to handle callback_queries from inline keyboards
      if (!update.message || !update.message.text) {
        return new Response('OK', { status: 200 }); 
      }

      const message: TelegramMessage = update.message;
      const text = message.text.trim();
      const chatId = message.chat.id;

      let responseText: string | null = null;

      // 3. Command Routing Hierarchy
      // First check general commands (/start, /help, /id) which also handle D1 DB sync
      responseText = await handleGeneralCommands(message, env);

      // If it wasn't a general command, route to specific operational tools
      if (!responseText) {
        if (text.startsWith('/gen')) {
          responseText = await handleGenCommand(text);
        } else if (text.startsWith('/chk')) {
          // Assuming /chk might need DB access for rate-limiting or premium status
          responseText = await handleChkCommand(text, env); 
        } else if (text.startsWith('/fake')) {
          responseText = await handleFakeCommand(text);
        }
      }

      // 4. Background Execution (The Edge Architecture Secret)
      // If we have a response, send it to Telegram asynchronously.
      // This prevents webhook timeouts and duplicate message processing.
      if (responseText) {
        ctx.waitUntil(
          sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, responseText)
            .catch(err => console.error("Failed to send Telegram message:", err))
        );
      }

      // 5. Acknowledge Receipt Immediately
      return new Response('OK', { status: 200 });

    } catch (error) {
      // Log errors to Cloudflare Tail Workers / Axiom
      console.error('Webhook processing error:', error);
      
      // Always return 200 to Telegram so it doesn't retry the failing payload,
      // unless it's a catastrophic network failure.
      return new Response('OK', { status: 200 });
    }
  }
};
