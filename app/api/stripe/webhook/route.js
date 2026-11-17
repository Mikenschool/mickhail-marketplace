import { stripe, rpc, json } from "../../../lib/server";

// Stripe calls this for checkout.session.completed and account.updated.
// The sandbox is shared with other candidates, so anything we don't recognise
// is ignored with a 200.
export async function POST(req) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return json({ error: "not configured" }, 503);

  const body = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, req.headers.get("stripe-signature"), secret);
  } catch (err) {
    return json({ error: "bad signature" }, 400);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const s = event.data.object;
      if (s.metadata?.app === "palengke" && s.payment_status === "paid" && event.account) {
        const fee = s.payment_intent
          ? (await stripe.paymentIntents.retrieve(s.payment_intent, { stripeAccount: event.account }))
              .application_fee_amount ?? 0
          : 0;
        await rpc("record_order", {
          p_listing: s.metadata.listing_id,
          p_session: s.id,
          p_account: event.account,
          p_amount: s.amount_total,
          p_fee: fee,
          p_currency: s.currency,
          p_buyer_email: s.customer_details?.email ?? null,
        });
      }
    } else if (event.type === "account.updated") {
      const a = event.data.object;
      await rpc("set_account_status", {
        p_account: a.id,
        p_onboarded: Boolean(a.charges_enabled && a.details_submitted),
      });
    }
  } catch (err) {
    console.error("webhook", event.type, err);
    return json({ error: "handler failed" }, 500); // Stripe will retry
  }
  return json({ received: true });
}
