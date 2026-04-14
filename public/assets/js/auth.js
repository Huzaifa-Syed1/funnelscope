const STORAGE_KEY = 'funnelmind.auth';

function readSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

let session = readSession();

export function getSession() {
  return session;
}

export function getToken() {
  return session?.token ?? '';
}

export function saveSession(nextSession) {
  session = nextSession;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
}

export function clearSession() {
  session = null;
  localStorage.removeItem(STORAGE_KEY);
}
