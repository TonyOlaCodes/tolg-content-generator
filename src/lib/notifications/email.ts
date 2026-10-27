import { NotificationChannel, NotificationStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { Resend } from "resend";

export type EmailPayload = {
  businessId: string;
  eventType: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
};

/**
 * Sends via Resend when RESEND_API_KEY is set.
 * Otherwise stores a PREVIEWED notification — never claims SENT without a provider.
 */
export async function sendBusinessEmail(payload: EmailPayload) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "DetailFlow <onboarding@resend.dev>";

  if (!apiKey) {
    const row = await prisma.notification.create({
      data: {
        businessId: payload.businessId,
        channel: NotificationChannel.EMAIL,
        eventType: payload.eventType,
        recipient: payload.to,
        subject: payload.subject,
        body: payload.text || payload.html,
        status: NotificationStatus.PREVIEWED,
        metaJson: { mode: "development_preview", html: payload.html },
      },
    });
    console.info("[email:preview]", {
      id: row.id,
      to: payload.to,
      subject: payload.subject,
      eventType: payload.eventType,
    });
    return { status: "previewed" as const, id: row.id };
  }

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });
    const row = await prisma.notification.create({
      data: {
        businessId: payload.businessId,
        channel: NotificationChannel.EMAIL,
        eventType: payload.eventType,
        recipient: payload.to,
        subject: payload.subject,
        body: payload.text || payload.html,
        status: NotificationStatus.SENT,
        metaJson: { providerId: result.data?.id ?? null },
      },
    });
    return { status: "sent" as const, id: row.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Email send failed";
    const row = await prisma.notification.create({
      data: {
        businessId: payload.businessId,
        channel: NotificationChannel.EMAIL,
        eventType: payload.eventType,
        recipient: payload.to,
        subject: payload.subject,
        body: payload.text || payload.html,
        status: NotificationStatus.FAILED,
        error: message,
      },
    });
    return { status: "failed" as const, id: row.id, error: message };
  }
}

export function brandedEmail(opts: {
  businessName: string;
  accent?: string;
  title: string;
  body: string;
}) {
  const accent = opts.accent || "#C9A227";
  return `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;background:#0b0b0c;color:#f5f5f5;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#141416;border:1px solid #2a2a2e;border-radius:16px;padding:28px">
    <p style="color:${accent};font-size:12px;letter-spacing:.14em;text-transform:uppercase;margin:0 0 8px">${opts.businessName}</p>
    <h1 style="font-size:22px;margin:0 0 12px;color:#fff">${opts.title}</h1>
    <div style="color:#c9c9ce;line-height:1.6;font-size:15px">${opts.body}</div>
    <p style="margin-top:28px;font-size:12px;color:#777">Powered by DetailFlow — Turn enquiries into bookings.</p>
  </div></body></html>`;
}
