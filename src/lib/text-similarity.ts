/**
 * Text normalisation and set-similarity primitives.
 *
 * Deliberately dependency-free and side-effect-free so the match engine can be
 * unit tested without a database. No stemming is attempted: campus reports are
 * short and multilingual, and aggressive stemming would do more harm than good.
 */

/**
 * Words that appear in almost every lost-and-found report and therefore carry no
 * signal about *which* item is being described.
 */
export const STOPWORDS: ReadonlySet<string> = new Set([
  // Structural filler
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'these', 'those', 'there',
  'here', 'was', 'were', 'are', 'is', 'be', 'been', 'being', 'has', 'have', 'had',
  'not', 'but', 'you', 'your', 'yours', 'his', 'her', 'hers', 'its', 'our', 'ours',
  'their', 'theirs', 'them', 'they', 'she', 'him', 'who', 'whom', 'which', 'what',
  'when', 'where', 'while', 'about', 'into', 'over', 'under', 'near', 'around',
  'some', 'any', 'all', 'very', 'just', 'only', 'also', 'than', 'then', 'too',
  // Report-specific filler: "I lost my black wallet" -> "black wallet"
  'lost', 'lose', 'losing', 'found', 'find', 'finding', 'missing', 'misplaced',
  'dropped', 'left', 'forgot', 'forgotten', 'my', 'mine', 'me', 'i', 'someone',
  'somebody', 'anyone', 'anybody', 'please', 'help', 'need', 'want', 'looking',
  'look', 'item', 'items', 'thing', 'things', 'belongs', 'belong', 'belonging',
  'belongings', 'owner', 'own', 'if', 'pls', 'plz', 'kindly', 'contact', 'return',
  'returned', 'reward', 'thanks', 'thank', 'urgent',
]);

/** Tokens shorter than this are dropped: "a", "of", "an" carry no signal. */
const MIN_TOKEN_LENGTH = 3;

/**
 * Two-character numeric tokens are kept even though they are below the length
 * floor. Model and room numbers are highly discriminative between otherwise
 * similar reports ("iPhone 15" vs "iPhone 13", "Lab 12" vs "Lab 21"), while
 * two-character words are almost always filler already covered by STOPWORDS.
 */
const MIN_NUMERIC_TOKEN_LENGTH = 2;

function isUsefulToken(token: string): boolean {
  if (STOPWORDS.has(token)) return false;

  if (/^\d+$/.test(token)) return token.length >= MIN_NUMERIC_TOKEN_LENGTH;

  return token.length >= MIN_TOKEN_LENGTH;
}

/**
 * Lowercase, strip diacritics, and reduce punctuation to single spaces.
 *
 * ```
 * normalizeText('Red  iPhone 15!!')  // 'red iphone 15'
 * ```
 */
export function normalizeText(input: string): string {
  return input
    .normalize('NFKD')
    // Strip combining marks left behind by NFKD so "café" and "cafe" agree.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Normalise, split on whitespace, drop stopwords and very short tokens, and
 * de-duplicate. Order is preserved so results are deterministic in tests.
 */
export function tokenize(input: string): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];

  for (const token of normalizeText(input).split(' ')) {
    if (!token) continue;
    if (!isUsefulToken(token)) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
  }

  return tokens;
}

/**
 * Jaccard similarity of two token collections: |intersection| / |union|.
 *
 * Returns 0 when either side is empty and 0 when both are empty, so an empty
 * description can never inflate a match score.
 */
export function jaccard(a: Iterable<string>, b: Iterable<string>): number {
  const setA = a instanceof Set ? a : new Set(a);
  const setB = b instanceof Set ? b : new Set(b);

  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const value of setA) {
    if (setB.has(value)) intersection += 1;
  }

  const union = setA.size + setB.size - intersection;
  if (union === 0) return 0;

  return intersection / union;
}
