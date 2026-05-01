export function calculateLuhnCheckDigit(partialNum: string): number {
  let sum = 0;
  let isAlternate = true; // Multiply every other digit from right to left

  for (let i = partialNum.length - 1; i >= 0; i--) {
    let n = parseInt(partialNum.charAt(i), 10);
    if (isAlternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    isAlternate = !isAlternate;
  }

  return (10 - (sum % 10)) % 10;
}

/**
 * Generates a valid card number based on a starting BIN.
 */
export function generateValidCard(bin: string, length: number): string {
  let partial = bin;
  
  // Fill the rest with random digits, leaving 1 space for the check digit
  while (partial.length < length - 1) {
    partial += Math.floor(Math.random() * 10).toString();
  }

  const checkDigit = calculateLuhnCheckDigit(partial);
  return partial + checkDigit.toString();
}

/**
 * Generates random expiry data and CVV
 */
export function generateMetadata(): { month: string; year: string; cvv: string } {
  const currentYear = new Date().getFullYear();
  const month = Math.floor(Math.random() * 12) + 1;
  const year = currentYear + Math.floor(Math.random() * 5); // Expiry within 5 years
  const cvv = Math.floor(100 + Math.random() * 900); // 3-digit CVV (defaulting to 3 for standard gen)

  return {
    month: month.toString().padStart(2, '0'),
    year: year.toString(),
    cvv: cvv.toString()
  };
}
