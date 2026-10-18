/**
 * RFC 4180 CSV serialisation with spreadsheet-formula-injection neutralisation.
 *
 * Pure and dependency-free: callers pass already-fetched rows plus a column
 * list, so export routes stay thin and escaping rules live in one place.
 */

export interface CsvColumn<T> {
  key: string;
  header: string;
  value: (row: T) => unknown;
}

/** Characters that make a spreadsheet treat the cell as a formula. */
const FORMULA_TRIGGERS = '=+-@';

/** Leading tab/CR are injection vectors even though they are whitespace. */
const DANGEROUS_LEADING_WHITESPACE = /^[\t\r]/;

/**
 * True when a field could be evaluated as a formula, including formulas
 * hidden behind leading spaces.
 */
function isFormulaLike(text: string): boolean {
  if (DANGEROUS_LEADING_WHITESPACE.test(text)) {
    return true;
  }

  const firstVisible = text.replace(/^\s+/, '').charAt(0);

  return firstVisible !== '' && FORMULA_TRIGGERS.includes(firstVisible);
}

/** Wraps a field in double quotes when its content requires quoting. */
function quoteIfNeeded(text: string, forceQuote: boolean): string {
  if (!forceQuote && !/[",\r\n]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Flatten a value to its plain-text form, without CSV quoting.
 *
 * Arrays are joined with `'; '` so list columns such as image URLs or tags
 * export readably. The joined result is then escaped as a *single* field by the
 * caller: escaping each element separately would emit `"a,b"; c` for the input
 * `['a,b', 'c']`, which strict parsers read as two fields rather than one.
 */
function toPlainText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (Array.isArray(value)) {
    return value.map((entry) => toPlainText(entry)).join('; ');
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  }

  return String(value);
}

/**
 * Serialise a single cell, neutralising formulas and applying RFC 4180
 * quoting. Arrays are flattened to a single `'; '`-joined field and then quoted
 * as one cell. Numbers are emitted verbatim so negative values stay
 * machine-parseable; every other cell is text by origin and is therefore
 * formula-checked.
 */
export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const text = toPlainText(value);

  // Numbers we produced ourselves are data, not user input: a negative value
  // must not be mangled into `'-3.5`, which would corrupt every numeric column.
  const formulaLike = typeof value === 'number' ? false : isFormulaLike(text);
  const neutralised = formulaLike ? `'${text}` : text;

  return quoteIfNeeded(neutralised, formulaLike);
}

/**
 * Render rows as a CSV document with a header row first, CRLF row separators
 * and no trailing newline. An empty column list yields an empty document.
 */
export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  if (columns.length === 0) {
    return '';
  }

  const header = columns.map((column) => escapeCsvValue(column.header)).join(',');

  const lines = rows.map((row) =>
    columns.map((column) => escapeCsvValue(column.value(row))).join(',')
  );

  return [header, ...lines].join('\r\n');
}
