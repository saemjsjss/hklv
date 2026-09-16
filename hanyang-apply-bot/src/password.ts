/**
 * Generate a password the form accepts: 10–15 chars combining letters, numbers
 * and a special character. We produce a 12-char password with at least one of
 * each class, avoiding ambiguous characters.
 */
const LOWER = 'abcdefghijkmnpqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGIT = '23456789';
const SPECIAL = '!@#$%^&*';

function pick(set: string): string {
  return set[Math.floor(Math.random() * set.length)];
}

export function generatePassword(): string {
  const all = LOWER + UPPER + DIGIT + SPECIAL;
  const chars = [pick(LOWER), pick(UPPER), pick(DIGIT), pick(SPECIAL)];
  while (chars.length < 12) chars.push(pick(all));
  // Fisher–Yates shuffle so the required classes aren't always in front.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
