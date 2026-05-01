import { handleGeneralCommands, Env, TelegramMessage } from './commands/start';
import { handleGenCommand } from './commands/gen';
import { handleChkCommand } from './commands/chk'; 
import { handleFakeCommand } from './commands/fake';
import { sendMessage } from './utils/telegram';

/**
 * Represents the incoming webhook payload from Telegram
 */
export interface TelegramWebhookPayload {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  callback_query?: any;
}

/**
 * Core Webhook Dispatcher
 * Handles incoming POST requests from Telegram, validates security, and routes commands.
 * 
 * @param request The incoming HTTP Request object
 * @param env Cloudflare Environment bindings
 * @returns A standard Response object
 */
export async function handleWebhook(request: Request, env: Env & { TELEGRAM_TOKEN: string; WEBHOOK_SECRET?: string }): Promise<Response> {
  // 1. Security check: Validate Telegram Secret Token if configured
  // This prevents malicious actors from sending fake payloads directly to your worker URL
  if (env.WEBHOOK_SECRET) {
    const secretToken = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (secretToken !== env.WEBHOOK_SECRET) {
      console.warn("Unauthorized webhook access attempt.");
      return new Response('Unauthorized', { status: 401 });
    }
  }

  // 2. Only allow POST requests
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    // 3. Parse the Telegram payload
    const payload: TelegramWebhookPayload = await request.json();

    // Support both new messages and edited messages
    const message = payload.message || payload.edited_message;

    // If there's no text message, ignore it and return 200 to acknowledge
    if (!message || !message.text) {
      return new Response('OK', { status: 200 });
    }

    const text = message.text.trim();
    const chatId = message.chat.id;
    let replyText: string | null = null;

    // 4. Global Interceptors (Database Upserts, Logging, /start, /help, /id)
    // We run the general handler first. If it returns text, it means it caught a global command.
    replyText = await handleGeneralCommands(message, env);

    // 5. Command Router
    // If the general handler didn't process the command, route it to specific modules
    if (!replyText) {
      // Extract the command (e.g., "/gen" from "/gen 414720 10")
      const command = text.split(' ')[0].toLowerCase();

      // Check if it has a bot username attached (e.g., /gen@RavenHqBot) and strip it
      const cleanCommand = command.includes('@') ? command.split('@')[0] : command;

      switch (cleanCommand) {
        case '/gen':
          replyText = await handleGenCommand(text);
          break;
        case '/chk':
          // Pass env if your checker needs D1 access or external APIs
          replyText = await handleChkCommand(text, env); 
          break;
        case '/fake':
          replyText = await handleFakeCommand(text);
          break;
        default:
          // Ignore unknown commands to prevent spam in group chats
          break;
      }
    }

    // 6. Send the response back to Telegram
    if (replyText) {
      await sendMessage(env.TELEGRAM_TOKEN, chatId, replyText, message.message_id);
    }

    // Always return 200 OK so Telegram knows the webhook succeeded
    return new Response('OK', { status: 200 });

  } catch (error) {
    console.error('Fatal Webhook Error:', error);
    
    // We catch the error but STILL return 200 OK to prevent Telegram retry loops
    // In a production environment, you should send an alert to your own admin Telegram ID here
    return new Response('Internal Server Error handled gracefully', { status: 200 });
  }
}
