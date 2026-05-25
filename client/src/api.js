// Thin client for the backend API. Same-origin `/api` works both in prod
// (Express serves the built client) and in dev (Vite proxies /api -> :8080).

const TOKEN_KEY = "adam_shred_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  register: (email, password, name) =>
    request("/auth/register", { method: "POST", body: { email, password, name }, auth: false }),
  login: (email, password) =>
    request("/auth/login", { method: "POST", body: { email, password }, auth: false }),
  me: () => request("/auth/me"),

  getProgress: () => request("/progress"),
  saveProgress: (progress) => request("/progress", { method: "PUT", body: { progress } }),

  getPlan: () => request("/plan"),
  generatePlan: (opts) => request("/plan/generate", { method: "POST", body: opts }),
};
