import { Env } from '../bot';
import { calculateLuhnCheckDigit } from '../utils/luhn';

export async function handleChkCommand(text: string, env: Env): Promise<string> {
  const args = text.replace(/^\/chk\s*/i, '').trim();
  
  if (!args) {
    return `❌ **Invalid Format.**\nUsage: \`/chk [CC|MM|YY|CVV]\``;
  }

  // Parse standard format: 4147202134567890|12|28|123
  const parts = args.split('|');
  const cc = parts[0]?.replace(/[^0-9]/g, '');

  if (!cc || cc.length < 13 || cc.length > 19) {
    return `⚠️ **Validation Error:** Invalid Card Length.`;
  }

  // Edge-computed Luhn Validation
  const payload = cc.slice(0, -1);
  const checkDigit = parseInt(cc.slice(-1), 10);
  const isValidLuhn = calculateLuhnCheckDigit(payload) === checkDigit;

  if (!isValidLuhn) {
    return `
🔍 **CC Checker**
💳 **Card:** \`${cc.substring(0,6)}******${cc.slice(-4)}\`
❌ **Status:** DECLINED (Luhn Check Failed)
    `.trim();
  }

  // --- Real API logic would go here (e.g., fetch to Stripe/Braintree) ---
  // const response = await fetch('YOUR_GATEWAY_URL', { ... });

  return `
🔍 **CC Checker**
💳 **Card:** \`${args}\`
✅ **Status:** APPROVED (Simulated)
🛡️ **Luhn Check:** Passed
⏱️ **Response Time:** 0.8s
  `.trim();
}
