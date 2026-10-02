import { env } from "../config/env";
import { AppError } from "../middleware/errorHandler";

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  provider: string;
  id: string | null;
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  if (env.emailProvider === "disabled") {
    throw new AppError(
      "Email delivery is disabled. Configure EMAIL_PROVIDER, EMAIL_API_KEY and EMAIL_FROM.",
      503
    );
  }

  if (env.emailProvider !== "resend") {
    throw new AppError(
      `Unsupported email provider "${env.emailProvider}". Configure EMAIL_PROVIDER=resend or disabled.`,
      503
    );
  }

  if (!env.emailApiKey || !env.emailFrom) {
    throw new AppError(
      "Resend email delivery requires EMAIL_API_KEY and EMAIL_FROM.",
      503
    );
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.emailApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.emailFrom,
      to: Array.isArray(message.to) ? message.to : [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "email provider error");
    throw new AppError(
      `Email delivery failed: ${detail.slice(0, 300)}`,
      502
    );
  }

  const data = (await response.json()) as { id?: string };

  return {
    provider: "resend",
    id: data.id || null,
  };
}
