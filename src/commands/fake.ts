import { Context, InlineKeyboard } from 'grammy';
import { 
    fakerEN_US, 
    fakerEN_GB, 
    fakerEN_CA, 
    fakerEN_AU, 
    fakerDE, 
    Faker 
} from '@faker-js/faker';

// Define a strict interface for our supported countries
interface CountryConfig {
    faker: Faker;
    name: string;
    flag: string;
    code: string;
}

// Map country codes to their specific Faker locales and static data
const supportedCountries: Record<string, CountryConfig> = {
    'us': { faker: fakerEN_US, name: 'United States', flag: '🇺🇸', code: 'US' },
    'uk': { faker: fakerEN_GB, name: 'United Kingdom', flag: '🇬🇧', code: 'UK' },
    'gb': { faker: fakerEN_GB, name: 'United Kingdom', flag: '🇬🇧', code: 'UK' },
    'ca': { faker: fakerEN_CA, name: 'Canada', flag: '🇨🇦', code: 'CA' },
    'au': { faker: fakerEN_AU, name: 'Australia', flag: '🇦🇺', code: 'AU' },
    'de': { faker: fakerDE, name: 'Germany', flag: '🇩🇪', code: 'DE' },
};

/**
 * Handles the /fake command and its associated callback queries.
 */
export async function fakeCommand(ctx: Context) {
    // 1. Determine the requested country from command args or callback data
    let requestedCode = 'us'; // Default to US

    if (ctx.callbackQuery) {
        // Handle "Regenerate" button click (e.g., callback data: "fake_uk")
        const parts = ctx.callbackQuery.data.split('_');
        if (parts.length > 1) {
            requestedCode = parts[1].toLowerCase();
        }
        await ctx.answerCallbackQuery(); // Acknowledge to remove loading state
    } else if (ctx.match) {
        // Handle direct command (e.g., "/fake uk")
        requestedCode = (ctx.match as string).trim().toLowerCase() || 'us';
    }

    // 2. Fallback to US if the country code isn't supported
    const config = supportedCountries[requestedCode] || supportedCountries['us'];
    const f = config.faker;

    // 3. Generate accurate, localized fake data
    const gender = f.person.sex();
    const genderCapitalized = gender.charAt(0).toUpperCase() + gender.slice(1);
    
    // Pass sex to fullName to ensure the name matches the generated gender
    const name = f.person.fullName({ sex: gender as 'male' | 'female' }); 
    const street = f.location.streetAddress();
    const city = f.location.city();
    const state = f.location.state();
    const zip = f.location.zipCode();
    const phone = f.phone.number();

    // 4. Construct the UI string exactly as requested
    const messageText = 
        `📍 **Address For ${config.flag} ${config.name}**\n` +
        `------------------------\n` +
        `• **Name** : ${name}\n` +
        `• **Gender** : ${genderCapitalized}\n` +
        `• **Street Address** : ${street}\n` +
        `• **City/Town/Village** : ${city}\n` +
        `• **State/Region** : ${state}\n` +
        `• **Postal Code** : ${zip}\n` +
        `• **Country** : ${config.name}\n` +
        `• **Phone** : ${phone}`;

    // 5. Build the inline keyboard for regeneration
    const keyboard = new InlineKeyboard()
        .text(`🔄 Regenerate ${config.code}`, `fake_${requestedCode}`);

    // 6. Send or Edit the message based on the context trigger
    try {
        if (ctx.callbackQuery) {
            await ctx.editMessageText(messageText, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        } else {
            await ctx.reply(messageText, {
                parse_mode: 'Markdown',
                reply_markup: keyboard
            });
        }
    } catch (error) {
        console.error('Error sending fake address:', error);
        // Fallback for identical message errors during rapid regeneration clicks
        if (error instanceof Error && error.message.includes('message is not modified')) {
            return; 
        }
    }
}
