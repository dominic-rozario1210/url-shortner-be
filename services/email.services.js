import { BrevoClient } from "@getbrevo/brevo";

const getClientBaseUrl = () =>
  (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");

const getApiBaseUrl = () =>
  (process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, "");

const sendEmail = async ({ to, subject, htmlContent }) => {
  const { BREVO_API_KEY, BREVO_SENDER_NAME, BREVO_SENDER_EMAIL } = process.env;

  if (!BREVO_API_KEY || !BREVO_SENDER_EMAIL) {
    console.warn("Brevo is not configured. Email was not sent.");
    return false;
  }

  try {
    const brevo = new BrevoClient({ apiKey: BREVO_API_KEY });

    await brevo.transactionalEmails.sendTransacEmail({
      sender: {
        name: BREVO_SENDER_NAME || "Snip",
        email: BREVO_SENDER_EMAIL
      },
      to: [{ email: to }],
      subject,
      htmlContent
    });

    console.log(`Email sent to ${to}`);
    return true;
  } catch (error) {
    console.error("Brevo email error:", error.body || error.message || error);
    return false;
  }
};

export const sendActivationEmail = async (email, firstName, token) => {
  // The backend verifies the token, then sends the user to the frontend login page.
  const activationLink =
    `${getApiBaseUrl()}/api/auth/verify-email/${encodeURIComponent(token)}`;

  const htmlContent = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#222">
      <h2>Activate your Snip account</h2>
      <p>Hello ${String(firstName).replace(/[&<>"]/g, "")},</p>
      <p>Thanks for registering with Snip. Confirm your email address to activate your account.</p>
      <p>
        <a href="${activationLink}"
          style="display:inline-block;padding:12px 20px;background:#13877f;color:#fff;text-decoration:none;border-radius:6px">
          Activate account
        </a>
      </p>
      <p>This link expires in 24 hours. If you did not create this account, you can ignore this email.</p>
      <p>— The Snip team</p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: "Activate your Snip account",
    htmlContent
  });
};

// Existing password-reset email flow is preserved.
export const sendResetPasswordMail = async (email, firstName, token) => {
  const resetLink =
    `${getClientBaseUrl()}/reset-password/${encodeURIComponent(token)}`;

  const htmlContent = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#222">
      <h2>Password reset request</h2>
      <p>Hello ${String(firstName).replace(/[&<>"]/g, "")},</p>
      <p>We received a request to reset your Snip password.</p>
      <p>
        <a href="${resetLink}"
          style="display:inline-block;padding:12px 20px;background:#13877f;color:#fff;text-decoration:none;border-radius:6px">
          Reset password
        </a>
      </p>
      <p>This link expires in 10 minutes. If you did not request this, ignore this email.</p>
      <p>— The Snip team</p>
    </div>
  `;

  const emailSent = await sendEmail({
    to: email,
    subject: "Reset your Snip password",
    htmlContent
  });

  if (!emailSent) {
    console.log("Development password reset link:", resetLink);
  }

  return emailSent;
};
