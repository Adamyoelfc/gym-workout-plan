import React, { useEffect, useState } from "react";
import { CheckCircle, XCircle, Loader } from "lucide-react";
import { api } from "./api.js";

export function VerifyEmailPage() {
  const baseUrl = import.meta.env.BASE_URL;
  const [status, setStatus] = useState("loading"); // loading | password | success | error
  const [message, setMessage] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function activate(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const res = await api.activateAccount(token, password);
      setStatus("success");
      setMessage(res.message);
      setTimeout(() => { window.location.href = baseUrl; }, 1500);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    setToken(token || "");

    if (!token) {
      setStatus("error");
      setMessage("Token de verificación no encontrado");
      return;
    }

    // Keep the one-time token out of browser history and later referrers.
    window.history.replaceState({}, "", `${baseUrl}verify-email`);

    api
      .verifyEmail(token)
      .then((res) => {
        if (res.needsPassword) { setStatus("password"); return; }
        setStatus("success");
        setMessage(res.message || "¡Email verificado!");
        // Redirect after 3 seconds
        setTimeout(() => {
          window.location.href = baseUrl;
        }, 3000);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err.message);
      });
  }, []);

  return (
    <main className="verify-page">
      <div className="verify-card">
        {status === "loading" && (
          <>
            <Loader size={48} className="spinner" />
            <h2>Verificando email...</h2>
          </>
        )}
        {status === "password" && (
          <form className="auth-card" onSubmit={activate}>
            <h2>Crea tu contraseña</h2>
            <p className="auth-sub">Último paso para activar tu cuenta.</p>
            <input type="password" placeholder="Contraseña (mín. 10)" autoComplete="new-password" minLength={10} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} required />
            {message && <div className="auth-error">{message}</div>}
            <button className="primary" type="submit" disabled={busy}>{busy ? "..." : "Activar cuenta"}</button>
          </form>
        )}
        {status === "success" && (
          <>
            <CheckCircle size={48} color="#4CAF50" />
            <h2>¡Email verificado!</h2>
            <p>{message}</p>
            <p className="verify-redirect">Redirigiendo...</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle size={48} color="#F44336" />
            <h2>Error de verificación</h2>
            <p>{message}</p>
            <a href={baseUrl} className="btn-home">
              Volver al inicio
            </a>
          </>
        )}
      </div>
    </main>
  );
}
