const STORAGE_PREFIX = 'gcm-notification-retries-v1:';
const MAX_RETRIES = 50;

const storageKey = userEmail => `${STORAGE_PREFIX}${String(userEmail || '').trim().toLowerCase()}`;

export function readNotificationRetries(userEmail) {
  if (typeof window === 'undefined' || !userEmail) return [];
  try {
    const value = window.localStorage.getItem(storageKey(userEmail));
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const writeNotificationRetries = (userEmail, retries) => {
  if (typeof window === 'undefined' || !userEmail) return false;
  try {
    window.localStorage.setItem(storageKey(userEmail), JSON.stringify(retries.slice(0, MAX_RETRIES)));
    return true;
  } catch {
    return false;
  }
};

export function enqueueNotificationRetry(userEmail, notification) {
  const id = notification.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const existing = readNotificationRetries(userEmail);
  const next = [
    {
      ...notification,
      id,
      createdAt: new Date().toISOString(),
      attempts: 0,
    },
    ...existing.filter(item => item.id !== id),
  ];
  return writeNotificationRetries(userEmail, next) ? next[0] : null;
}

export function recordNotificationRetryAttempt(userEmail, id) {
  const next = readNotificationRetries(userEmail).map(item => (
    item.id === id
      ? { ...item, attempts: (Number(item.attempts) || 0) + 1, lastAttemptAt: new Date().toISOString() }
      : item
  ));
  return writeNotificationRetries(userEmail, next);
}

export function removeNotificationRetry(userEmail, id) {
  const next = readNotificationRetries(userEmail).filter(item => item.id !== id);
  return writeNotificationRetries(userEmail, next);
}