/**
 * @file worker.ts
 * @description Cloudflare Edge Worker for a Wallet-based Telegram Shop using Apirone API.
 * Features atomic balance deductions and idempotent webhook handling.
 */

export interface Env {
    DB: D1Database;
    TELEGRAM_BOT_TOKEN: string;
    ADMIN_TELEGRAM_ID: string;
    APIRONE_ACCOUNT_ID: string;
    WEBHOOK_SECRET: string;
}

// Supported Crypto Currencies & their minor unit multipliers (e.g., Satoshi for BTC = 1e8)
const SUPPORTED_CRYPTO = {
    'btc': 100000000,
    'ltc': 100000000,
    'trx': 1000000
};

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);

        // 1. Telegram Webhook Router
        if (url.pathname === '/webhook/telegram' && request.method === 'POST') {
            if (request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.WEBHOOK_SECRET) {
                return new Response('Unauthorized', { status: 403 });
            }
            ctx.waitUntil(handleTelegramUpdate(request, env, url.origin));
            return new Response('OK');
        }

        // 2. Apirone Webhook Router (Top-Up Confirmations)
        if (url.pathname === '/webhook/apirone' && request.method === 'POST') {
            if (url.searchParams.get('secret') !== env.WEBHOOK_SECRET) {
                return new Response('Unauthorized', { status: 403 });
            }
            ctx.waitUntil(handleApironeCallback(request, env));
            return new Response('*ok*', { status: 200, headers: { 'Content-Type': 'text/plain' } });
        }

        return new Response('Wallet Shop Edge Service Active', { status: 200 });
    }
};

// ==========================================
// TELEGRAM UX & ROUTING
// ==========================================

async function handleTelegramUpdate(request: Request, env: Env, baseUrl: string) {
    const update = await request.json() as any;

    if (update.message) {
        await processMessage(update.message, env);
    } else if (update.callback_query) {
        await processCallbackQuery(update.callback_query, env, baseUrl);
    }
}

async function processMessage(message: any, env: Env) {
    const chatId = message.chat.id;
    const text = message.text || '';
    const userId = message.from.id;
    const username = message.from.username || '';
    const firstName = message.from.first_name || '';

    // Register User (or Ignore if exists)
    await env.DB.prepare(
        `INSERT OR IGNORE INTO users (telegram_id, username, first_name) VALUES (?, ?, ?)`
    ).bind(userId, username, firstName).run();

    if (text === '/start') {
        await sendMainMenu(chatId, env);
    }
}

async function sendMainMenu(chatId: number, env: Env) {
    const welcomeText = `🏛 <b>Welcome to the Premium Store</b>\n\nTop up your balance using Crypto and buy digital products instantly. Select an option:`;
    const keyboard = {
        inline_keyboard: [
            [{ text: "🛍️ Browse Products", callback_data: "menu_products" }],
            [{ text: "👤 My Profile & Balance", callback_data: "menu_profile" }],
            [{ text: "📦 My Purchases", callback_data: "menu_purchases" }]
        ]
    };
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, welcomeText, keyboard);
}

async function processCallbackQuery(query: any, env: Env, baseUrl: string) {
    const chatId = query.message.chat.id;
    const data = query.data;
    const userId = query.from.id;

    // Answer callback immediately to remove loading state in Telegram client
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: query.id })
    });

    // --- NAVIGATION ---
    if (data === 'menu_main') {
        await sendMainMenu(chatId, env);
    }

    if (data === 'menu_profile') {
        const user = await env.DB.prepare(`SELECT balance_usd FROM users WHERE telegram_id = ?`).bind(userId).first();
        const text = `👤 <b>Your Profile</b>\n\nID: <code>${userId}</code>\n💰 <b>Balance:</b> $${(user?.balance_usd as number || 0).toFixed(2)}\n\n<i>To buy products, you need to top up your balance.</i>`;
        const keyboard = {
            inline_keyboard: [
                [{ text: "💳 Top Up Balance", callback_data: "menu_topup" }],
                [{ text: "🔙 Main Menu", callback_data: "menu_main" }]
            ]
        };
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, text, keyboard);
    }

    if (data === 'menu_purchases') {
        const { results } = await env.DB.prepare(`
            SELECT p.title, d.payload, d.sold_at 
            FROM digital_assets d 
            JOIN products p ON d.product_id = p.id 
            WHERE d.sold_to = ? ORDER BY d.sold_at DESC LIMIT 10
        `).bind(userId).all();

        if (!results || results.length === 0) {
            return sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, "📭 You haven't purchased anything yet.", { inline_keyboard: [[{ text: "🔙 Back", callback_data: "menu_main" }]] });
        }

        let text = "📦 <b>Your Recent Purchases:</b>\n\n";
        results.forEach((r: any) => {
            text += `🔹 <b>${r.title}</b>\n🔑 <code>${r.payload}</code>\n🕒 <i>${new Date(r.sold_at).toLocaleDateString()}</i>\n\n`;
        });
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, text, { inline_keyboard: [[{ text: "🔙 Back", callback_data: "menu_main" }]] });
    }

    // --- TOP UP FLOW ---
    if (data === 'menu_topup') {
        const text = `💳 <b>Top Up Balance</b>\n\nSelect the amount you want to add to your account (USD):`;
        const keyboard = {
            inline_keyboard: [
                [{ text: "$10", callback_data: "topup_select_10" }, { text: "$25", callback_data: "topup_select_25" }],
                [{ text: "$50", callback_data: "topup_select_50" }, { text: "$100", callback_data: "topup_select_100" }],
                [{ text: "🔙 Back to Profile", callback_data: "menu_profile" }]
            ]
        };
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, text, keyboard);
    }

    if (data.startsWith('topup_select_')) {
        const amount = data.split('_')[2];
        const text = `💎 You chose to top up <b>$${amount}</b>.\n\nSelect a cryptocurrency for payment:`;
        const keyboard = {
            inline_keyboard: [
                [{ text: "🟠 Bitcoin (BTC)", callback_data: `topup_gen_${amount}_btc` }],
                [{ text: "⚪ Litecoin (LTC)", callback_data: `topup_gen_${amount}_ltc` }],
                [{ text: "🔴 TRON (TRX)", callback_data: `topup_gen_${amount}_trx` }],
                [{ text: "🔙 Back", callback_data: "menu_topup" }]
            ]
        };
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, text, keyboard);
    }

    // Generate Apirone Invoice for Top Up
    if (data.startsWith('topup_gen_')) {
        const parts = data.split('_');
        const amountUsd = parseFloat(parts[2]);
        const cryptoCurrency = parts[3] as keyof typeof SUPPORTED_CRYPTO;

        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, "⏳ <i>Generating secure payment gateway...</i>");

        try {
            // 1. Fetch real-time exchange rate
            const tickerRes = await fetch(`https://apirone.com/api/v2/ticker?currency=${cryptoCurrency}&fiat=usd`);
            const tickerData: any = await tickerRes.json();
            const rateUsd = tickerData[cryptoCurrency]?.usd;

            if (!rateUsd) throw new Error("Could not fetch exchange rates.");

            // 2. Calculate minor units
            const cryptoAmount = amountUsd / rateUsd;
            const minorUnits = Math.floor(cryptoAmount * SUPPORTED_CRYPTO[cryptoCurrency]);

            // 3. Create Apirone Invoice
            const invoiceReqBody = {
                amount: minorUnits,
                currency: cryptoCurrency,
                lifetime: 3600, // 1 hour expiry
                "callback-url": `${baseUrl}/webhook/apirone?secret=${env.WEBHOOK_SECRET}`,
                "user-data": {
                    title: `Account Top-Up ($${amountUsd})`,
                    merchant: "Premium Store Wallet",
                    price: `$${amountUsd.toFixed(2)}`
                }
            };

            const apironeRes = await fetch(`https://apirone.com/api/v2/accounts/${env.APIRONE_ACCOUNT_ID}/invoices`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(invoiceReqBody)
            });

            const invoiceData: any = await apironeRes.json();
            if (!invoiceData.invoice) throw new Error("Apirone API Error");

            // 4. Save Invoice to Database
            await env.DB.prepare(`
                INSERT INTO invoices (invoice_id, telegram_id, usd_amount, crypto_currency, invoice_url) 
                VALUES (?, ?, ?, ?, ?)
            `).bind(invoiceData.invoice, userId, amountUsd, cryptoCurrency, invoiceData["invoice-url"]).run();

            // 5. Present Invoice to User
            const text = `🧾 <b>Top-Up Invoice Created</b>\n\n` +
                         `💵 Amount: $${amountUsd.toFixed(2)}\n` +
                         `🪙 Pay With: ${cryptoCurrency.toUpperCase()}\n\n` +
                         `Please pay using the secure link below. Your balance will update automatically upon network confirmation.`;

            const keyboard = {
                inline_keyboard: [
                    [{ text: "🔗 Pay via Apirone", url: invoiceData["invoice-url"] }],
                    [{ text: "👤 Return to Profile", callback_data: "menu_profile" }]
                ]
            };
            await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, text, keyboard);

        } catch (e: any) {
            await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, `❌ Error creating invoice. Please try again later.`);
        }
    }

    // --- STORE FLOW (Purchase with Balance) ---
    if (data === 'menu_products') {
        const { results } = await env.DB.prepare(`
            SELECT p.id, p.title, p.price_usd, p.description, COUNT(d.id) as stock
            FROM products p
            LEFT JOIN digital_assets d ON p.id = d.product_id AND d.is_sold = 0
            WHERE p.is_active = 1
            GROUP BY p.id
        `).all();

        if (!results || results.length === 0) {
            return sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, "😔 Store is currently empty.", { inline_keyboard: [[{ text: "🔙 Back", callback_data: "menu_main" }]] });
        }

        const user = await env.DB.prepare(`SELECT balance_usd FROM users WHERE telegram_id = ?`).bind(userId).first();
        let text = `🛒 <b>Store Catalog</b>\n💰 Your Balance: <b>$${(user?.balance_usd as number || 0).toFixed(2)}</b>\n\n`;
        const keyboard = { inline_keyboard: [] };

        results.forEach((p: any) => {
            text += `🔹 <b>${p.title}</b>\n💵 $${p.price_usd.toFixed(2)} | 📦 Stock: ${p.stock}\n<i>${p.description}</i>\n\n`;
            if (p.stock > 0) {
                // @ts-ignore
                keyboard.inline_keyboard.push([{ text: `💳 Buy: ${p.title} ($${p.price_usd})`, callback_data: `buy_item_${p.id}` }]);
            }
        });
        // @ts-ignore
        keyboard.inline_keyboard.push([{ text: "🔙 Main Menu", callback_data: "menu_main" }]);
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, text, keyboard);
    }

    if (data.startsWith('buy_item_')) {
        const productId = data.split('_')[2];
        await processPurchase(userId, chatId, productId, env);
    }
}

// ==========================================
// CORE BUSINESS LOGIC (ATOMIC TRANSACTIONS)
// ==========================================

async function processPurchase(userId: number, chatId: number, productId: string, env: Env) {
    // 1. Fetch Product Price
    const product = await env.DB.prepare('SELECT title, price_usd FROM products WHERE id = ?').bind(productId).first();
    if (!product) return sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, "❌ Product not found.");

    // 2. Atomic Balance Deduction (D1 returning clause)
    // This updates the balance ONLY IF the balance is >= price, returning the new balance. 
    // If it returns null, user doesn't have enough money.
    const deduction = await env.DB.prepare(`
        UPDATE users 
        SET balance_usd = balance_usd - ? 
        WHERE telegram_id = ? AND balance_usd >= ? 
        RETURNING balance_usd
    `).bind(product.price_usd, userId, product.price_usd).first();

    if (!deduction) {
        return sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, `❌ <b>Insufficient Balance!</b>\n\nProduct costs $${(product.price_usd as number).toFixed(2)}. Please top up your account.`, {
            inline_keyboard: [[{ text: "💳 Top Up Balance", callback_data: "menu_topup" }]]
        });
    }

    // 3. Atomic Asset Claiming
    // Finds ONE unsold asset, marks it sold, assigns it to user, and returns the payload.
    const asset = await env.DB.prepare(`
        UPDATE digital_assets 
        SET is_sold = 1, sold_to = ?, sold_at = CURRENT_TIMESTAMP 
        WHERE id = (SELECT id FROM digital_assets WHERE product_id = ? AND is_sold = 0 LIMIT 1) 
        RETURNING payload
    `).bind(userId, productId).first();

    if (!asset) {
        // RACE CONDITION: Stock ran out exactly when user clicked buy.
        // Action: Refund the balance automatically.
        await env.DB.prepare(`UPDATE users SET balance_usd = balance_usd + ? WHERE telegram_id = ?`).bind(product.price_usd, userId).run();
        return sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, `⚠️ <b>Out of Stock!</b>\n\nSomeone bought the last item right before you. Your $${product.price_usd} has been instantly refunded to your balance.`, {
            inline_keyboard: [[{ text: "🔙 Browse Store", callback_data: "menu_products" }]]
        });
    }

    // 4. Delivery
    const deliveryText = `🎉 <b>Purchase Successful!</b>\n\nYou bought: <b>${product.title}</b>\nRemaining Balance: $${(deduction.balance_usd as number).toFixed(2)}\n\nHere is your product:\n\n<code>${asset.payload}</code>\n\nThank you for your purchase!`;
    await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, chatId, deliveryText, { inline_keyboard: [[{ text: "🔙 Main Menu", callback_data: "menu_main" }]] });
}

// ==========================================
// APIRONE WEBHOOK PROCESSING (IDEMPOTENT)
// ==========================================

async function handleApironeCallback(request: Request, env: Env) {
    const update = await request.clone().json() as any;
    const { invoice: invoiceId, status } = update;

    if (!invoiceId || !status) return;

    // We use an atomic update to ensure we only credit the user ONCE.
    // Apirone might send 'paid', and later 'completed'. We only credit when transitioning TO paid/completed FROM created/partpaid.
    const updateInvoice = await env.DB.prepare(`
        UPDATE invoices 
        SET status = ? 
        WHERE invoice_id = ? AND status NOT IN ('paid', 'completed') 
        RETURNING telegram_id, usd_amount
    `).bind(status, invoiceId).first();

    // If updateInvoice returned data, it means the state legitimately changed to paid/completed just now.
    if (updateInvoice && (status === 'paid' || status === 'completed')) {
        
        // Add funds to user's internal balance
        await env.DB.prepare(`
            UPDATE users SET balance_usd = balance_usd + ? WHERE telegram_id = ?
        `).bind(updateInvoice.usd_amount, updateInvoice.telegram_id).run();

        // Notify User
        const text = `💰 <b>Top-Up Successful!</b>\n\n$${(updateInvoice.usd_amount as number).toFixed(2)} has been added to your account balance.\n\nYou can now use this to buy products in the store!`;
        await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, updateInvoice.telegram_id as number, text, {
            inline_keyboard: [[{ text: "🛍️ Browse Store", callback_data: "menu_products" }]]
        });
    } else if (status !== 'paid' && status !== 'completed') {
         // Just a status update (e.g. partpaid, expired), log the status without crediting
         await env.DB.prepare(`UPDATE invoices SET status = ? WHERE invoice_id = ?`).bind(status, invoiceId).run();
    }
}

// ==========================================
// UTILITIES
// ==========================================

async function sendTelegramMessage(token: string, chatId: number, text: string, replyMarkup: any = null) {
    const payload: any = {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
    };
    if (replyMarkup) payload.reply_markup = replyMarkup;

    return fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
}
