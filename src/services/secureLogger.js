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

const redactObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;

  const clone = Array.isArray(obj) ? [...obj] : { ...obj };

  const keys = Object.keys(clone);
  for (const key of keys) {
    const lower = String(key).toLowerCase();
    const val = clone[key];

    if (typeof val === 'string') {
      if (/(url|uri|path|filename|fileName|hash|token|secret|key|password|email)/i.test(lower)) {
        clone[key] = lower.includes('url') || lower.includes('uri') || lower.includes('path')
          ? redactUrl(val)
          : redactString(val);
      }
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
