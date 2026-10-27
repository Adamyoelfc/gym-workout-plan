import React, { createContext, useContext, useEffect, useState } from "react";
import { Dumbbell, LogOut } from "lucide-react";
import { api } from "./api.js";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session from a stored token on first load.
  useEffect(() => {
    api
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const { user } = await api.login(email, password);
    setUser(user);
  }

  async function register(email, password, name) {
    const { user, message } = await api.register(email, password, name);
    if (user) setUser(user);
    return message;
  }

  async function logout() {
    await api.logout().catch(() => {});
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function LogoutButton() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <button className="logout-btn" onClick={logout} title={user.email}>
      <LogOut size={15} /> {user.name || user.email}
    </button>
  );
}

export function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [registration, setRegistration] = useState("closed");

  useEffect(() => { api.authConfig().then((config) => setRegistration(config.registration)).catch(() => {}); }, []);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else {
        const message = await register(email, password, name);
        if (message) { setMode("login"); setError(message); }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-logo">
          <Dumbbell size={22} /> ADAM.SHRED
        </div>
        <h1>{mode === "login" ? "Entrar" : "Crear cuenta"}</h1>
        <p className="auth-sub">Tu plan y progreso, sincronizados.</p>

        {mode === "register" && (
          <input
            type="text"
            placeholder="Nombre (opcional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <input
          type="password"
          placeholder={mode === "login" ? "Contraseña" : "Contraseña (mín. 10)"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
        />

        {error && <div className="auth-error">{error}</div>}

        <button className="primary" type="submit" disabled={busy}>
          {busy ? "..." : mode === "login" ? "Entrar" : "Registrarme"}
        </button>

        {registration !== "closed" ? (
          <button
            type="button"
            className="auth-switch"
            onClick={() => {
              setError("");
              setMode(mode === "login" ? "register" : "login");
            }}
          >
            {mode === "login" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Entra"}
          </button>
        ) : (
          <p className="auth-closed">App privada: el registro de cuentas nuevas está cerrado.</p>
        )}
      </form>
    </main>
  );
}
