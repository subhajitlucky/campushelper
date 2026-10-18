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

  // Devanagari filler. Students at an Indian campus commonly report in Hindi,
  // and these words carry no signal about *which* item is meant -- the same
  // reason 'lost'/'my'/'found' are listed above. Without them, every Hindi
  // report would share filler tokens and inflate similarity between unrelated
  // items. Romanised Hindi ("mera", "kho", "gaya") is folded by NFKD only where
  // it is accented, so the common romanisations are listed too.
  'मेरा', 'मेरी', 'मेरे', 'मैं', 'खो', 'खोया', 'खोई', 'खोगया', 'गया', 'गई', 'गयी',
  'मिला', 'मिली', 'मिल', 'है', 'हैं', 'था', 'थी', 'थे', 'का', 'की', 'के', 'को',
  'में', 'पर', 'से', 'और', 'एक', 'ने', 'यह', 'वह', 'कुछ', 'कोई', 'पास', 'लिए',
  'कर', 'करना', 'दिया', 'हुआ', 'हुई', 'गुम', 'कृपया', 'मदद', 'चाहिए', 'मिलने',
  'mera', 'meri', 'mere', 'main', 'kho', 'khoya', 'khoi', 'gaya', 'gayi', 'mila',
  'mili', 'hai', 'hain', 'tha', 'thi', 'the', 'ka', 'ki', 'ke', 'ko', 'mein',
  'aur', 'ek', 'ne', 'yeh', 'woh', 'kuch', 'koi', 'paas', 'kar', 'diya', 'gum',
  'kripya', 'madad', 'chahiye',

  // Coverage note: stopword lists exist for English (above) and Hindi. Odia
  // filler is NOT listed -- NFKD recomposes Odia vowel signs into sequences I
  // could not verify, and a stopword entry that never matches is worse than
  // none. Odia reports therefore keep their filler words, which slightly
  // inflates similarity between Odia reports but cannot cause a false match on
  // its own (the threshold needs real title/description overlap).
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

/**
 * Non-Latin tokens get a lower floor.
 *
 * Length is counted in UTF-16 code units, and Indic scripts spend two units on a
 * single consonant-plus-vowel-sign syllable, so a genuine short word such as
 * "घर" (house) is only two units. Judging it by the ASCII floor of three would
 * discard real words for exactly the wrong reason.
 */
const MIN_NON_LATIN_TOKEN_LENGTH = 2;

function isUsefulToken(token: string): boolean {
  if (STOPWORDS.has(token)) return false;

  if (/^\d+$/.test(token)) return token.length >= MIN_NUMERIC_TOKEN_LENGTH;

  if (/[^\u0000-\u007f]/.test(token)) return token.length >= MIN_NON_LATIN_TOKEN_LENGTH;

  return token.length >= MIN_TOKEN_LENGTH;
}

/**
 * Lowercase, strip diacritics, and reduce punctuation to single spaces.
 *
 * ```
 * normalizeText('Red  iPhone 15!!')  // 'red iphone 15'
 * normalizeText('मेरा काला बटुआ')     // 'मेरा काला बटुआ'  (script preserved)
 * ```
 *
 * Letters and digits are kept for *every* script, not just ASCII. The earlier
 * `[^a-z0-9]` rule deleted Devanagari, Odia, and every other non-Latin
 * character, so `tokenize` returned an empty array and a report written in
 * Hindi contributed **zero** text signal -- identical Hindi reports scored below
 * both the match and duplicate thresholds, making the feature inert for those
 * users.
 */
export function normalizeText(input: string): string {
  return input
    .normalize('NFKD')
    // Strip combining marks left behind by NFKD so "café" and "cafe" agree.
    // These code points are Latin/Greek/Cyrillic marks; Indic vowel signs live
    // in their own blocks and are deliberately left alone.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // \p{L} letters, \p{M} combining marks, \p{N} numbers, in any script.
    // Marks are essential: Devanagari and Odia vowel signs are category M, not
    // L, so keeping only \p{L} silently deleted every matra and turned "मेरा"
    // into "म र".
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
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
