import nodemailer from "nodemailer";

const EMAIL_FROM = process.env.EMAIL_FROM || "noreply@gym-app.com";
const APP_URL = process.env.PUBLIC_URL || "http://localhost:8080";

// Create transporter based on environment
function createTransporter() {
  // Production: use SMTP credentials
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Development: use ethereal email (fake SMTP for testing)
  console.warn("[email] No SMTP config — using test mode (logs only)");
  return null; // We'll just log in dev
}

const transporter = createTransporter();

export async function sendVerificationEmail(email, token) {
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`;
  
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>🏋️ Welcome to Gym Workout Plan!</h2>
      <p>Thanks for signing up! Please verify your email to unlock AI-powered workout plans.</p>
      <p style="margin: 30px 0;">
        <a href="${verifyUrl}" 
           style="background: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Verify Email
        </a>
      </p>
      <p style="color: #666; font-size: 14px;">
        Or copy this link: <br/>
        <a href="${verifyUrl}">${verifyUrl}</a>
      </p>
      <p style="color: #666; font-size: 12px; margin-top: 40px;">
        This link expires in 24 hours. If you didn't sign up, please ignore this email.
      </p>
    </div>
  `;

  const text = `
Welcome to Gym Workout Plan!

Please verify your email to unlock AI-powered workout plans.

Verification link: ${verifyUrl}

This link expires in 24 hours.
  `;

  if (!transporter) {
    // Dev mode: just log
    console.log("[email] DEV MODE - Verification email:");
    console.log("To:", email);
    console.log("Link:", verifyUrl);
    return { success: true, mode: "dev" };
  }

  try {
    await transporter.sendMail({
      from: EMAIL_FROM,
      to: email,
      subject: "Verify your email - Gym Workout Plan",
      text,
      html,
    });
    return { success: true, mode: "smtp" };
  } catch (error) {
    console.error("[email] Failed to send:", error);
    return { success: false, error: error.message };
  }
}

export async function sendPasswordResetEmail(email, token) {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  
  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>🔒 Password Reset Request</h2>
      <p>Someone requested a password reset for your account.</p>
      <p style="margin: 30px 0;">
        <a href="${resetUrl}" 
           style="background: #2196F3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Reset Password
        </a>
      </p>
      <p style="color: #666; font-size: 14px;">
        Or copy this link: <br/>
        <a href="${resetUrl}">${resetUrl}</a>
      </p>
      <p style="color: #666; font-size: 12px; margin-top: 40px;">
        This link expires in 1 hour. If you didn't request this, please ignore this email.
      </p>
    </div>
  `;

  const text = `
Password Reset Request

Reset your password: ${resetUrl}

This link expires in 1 hour.
  `;

  if (!transporter) {
    console.log("[email] DEV MODE - Password reset email:");
    console.log("To:", email);
    console.log("Link:", resetUrl);
    return { success: true, mode: "dev" };
  }

  try {
    await transporter.sendMail({
      from: EMAIL_FROM,
      to: email,
      subject: "Password Reset - Gym Workout Plan",
      text,
      html,
    });
    return { success: true, mode: "smtp" };
  } catch (error) {
    console.error("[email] Failed to send:", error);
    return { success: false, error: error.message };
  }
}
