/**
 * Converts numbers into accurate French words following standard grammatical rules.
 * Handles agreements for 'cents', 'vingts', invariable 'mille', and plural 'millions'/'milliards'.
 */

const UNITS = [
  'zéro',
  'un',
  'deux',
  'trois',
  'quatre',
  'cinq',
  'six',
  'sept',
  'huit',
  'neuf',
  'dix',
  'onze',
  'douze',
  'treize',
  'quatorze',
  'quinze',
  'seize',
  'dix-sept',
  'dix-huit',
  'dix-neuf',
];

const TENS = [
  '',
  'dix',
  'vingt',
  'trente',
  'quarante',
  'cinquante',
  'soixante',
  'soixante-dix',
  'quatre-vingt',
  'quatre-vingt-dix',
];

/**
 * Converts a number between 0 and 99 to French words.
 * @param n number 0..99
 * @param isEnd whether this 0..99 chunk terminates the full number (affects 'quatre-vingts')
 */
function convertUnder100(n: number, isEnd = true): string {
  if (n < 20) {
    return UNITS[n];
  }

  const tensDigit = Math.floor(n / 10);
  const unitDigit = n % 10;

  if (tensDigit === 2 || tensDigit === 3 || tensDigit === 4 || tensDigit === 5 || tensDigit === 6) {
    if (unitDigit === 0) {
      return TENS[tensDigit];
    }
    if (unitDigit === 1) {
      return `${TENS[tensDigit]} et un`;
    }
    return `${TENS[tensDigit]}-${UNITS[unitDigit]}`;
  }

  if (tensDigit === 7) {
    if (unitDigit === 1) {
      return 'soixante et onze';
    }
    return `soixante-${UNITS[10 + unitDigit]}`;
  }

  if (tensDigit === 8) {
    if (unitDigit === 0) {
      return isEnd ? 'quatre-vingts' : 'quatre-vingt';
    }
    return `quatre-vingt-${UNITS[unitDigit]}`;
  }

  if (tensDigit === 9) {
    return `quatre-vingt-${UNITS[10 + unitDigit]}`;
  }

  return '';
}

/**
 * Converts a number between 0 and 999 to French words.
 * @param n number 0..999
 * @param isEnd whether this chunk terminates the full number (for cents/vingts agreement)
 */
function convertUnder1000(n: number, isEnd = true): string {
  if (n === 0) return '';
  if (n < 100) return convertUnder100(n, isEnd);

  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;

  let prefix = '';
  if (hundreds === 1) {
    prefix = 'cent';
  } else {
    // Agreement for 'cent' if no remainder and isEnd
    const centSuffix = remainder === 0 && isEnd ? 'cents' : 'cent';
    prefix = `${UNITS[hundreds]} ${centSuffix}`;
  }

  if (remainder === 0) {
    return prefix;
  }

  return `${prefix} ${convertUnder100(remainder, isEnd)}`;
}

/**
 * Converts an integer up to 999 999 999 999 into French words.
 */
export function integerToFrenchWords(num: number): string {
  if (num === 0) return 'zéro';
  if (num < 0) return `moins ${integerToFrenchWords(Math.abs(num))}`;

  const n = Math.floor(num);

  const billions = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1_000);
  const remainder = n % 1_000;

  const parts: string[] = [];

  if (billions > 0) {
    if (billions === 1) {
      parts.push('un milliard');
    } else {
      parts.push(`${convertUnder1000(billions, false)} milliards`);
    }
  }

  if (millions > 0) {
    if (millions === 1) {
      parts.push('un million');
    } else {
      parts.push(`${convertUnder1000(millions, false)} millions`);
    }
  }

  if (thousands > 0) {
    if (thousands === 1) {
      parts.push('mille'); // In French, never "un mille"
    } else {
      // 'mille' is invariable (no 's')
      parts.push(`${convertUnder1000(thousands, false)} mille`);
    }
  }

  if (remainder > 0) {
    parts.push(convertUnder1000(remainder, true));
  }

  return parts.join(' ').trim();
}

/**
 * Formats an amount with currency in French words.
 * Ex: 12500, 'USD' -> "douze mille cinq cents dollars américains"
 * Ex: 12500, 'FC' -> "douze mille cinq cents francs congolais"
 * Ex: 100.5, 'USD' -> "cent dollars américains et cinquante centimes"
 */
export function formatAmountInWords(amount: number, currency: 'FC' | 'USD'): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return 'zéro';
  }

  const rounded = Math.round(amount * 100) / 100;
  const integerPart = Math.floor(rounded);
  const decimalPart = Math.round((rounded - integerPart) * 100);

  const integerWords = integerToFrenchWords(integerPart);

  let currencyName = '';
  if (currency === 'USD') {
    currencyName = integerPart > 1 ? 'dollars américains' : 'dollar américain';
  } else {
    currencyName = integerPart > 1 ? 'francs congolais' : 'franc congolais';
  }

  if (decimalPart === 0) {
    return `${integerWords} ${currencyName}`;
  }

  const decimalWords = integerToFrenchWords(decimalPart);
  const centimesName = decimalPart > 1 ? 'centimes' : 'centime';

  return `${integerWords} ${currencyName} et ${decimalWords} ${centimesName}`;
}
