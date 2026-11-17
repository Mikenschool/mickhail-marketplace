import { stripe, rpc, siteUrl, UUID_RE, paymentsReady, json, toCentavos, platformFee, CURRENCY } from "../../lib/server";

// POST { listingId } -> { url } of a Stripe Checkout page for that item.
export async function POST(req) {
  if (!paymentsReady()) return json({ error: "Payments are not set up yet." }, 503);
  let listingId = "";
  try {
    listingId = String((await req.json()).listingId || "");
  } catch {}
  if (!UUID_RE.test(listingId)) return json({ error: "Unknown listing." }, 400);

  try {
    const [item] = (await rpc("checkout_info", { p_listing: listingId })) ?? [];
    if (!item) return json({ error: "Unknown listing." }, 404);
    if (item.sold) return json({ error: "Sorry, this item is already sold." }, 409);
    if (!item.onboarded || !item.stripe_account_id)
      return json({ error: "This seller can't take payments yet." }, 409);

    const amount = toCentavos(item.price);
    if (amount < 3000) return json({ error: "Items under ₱30 can't be paid by card. Message the seller instead." }, 409);

    const base = siteUrl(req);
    // Direct charge: the payment is created on the seller's connected account,
    // and the platform keeps an application fee.
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: CURRENCY,
              unit_amount: amount,
              product_data: {
                name: item.title,
                ...(item.image_url?.startsWith("https://") ? { images: [item.image_url] } : {}),
              },
            },
          },
        ],
        payment_intent_data: { application_fee_amount: platformFee(amount) },
        metadata: { app: "palengke", listing_id: listingId },
        success_url: `${base}/success?session_id={CHECKOUT_SESSION_ID}&account=${item.stripe_account_id}`,
        cancel_url: `${base}/listing/${listingId}?canceled=1`,
        expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      },
      { stripeAccount: item.stripe_account_id }
    );
    return json({ url: session.url });
  } catch (err) {
    console.error("checkout", err);
    return json({ error: "Couldn't open checkout. Try again in a moment." }, 500);
  }
}
