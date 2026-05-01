import { Bot, InlineKeyboard } from 'grammy';
import { BotContext } from './types';
import { users, orders } from './db/schema';
import { getProductById, CATEGORIES } from './catalog';
import { ApironeService } from './services/apirone';

export function setupBot(token: string): Bot<BotContext> {
  const bot = new Bot<BotContext>(token);

  // ... (Middleware & Basic Menus remain the same)

  bot.callbackQuery(/pay_(.+)_(.+)/, async (ctx) => {
    if (!ctx.from) return;
    const currency = ctx.match[1];
    const productId = ctx.match[2];
    const product = getProductById(productId);
    
    if (!product) return ctx.answerCallbackQuery("Product error.");
    
    await ctx.editMessageText("⏳ `Establishing secure payment gateway...`", { parse_mode: "Markdown" });

    try {
      const apirone = new ApironeService(ctx.env.APIRONE_ACCOUNT, ctx.env.RATE_CACHE);
      const rate = await apirone.getExchangeRate(currency);
      const minorUnits = apirone.calculateMinorUnits(product.price, rate, currency);
      
      const orderId = crypto.randomUUID().split('-')[0];
      const callbackSecret = crypto.randomUUID().replace(/-/g, ''); // Generate secure hash[cite: 4]
      
      // Append secret to URL for validation[cite: 4]
      const webhookUrl = `${ctx.env.PUBLIC_WEBHOOK_URL}/apirone-callback?secret=${callbackSecret}`;

      const invoice = await apirone.createInvoice({
        amount: minorUnits,
        currency: currency,
        callbackUrl: webhookUrl,
        orderId: orderId,
        productName: product.name
      });

      await ctx.db.insert(orders).values({
        id: orderId,
        telegramId: ctx.from.id,
        productId: product.id,
        productName: product.name,
        usdPrice: product.price,
        cryptoCurrency: currency,
        cryptoAmount: minorUnits,
        invoiceId: invoice.invoice,
        paymentAddress: invoice.address,
        callbackSecret: callbackSecret
      }).run();

      const humanAmount = currency.includes('trx') ? minorUnits / 1e6 : minorUnits / 1e8;
      
      const invoiceText = `🧾 **SECURE CHECKOUT**\n\n` +
        `📦 **Product:** ${product.name}\n` +
        `🆔 **Order ID:** \`${orderId}\`\n` +
        `💵 **Total Due:** \`${humanAmount}\` ${currency.toUpperCase()}\n\n` +
        `🏦 **Send exact amount to:**\n` +
        `\`${invoice.address}\`\n\n` +
        `⚡️ *Live monitoring active. You will be notified the moment the network confirms the transaction.*\n\n` +
        `Support: @drkingbd`;

      await ctx.editMessageText(invoiceText, { parse_mode: "Markdown" });
      await ctx.answerCallbackQuery();

    } catch (e) {
      console.error(e);
      const errKeyboard = new InlineKeyboard().text("🔙 Return to Shop", "menu_main");
      await ctx.editMessageText("❌ **Gateway Timeout.**\nCould not fetch live market rates. Please try again.", { 
        parse_mode: "Markdown",
        reply_markup: errKeyboard
      });
    }
  });

  return bot;
}
