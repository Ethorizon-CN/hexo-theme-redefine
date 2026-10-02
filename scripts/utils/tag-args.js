'use strict';

const ARG_KEY_REGEX = /^[A-Za-z_][A-Za-z0-9_-]*$/;
const NAMED_ARG_REGEX = /^([A-Za-z_][A-Za-z0-9_-]*)\s*=/;

function splitRawArgs(rawArgs) {
  const tokens = [];
  let token = '';
  let quote = '';
  let escaped = false;

  for (const char of String(rawArgs ?? '')) {
    if (quote) {
      if (escaped) {
        token += char;
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === quote) {
        quote = '';
        continue;
      }

      token += char;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (token.length) {
        tokens.push(token);
        token = '';
      }
      continue;
    }

    token += char;
  }

  if (token.length) {
    tokens.push(token);
  }

  return tokens;
}

function parseTagArgs(input) {
  const raw = Array.isArray(input) ? input.join(' ') : String(input ?? '');
  const tokens = splitRawArgs(raw);
  const named = {};
  const positional = [];

  for (const token of tokens) {
    const equalIndex = token.indexOf('=');

    if (equalIndex <= 0) {
      positional.push(token);
      continue;
    }

    const key = token.slice(0, equalIndex).trim();

    if (!ARG_KEY_REGEX.test(key)) {
      positional.push(token);
      continue;
    }

    named[key] = token.slice(equalIndex + 1).trim();
  }

  return {
    raw,
    tokens,
    named,
    positional,
  };
}

function hasNamedArgs(parsed) {
  return Object.keys(parsed?.named || {}).length > 0;
}

function getNamedString(named, key, fallback = '') {
  const value = named?.[key];
  if (typeof value !== 'string' || value.length === 0) {
    return fallback;
  }

  return value;
}

function getNamedNumber(named, key, fallback = 0) {
  const value = named?.[key];
  if (value == null || value === '') {
    return fallback;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function splitClassNames(value) {
  if (value == null || value === '') {
    return [];
  }

  return String(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

// Hexo splits tag arguments on whitespace and drops the surrounding quotes
// before a tag handler runs, so `title="Hello World"` reaches the handler as
// `title=Hello World`. `parseTagArgs` then keeps only `Hello` and pushes
// `World` into the positional arguments. Scanning the raw argument string for
// `key=` positions lets callers recover such values in full.
function findNamedArgs(rawArgs) {
  const input = String(rawArgs ?? '');
  const namedArgs = [];
  let quote = '';
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === quote) {
        quote = '';
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (index > 0 && !/\s/.test(input[index - 1])) {
      continue;
    }

    const match = input.slice(index).match(NAMED_ARG_REGEX);
    if (!match) {
      continue;
    }

    namedArgs.push({
      key: match[1],
      index,
      valueStart: index + match[0].length,
    });
    index += match[0].length - 1;
  }

  return namedArgs;
}

function normalizeNamedValue(value) {
  const normalized = String(value ?? '').trim();

  if (normalized.length < 2) {
    return normalized;
  }

  const quote = normalized[0];
  if ((quote !== '"' && quote !== "'")
    || normalized[normalized.length - 1] !== quote) {
    return normalized;
  }

  return normalized.slice(1, -1).replace(/\\(.)/g, '$1');
}

function getRawNamedValue(rawArgs, namedArgs, key, knownKeys) {
  const input = String(rawArgs ?? '');
  const candidates = Array.isArray(namedArgs) ? namedArgs : [];
  const current = candidates.filter((namedArg) => namedArg.key === key).pop();

  if (!current) {
    return '';
  }

  // A value ends where the next known named argument starts, so values that
  // contain spaces survive while trailing `key=value` text stays separate.
  const next = candidates.find((namedArg) => namedArg.index > current.index
    && (!knownKeys || knownKeys.has(namedArg.key)));
  const end = next ? next.index : input.length;

  return normalizeNamedValue(input.slice(current.valueStart, end));
}

function getQuotedNamedValue(rawArgs, namedArgs, named, key, knownKeys) {
  return getRawNamedValue(rawArgs, namedArgs, key, knownKeys)
    || getNamedString(named, key, '').trim();
}

module.exports = {
  parseTagArgs,
  hasNamedArgs,
  getNamedString,
  getNamedNumber,
  splitClassNames,
  findNamedArgs,
  normalizeNamedValue,
  getRawNamedValue,
  getQuotedNamedValue,
};
