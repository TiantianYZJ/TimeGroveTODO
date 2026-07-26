/**
 * Input validation middleware.
 *
 * Provides per-route middleware that trims strings, casts known types,
 * and rejects obviously malformed payloads *before* they reach business
 * logic.  Defence-in-depth: parameterized queries are the primary SQL
 * injection defence; this layer prevents garbage-in and detects
 * unexpected structures early.
 *
 * Usage:
 *   router.post('/create', validateBody({ title: 'string' }), handler)
 */

const VALIDATORS = {
  string: function (v) {
    if (typeof v === 'string') return v.trim();
    if (typeof v === 'number') return String(v);
    return undefined;
  },
  integer(v) {
    const n = parseInt(v, 10);
    return isNaN(n) ? undefined : n;
  },
  boolean(v) {
    if (v === true || v === 'true' || v === 1 || v === '1') return true;
    if (v === false || v === 'false' || v === 0 || v === '0') return false;
    return undefined;
  },
  /**
   * Array of strings — each element is trimmed.
   * Non-array inputs are converted to [input] if string, or rejected.
   */
  stringArray(v) {
    let arr = Array.isArray(v) ? v : (typeof v === 'string' ? [v] : undefined);
    if (!arr) return undefined;
    return arr.map(function (s) {
      return typeof s === 'string' ? s.trim() : String(s);
    }).filter(Boolean);
  },
  /**
   * Array of plain objects (not null, not arrays).
   */
  objectArray(v) {
    if (!Array.isArray(v)) return undefined;
    return v.filter(function (item) {
      return item !== null && typeof item === 'object' && !Array.isArray(item);
    });
  }
};

/**
 * Create middleware that validates req.body against a schema.
 *
 * @param {Object} schema  Field name → validator key ('string', 'integer', etc.)
 * @returns {Function}     Express middleware
 */
function validateBody(schema) {
  return function (req, res, next) {
    if (typeof req.body !== 'object' || req.body === null) {
      return res.status(400).json({ success: false, message: '请求体无效' });
    }
    for (const field in schema) {
      if (Object.prototype.hasOwnProperty.call(schema, field)) {
        const validator = VALIDATORS[schema[field]];
        if (validator && Object.prototype.hasOwnProperty.call(req.body, field)) {
          const cleaned = validator(req.body[field]);
          if (cleaned !== undefined) {
            req.body[field] = cleaned;
          }
        }
      }
    }
    next();
  };
}

module.exports = { validateBody, VALIDATORS };
