import React, { useState } from "react";
import { Mail, AlertCircle } from "lucide-react";
import { api } from "./api.js";

export function EmailVerificationBanner({ user, onVerified }) {
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState("");

  if (user.emailVerified) return null;

  async function resend() {
    setResending(true);
    setMessage("");
    try {
      const res = await api.resendVerification();
      setMessage(res.message || "Email sent!");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="verification-banner">
      <div className="verification-content">
        <AlertCircle size={20} />
        <div>
          <strong>Verifica tu email</strong>
          <p>Necesitas verificar tu correo para usar las funciones de AI.</p>
        </div>
        <button onClick={resend} disabled={resending} className="resend-btn">
          <Mail size={16} />
          {resending ? "Enviando..." : "Reenviar email"}
        </button>
      </div>
      {message && <div className="verification-message">{message}</div>}
    </div>
  );
}

export function AiCreditsIndicator({ user }) {
  if (!user.emailVerified) return null;

  const credits = user.aiCredits ?? 0;
  const color = credits > 5 ? "#4CAF50" : credits > 2 ? "#FF9800" : "#F44336";

  return (
    <div className="ai-credits" style={{ color }}>
      <span className="credits-label">AI Credits:</span>
      <strong>{credits}</strong>
    </div>
  );
}
