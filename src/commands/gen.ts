import { Env } from "../types";
import { sendMessage } from "../utils/telegram";

function generateLuhn(bin: string): string {
  let cc = bin;
  while (cc.length < 15) cc += Math.floor(Math.random() * 10).toString();
  
  let sum = 0; let toggle = true;
  for (let i = cc.length - 1; i >= 0; i--) {
    let digit = parseInt(cc.charAt(i), 10);
    if (toggle) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit; toggle = !toggle;
  }
  return cc + ((10 - (sum % 10)) % 10);
}

export async function handleGen(args: string[], chatId: number, env: Env): Promise<void> {
  if (!args[0]) {
    await sendMessage(env, chatId, "❌ <b>Error:</b> Please provide a BIN.\n<i>Example:</i> <code>/gen 51546200</code>");
    return;
  }

  const start = Date.now();
  const input = args[0];
  const bin = input.substring(0, 6);
  const amount = 10;
  
  let cards = "";
  for (let i = 0; i < amount; i++) {
    const cc = generateLuhn(bin);
    const mm = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    const yy = String(Math.floor(Math.random() * 10) + 2030);
    const cvv = String(Math.floor(Math.random() * 900) + 100);
    cards += `${cc}|${mm}|${yy}|${cvv}\n`;
  }
  
  const timeTaken = ((Date.now() - start) / 1000).toFixed(3);
  
  // High-fidelity UI format based on reference
  const output = `| <b>Amount</b> - ⚡️ ${amount} |
| <b>BIN</b> - ⚡️ ${bin} | <b>Time</b> - ⚡️ ${timeTaken}s ⏱
|————————————|
| <b>Input</b> - ⚡️ ${input} |

<code>${cards}</code>
| <b>Info:</b> MASTERCARD - DEBIT
| <b>Bank:</b> THE BANCORP BANK NATIONAL ASSOCIATION
| <b>Country:</b> United States 🇺🇸`;

  // Add a "Regenerate" button
  const markup = {
    inline_keyboard: [[{ text: "🔄 Regenerate", callback_data: `regen_${input}` }]]
  };

  await sendMessage(env, chatId, output, markup);
}
