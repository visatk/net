import { Env, TelegramUpdate } from "./types";
import { handleStart, handleMenuCallback, restoreDashboard } from "./commands/start";
import { handleGen } from "./commands/gen";
import { handleFake } from "./commands/fake";
import { handleChk } from "./commands/chk";
import { answerCallback } from "./utils/telegram";

export class BotRouter {
  static async handleUpdate(update: TelegramUpdate, env: Env): Promise<void> {
    
    // 1. Handle Button Clicks (Callback Queries)
    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message?.chat.id;
      const messageId = cb.message?.message_id;
      
      if (!chatId || !messageId) return;

      if (cb.data.startsWith("menu_") && cb.data !== "menu_main") {
        await handleMenuCallback(cb.data, chatId, messageId, env);
      } else if (cb.data === "menu_main") {
        await restoreDashboard(chatId, messageId, env);
      } else if (cb.data.startsWith("regen_")) {
        // Feature: Let users tap to regenerate the exact same BIN
        const input = cb.data.split("_")[1];
        await handleGen([input], chatId, env);
      } else if (cb.data.startsWith("fake_")) {
        // Handle fake address regeneration[cite: 4]
        const input = cb.data.split("_")[1];
        await handleFake([input], chatId, env);
      }
      
      // Tell Telegram we received the click
      await answerCallback(env, cb.id);
      return;
    }

    // 2. Handle Text Commands
    if (!update.message || !update.message.text) return;

    const text = update.message.text.trim();
    const chatId = update.message.chat.id;

    if (!text.startsWith("/")) return;

    const parts = text.split(" ");
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (command) {
      case "/start":
        await handleStart(chatId, env);
        break;
      case "/gen":
        await handleGen(args, chatId, env);
        break;
      case "/fake":
        await handleFake(args, chatId, env);
        break;
      case "/chk":
        await handleChk(args, chatId, env, false);
        break;
      case "/vbv":
        await handleChk(args, chatId, env, true);
        break;
    }
  }
}
