// Shared rules for manually entered team average MMR.
// A missing value is distinct from 0: it means the manager has not set it.
const MAX_AVERAGE_MMR = 10000;

function parseAverageMmr(input) {
  const value = String(input ?? '').trim();
  if (value === '' || value.toLowerCase() === 'clear') {
    return { valid: true, value: null };
  }

  if (!/^\d{1,5}$/.test(value)) {
    return { valid: false, error: 'Average MMR must be a whole number (0–10000), or `clear` to remove it.' };
  }

  const number = Number(value);
  if (!Number.isSafeInteger(number) || number > MAX_AVERAGE_MMR) {
    return { valid: false, error: 'Average MMR must be between 0 and 10000.' };
  }
  return { valid: true, value: number };
}

function normalizeAverageMmr(value) {
  // Old roster files do not have this field yet.
  if (value === null || value === undefined || value === '') return null;
  const parsed = parseAverageMmr(value);
  return parsed.valid ? parsed.value : null;
}

function formatAverageMmr(averageMmr) {
  const normalized = normalizeAverageMmr(averageMmr);
  // Inline code is Discord's closest native equivalent to a compact pill.
  // Discord does not support custom background colors or fonts inside embeds.
  return `📊 **Average MMR:** ${normalized === null ? '*Not set*' : `\`${normalized}\``}`;
}

module.exports = { parseAverageMmr, normalizeAverageMmr, formatAverageMmr };
