import React, { useEffect, useState } from "react";
import { CheckCircle, XCircle, Loader } from "lucide-react";
import { api } from "./api.js";

export function VerifyEmailPage() {
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Token de verificación no encontrado");
      return;
    }

    api
      .verifyEmail(token)
      .then((res) => {
        setStatus("success");
        setMessage(res.message || "¡Email verificado!");
        // Redirect after 3 seconds
        setTimeout(() => {
          window.location.href = "/";
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
            <a href="/" className="btn-home">
              Volver al inicio
            </a>
          </>
        )}
      </div>
    </main>
  );
}
