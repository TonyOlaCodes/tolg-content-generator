import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Stripe webhook stub — verifies signature when STRIPE_WEBHOOK_SECRET is set.
 * Idempotent handling via AuditLog event id. Safe no-op without credentials.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!secret || !stripeKey) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Stripe not configured. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET. No charges were made.",
      },
      { status: 503 },
    );
  }

  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeKey);
    const event = stripe.webhooks.constructEvent(rawBody, signature ?? "", secret);

    const existing = await prisma.auditLog.findFirst({
      where: { action: `stripe.${event.type}`, targetId: event.id },
    });
    if (existing) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    await prisma.auditLog.create({
      data: {
        action: `stripe.${event.type}`,
        targetType: "StripeEvent",
        targetId: event.id,
        metaJson: { livemode: event.livemode },
      },
    });

    // Subscription updates can be wired here once prices are configured.
    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
