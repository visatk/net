import { Context, InlineKeyboard } from 'grammy';
import { allFakers } from '@faker-js/faker';

// Define our strict configuration interface
interface CountryConfig {
    locale: keyof typeof allFakers;
    name: string;
    flag: string;
}

// Map user-friendly 2-letter codes to exact Faker.js locale keys[cite: 2]
const supportedCountries: Record<string, CountryConfig> = {
    'za': { locale: 'af_ZA', name: 'South Africa', flag: '🇿🇦' },
    'ar': { locale: 'ar', name: 'Arabic Region', flag: '🇦🇪' },
    'az': { locale: 'az', name: 'Azerbaijan', flag: '🇦🇿' },
    'bd': { locale: 'bn_BD', name: 'Bangladesh', flag: '🇧🇩' },
    'cz': { locale: 'cs_CZ', name: 'Czechia', flag: '🇨🇿' },
    'cy': { locale: 'cy', name: 'Wales', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿' },
    'dk': { locale: 'da', name: 'Denmark', flag: '🇩🇰' },
    'de': { locale: 'de', name: 'Germany', flag: '🇩🇪' },
    'at': { locale: 'de_AT', name: 'Austria', flag: '🇦🇹' },
    'ch': { locale: 'de_CH', name: 'Switzerland', flag: '🇨🇭' },
    'mv': { locale: 'dv', name: 'Maldives', flag: '🇲🇻' },
    'gr': { locale: 'el', name: 'Greece', flag: '🇬🇷' },
    'us': { locale: 'en_US', name: 'United States', flag: '🇺🇸' },
    'au': { locale: 'en_AU', name: 'Australia', flag: '🇦🇺' },
    'ca': { locale: 'en_CA', name: 'Canada', flag: '🇨🇦' },
    'gb': { locale: 'en_GB', name: 'Great Britain', flag: '🇬🇧' },
    'uk': { locale: 'en_GB', name: 'United Kingdom', flag: '🇬🇧' },
    'gh': { locale: 'en_GH', name: 'Ghana', flag: '🇬🇭' },
    'hk': { locale: 'en_HK', name: 'Hong Kong', flag: '🇭🇰' },
    'ie': { locale: 'en_IE', name: 'Ireland', flag: '🇮🇪' },
    'in': { locale: 'en_IN', name: 'India', flag: '🇮🇳' },
    'ng': { locale: 'en_NG', name: 'Nigeria', flag: '🇳🇬' },
    'es': { locale: 'es', name: 'Spain', flag: '🇪🇸' },
    'mx': { locale: 'es_MX', name: 'Mexico', flag: '🇲🇽' },
    'ir': { locale: 'fa', name: 'Iran', flag: '🇮🇷' },
    'fi': { locale: 'fi', name: 'Finland', flag: '🇫🇮' },
    'fr': { locale: 'fr', name: 'France', flag: '🇫🇷' },
    'be': { locale: 'fr_BE', name: 'Belgium', flag: '🇧🇪' },
    'lu': { locale: 'fr_LU', name: 'Luxembourg', flag: '🇱🇺' },
    'sn': { locale: 'fr_SN', name: 'Senegal', flag: '🇸🇳' },
    'il': { locale: 'he', name: 'Israel', flag: '🇮🇱' },
    'hr': { locale: 'hr', name: 'Croatia', flag: '🇭🇷' },
    'hu': { locale: 'hu', name: 'Hungary', flag: '🇭🇺' },
    'am': { locale: 'hy', name: 'Armenia', flag: '🇦🇲' },
    'id': { locale: 'id_ID', name: 'Indonesia', flag: '🇮🇩' },
    'it': { locale: 'it', name: 'Italy', flag: '🇮🇹' },
    'jp': { locale: 'ja', name: 'Japan', flag: '🇯🇵' },
    'ge': { locale: 'ka_GE', name: 'Georgia', flag: '🇬🇪' },
    'kr': { locale: 'ko', name: 'South Korea', flag: '🇰🇷' },
    'lv': { locale: 'lv', name: 'Latvia', flag: '🇱🇻' },
    'mk': { locale: 'mk', name: 'North Macedonia', flag: '🇲🇰' },
    'no': { locale: 'nb_NO', name: 'Norway', flag: '🇳🇴' },
    'np': { locale: 'ne', name: 'Nepal', flag: '🇳🇵' },
    'nl': { locale: 'nl', name: 'Netherlands', flag: '🇳🇱' },
    'pl': { locale: 'pl', name: 'Poland', flag: '🇵🇱' },
    'br': { locale: 'pt_BR', name: 'Brazil', flag: '🇧🇷' },
    'pt': { locale: 'pt_PT', name: 'Portugal', flag: '🇵🇹' },
    'ro': { locale: 'ro', name: 'Romania', flag: '🇷🇴' },
    'md': { locale: 'ro_MD', name: 'Moldova', flag: '🇲🇩' },
    'ru': { locale: 'ru', name: 'Russia', flag: '🇷🇺' },
    'sk': { locale: 'sk', name: 'Slovakia', flag: '🇸🇰' },
    'si': { locale: 'sl_SI', name: 'Slovenia', flag: '🇸🇮' },
    'rs': { locale: 'sr_RS_latin', name: 'Serbia', flag: '🇷🇸' },
    'se': { locale: 'sv', name: 'Sweden', flag: '🇸🇪' },
    'th': { locale: 'th', name: 'Thailand', flag: '🇹🇭' },
    'tr': { locale: 'tr', name: 'Turkey', flag: '🇹🇷' },
    'ua': { locale: 'uk', name: 'Ukraine', flag: '🇺🇦' },
    'pk': { locale: 'ur', name: 'Pakistan', flag: '🇵🇰' },
    'uz': { locale: 'uz_UZ_latin', name: 'Uzbekistan', flag: '🇺🇿' },
    'vn': { locale: 'vi', name: 'Vietnam', flag: '🇻🇳' },
    'cn': { locale: 'zh_CN', name: 'China', flag: '🇨🇳' },
    'tw': { locale: 'zh_TW', name: 'Taiwan', flag: '🇹🇼' }
};

/**
 * Handles the /fake command and localized address generation.
 */
export async function fakeCommand(ctx: Context) {
    let requestedCode = 'us'; // Default to US if nothing provided

    // Determine the requested country from callback or command
    if (ctx.callbackQuery) {
        const parts = ctx.callbackQuery.data.split('_');
        if (parts.length > 1) {
            requestedCode = parts[1].toLowerCase();
        }
        await ctx.answerCallbackQuery(); 
    } else if (ctx.match) {
        requestedCode = (ctx.match as string).trim().toLowerCase() || 'us';
    }

    // Check if the requested code exists in our map, fallback to US if not
    const config = supportedCountries[requestedCode];
    if (!config) {
        await ctx.reply(`⚠️ Unknown country code: \`${requestedCode}\`.\nAvailable codes include: us, uk, ca, au, de, fr, jp, br, in, bd...`, { parse_mode: 'Markdown' });
        return;
    }

    // Load the specific pre-built Faker instance dynamically[cite: 2]
    const f = allFakers[config.locale];

    try {
        const gender = f.person.sex();
        const genderCapitalized = gender.charAt(0).toUpperCase() + gender.slice(1);
        const name = f.person.fullName({ sex: gender as 'male' | 'female' }); 
        
        // Use try-catch blocks or optional chaining for missing locale data (e.g., Hong Kong has no zip codes)[cite: 2]
        const street = f.location.streetAddress() || 'N/A';
        const city = f.location.city() || 'N/A';
        
        let state = 'N/A';
        try { state = f.location.state(); } catch (e) { /* State not applicable */ }
        
        let zip = 'N/A';
        try { zip = f.location.zipCode(); } catch (e) { /* Zip code not applicable */ }

        let phone = 'N/A';
        try { phone = f.phone.number(); } catch (e) { /* Phone not applicable */ }

        // Construct the UI string
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

        const keyboard = new InlineKeyboard()
            .text(`🔄 Regenerate ${requestedCode.toUpperCase()}`, `fake_${requestedCode}`);

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
        console.error('Error generating fake data:', error);
        if (error instanceof Error && error.message.includes('message is not modified')) return;
        
        if (ctx.callbackQuery) {
             await ctx.answerCallbackQuery({ text: "Error generating data for this locale.", show_alert: true });
        } else {
             await ctx.reply("❌ An error occurred generating data for this country.");
        }
    }
}
