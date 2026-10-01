const isDev = () => typeof import.meta !== 'undefined' && !!import.meta.env && import.meta.env.DEV;

const redactString = (value, keepStart = 2, keepEnd = 2) => {
  const text = String(value ?? '').trim();
  if (!text) return '[vacío]';
  if (text.length <= keepStart + keepEnd) return '***';
  return `${text.slice(0, keepStart)}***${text.slice(-keepEnd)}`;
};

const redactUrl = (value) => {
  if (!value) return '[sin-url]';
  try {
    const parsed = new URL(String(value));
    return `${parsed.origin}/[ruta-redactada]`;
  } catch {
    return '[url-redactada]';
  }
};

const redactSensitiveString = (value) => {
  const text = String(value ?? '').trim();
  if (!text) return '[vacío]';

  if (/^https?:\/\//i.test(text)) return redactUrl(text);
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text)) return redactString(text, 2, 3);
  if (/\b(?:[A-Za-z]:)?(?:\/|\\)[^\s]+/i.test(text)) return '[ruta-redactada]';
  if (text.length > 120) return `${text.slice(0, 30)}...[redactado]`;
  return '***';
};

export const redactObject = (obj) => {
  if (obj === null || obj === undefined) return obj;

  if (obj instanceof Error) {
    return {
      name: obj.name,
      message: redactSensitiveString(obj.message),
      stack: '[redactado]',
    };
  }

  if (typeof obj === 'string') {
    return redactSensitiveString(obj);
  }

  if (typeof obj !== 'object') return obj;

  const clone = Array.isArray(obj) ? [...obj] : { ...obj };
  const keys = Object.keys(clone);

  for (const key of keys) {
    const lower = String(key).toLowerCase();
    const val = clone[key];

    if (typeof val === 'string') {
      const isSensitiveKey = /(url|uri|path|filename|fileName|hash|token|secret|key|password|email|message|stack|error|detail|body|payload|response|data)/i.test(lower);
      clone[key] = isSensitiveKey ? redactSensitiveString(val) : val;
      continue;
    }

    if (val && typeof val === 'object') {
      clone[key] = redactObject(val);
    }
  }

  return clone;
};

export const secureLogger = {
  debug: (...args) => {
    if (isDev()) {
      console.debug(...args.map((arg) => redactObject(arg)));
    }
  },
  info: (...args) => {
    if (isDev()) {
      console.info(...args.map((arg) => redactObject(arg)));
    }
  },
  warn: (...args) => {
    if (isDev()) {
      console.warn(...args.map((arg) => redactObject(arg)));
    }
  },
  error: (...args) => {
    const redactedArgs = args.map((arg) => redactObject(arg));
    console.error(...redactedArgs);
  },
  installGlobal: () => {
    if (typeof window === 'undefined') return;

    const methods = ['log', 'info', 'warn', 'error', 'debug'];
    for (const method of methods) {
      const original = console[method]?.bind(console);
      if (!original) continue;

      console[method] = (...args) => {
        const redactedArgs = args.map((arg) => redactObject(arg));
        original(...redactedArgs);
      };
    }
  },
};
