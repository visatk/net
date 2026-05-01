import { getNetworkInfo } from '../utils/binData';
import { generateValidCard, generateMetadata } from '../utils/luhn';

export async function handleGenCommand(text: string): Promise<string> {
  // Extract arguments: `/gen 414720 10`
  const args = text.replace(/^\/gen\s*/i, '').trim().split(/\s+/);
  
  if (!args[0]) {
    return `❌ **Invalid Format.**\nUsage: \`/gen [BIN] [AMOUNT]\`\nExample: \`/gen 414720 10\``;
  }

  // Clean the BIN input (remove non-numeric chars like x, |, etc.)
  const rawInput = args[0];
  const bin = rawInput.replace(/[^0-9]/g, '');

  if (bin.length < 6) {
    return `❌ **Error:** Minimum BIN length is 6 digits.`;
  }

  // Determine amount (default to 10, cap at 20 to prevent timeout/spam)
  let amount = 10;
  if (args[1] && !isNaN(Number(args[1]))) {
    amount = Math.min(Math.max(Number(args[1]), 1), 20);
  }

  // Network mapping and validation
  const network = getNetworkInfo(bin);
  
  if (!network) {
    return `⚠️ **Unknown Network:** Could not identify the issuer for BIN \`${bin}\`.`;
  }

  if (!network.active) {
    return `❌ **Dead Algorithm:** The network **${network.name}** is officially inactive/retired. Generation aborted.`;
  }

  // Determine target length (use the maximum valid length for the network by default)
  let targetLength = network.lengths[network.lengths.length - 1];
  
  // If the user provided a longer input template (e.g., 414720xxxxxxxxxx)
  if (rawInput.length > 6 && network.lengths.includes(rawInput.length)) {
    targetLength = rawInput.length;
  }

  const generatedCards: string[] = [];

  for (let i = 0; i < amount; i++) {
    const cc = generateValidCard(bin, targetLength);
    const meta = generateMetadata();
    
    // Adjust CVV length for Amex
    let cvv = meta.cvv;
    if (network.name === 'American Express') {
      cvv = Math.floor(1000 + Math.random() * 9000).toString(); // 4 digits
    }

    generatedCards.push(`${cc}|${meta.month}|${meta.year}|${cvv}`);
  }

  // Format the Telegram response
  return `
💳 **CC Generator**
🏦 **Network:** ${network.name}
🔢 **BIN:** \`${bin.substring(0,6)}\`
📏 **Length:** ${targetLength}

\`\`\`text
${generatedCards.join('\n')}
\`\`\`
  `.trim();
}
