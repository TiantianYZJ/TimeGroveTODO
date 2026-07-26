/**
 * Input sanitization utilities for MySQL 5.5 backend.
 *
 * MySQL 5.5 has no JSON column type — arrays are stored as JSON strings in
 * TEXT columns. These helpers ensure all user-supplied values are safe
 * before they enter parameterized queries and before being serialized.
 *
 * PARAMETERIZED QUERIES (mysql2 ? placeholders) are the primary SQL
 * injection defence.  This module adds defence-in-depth: LIKE wildcard
 * escaping, type coercion, and length enforcement.
 */

/**
 * Escape LIKE wildcards so user input is matched literally.
 *
 * Without this, searching for "100%" would match "100 anything" and
 * searching for "test_1" would match "test1", "testX1", etc.
 *
 * MySQL's default escape character is backslash — we prefix `%` and `_`
 * with `\`.  The escaped string is then passed as a normal ? parameter;
 * mysql2 will not double-escape it.
 *
 * @param {string} str  Raw user input
 * @returns {string}    Input with LIKE wildcards escaped
 */
function escapeLike(str) {
  return String(str).replace(/[%_]/g, '\\$&');
}

/**
 * Trim whitespace and optionally enforce a max length.
 *
 * @param {*}      val        Value to sanitise
 * @param {number} [maxLen]   Max character length (0 = no limit)
 * @returns {string}          Trimmed string (empty string on non-string input)
 */
function sanitizeString(val, maxLen) {
  if (typeof val !== 'string' && typeof val !== 'number') return '';
  const s = String(val).trim();
  if (maxLen && s.length > maxLen) return s.slice(0, maxLen);
  return s;
}

/**
 * Ensure a value is a plain Array.
 *
 * Accepts arrays as-is; converts JSON-stringified arrays; rejects
 * everything else (returns []).
 *
 * @param {*} val
 * @returns {Array}
 */
function sanitizeArray(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }
  return [];
}

/**
 * Safely coerce a value to an integer.
 *
 * @param {*}      val         Input value
 * @param {number} [defaultVal=0]  Fallback when coercion fails
 * @returns {number}
 */
function sanitizeInt(val, defaultVal) {
  const n = parseInt(val, 10);
  return isNaN(n) ? (defaultVal || 0) : n;
}

/**
 * Serialise an array to a JSON string safe for MySQL TEXT storage, or null.
 *
 * Filters out non-primitive items (objects, functions, etc.) so that only
 * strings and numbers are persisted.
 *
 * @param {*} arr  Input (should be an array)
 * @returns {string|null}
 */
function serializeArray(arr) {
  if (!Array.isArray(arr)) return null;
  const cleaned = arr.filter(function (item) {
    return typeof item === 'string' || typeof item === 'number';
  });
  return cleaned.length > 0 ? JSON.stringify(cleaned) : null;
}

module.exports = {
  escapeLike,
  sanitizeString,
  sanitizeArray,
  sanitizeInt,
  serializeArray
};
