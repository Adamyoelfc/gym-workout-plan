// BASE_URL is `/` locally and `/gym-ai-web/` in the production build.
const API_BASE = `${import.meta.env.BASE_URL}api`;

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: "same-origin",
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
  logout: () => request("/auth/logout", { method: "POST", auth: false }),
  me: () => request("/auth/me"),
  authConfig: () => request("/auth/config", { auth: false }),
  verifyEmail: (token) => request(`/auth/verify-email?token=${token}`, { auth: false }),
  resendVerification: () => request("/auth/resend-verification", { method: "POST" }),
  getAiStats: () => request("/auth/ai-stats"),

  getProgress: () => request("/progress"),
  saveProgress: (progress) => request("/progress", { method: "PUT", body: { progress } }),

  getPlan: () => request("/plan"),
  savePlan: (plan) => request("/plan", { method: "PUT", body: { plan } }),
  generatePlan: (opts) => request("/plan/generate", { method: "POST", body: opts }),
  getChat: () => request("/chat"),
  sendChat: (message) => request("/chat", {
    method: "POST",
    body: { message, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
  }),
  undoPlanChange: () => request("/plan/undo", { method: "POST" }),
  applyPlan: (plan, summary) => request("/plan/apply", { method: "POST", body: { plan, summary } }),
  importPlanPdf: async (file) => {
    const res = await fetch(`${API_BASE}/plan/import`, { method: "POST", headers: { "Content-Type": "application/pdf" }, credentials: "same-origin", body: file });
    const data = await res.json().catch(() => ({}));
    if (res.status === 403 && data.error === "Email not verified") throw new Error("Verifica tu email para usar la importación con IA.");
    if (res.status === 413) throw new Error("El PDF pesa demasiado (máximo 6 MB).");
    if (!res.ok) throw new Error(data.error || `No se pudo importar (${res.status})`);
    return data;
  },
  getExerciseGif: (name) => request(`/exercises/gif?name=${encodeURIComponent(name)}`),
};
