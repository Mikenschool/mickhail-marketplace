import Link from "next/link";
import { stripe, rpc, paymentsReady } from "../lib/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Order confirmed · Palengke" };

const money = (centavos, currency = "php") =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: currency.toUpperCase() }).format(centavos / 100);

export default async function Success({ searchParams }) {
  const { session_id: sessionId, account } = await searchParams;
  let session = null;
  let saved = false;

  const valid =
    paymentsReady() &&
    typeof sessionId === "string" && /^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId) &&
    typeof account === "string" && /^acct_[A-Za-z0-9]+$/.test(account);

  if (valid) {
    try {
      session = await stripe.checkout.sessions.retrieve(
        sessionId,
        { expand: ["payment_intent", "line_items"] },
        { stripeAccount: account }
      );
      if (session.metadata?.app !== "palengke") session = null;
    } catch (err) {
      console.error("success", err);
    }
  }

  if (session?.payment_status === "paid") {
    // The webhook is the main way orders are saved. This is a backup in case it
    // hasn't arrived yet; record_order only saves each session once.
    try {
      saved = await rpc("record_order", {
        p_listing: session.metadata.listing_id,
        p_session: session.id,
        p_account: account,
        p_amount: session.amount_total,
        p_fee: session.payment_intent?.application_fee_amount ?? 0,
        p_currency: session.currency,
        p_buyer_email: session.customer_details?.email ?? null,
      });
    } catch (err) {
      console.error("success record", err);
    }
  }

  if (!session || session.payment_status !== "paid") {
    return (
      <main className="wrap narrow">
        <div className="result">
          <h1 className="h1">We couldn't confirm this payment</h1>
          <p>If you paid, check your email for Stripe's receipt. Otherwise, go back and try again.</p>
          <div className="result-actions"><Link className="btn btn-primary" href="/">Back to listings</Link></div>
        </div>
      </main>
    );
  }

  const item = session.line_items?.data?.[0]?.description;
  const fee = session.payment_intent?.application_fee_amount ?? 0;

  return (
    <main className="wrap narrow">
      <div className="result ok">
        <p className="result-icon" aria-hidden="true">✓</p>
        <h1 className="h1">Payment received. It's yours!</h1>
        <p>
          Thanks{session.customer_details?.name ? `, ${session.customer_details.name.split(" ")[0]}` : ""}.
          {session.customer_details?.email ? <> A receipt is on its way to <strong>{session.customer_details.email}</strong>.</> : null}
        </p>
        <dl className="receipt">
          {item && (<><dt>Item</dt><dd>{item}</dd></>)}
          <dt>Total paid</dt><dd>{money(session.amount_total, session.currency)}</dd>
          <dt>Seller receives</dt><dd>{money(session.amount_total - fee, session.currency)}</dd>
          <dt>Palengke fee (10%)</dt><dd>{money(fee, session.currency)}</dd>
          <dt>Order</dt><dd>{saved ? "Saved" : "Processing"} · ref {session.id.slice(-8)}</dd>
        </dl>
        <div className="result-actions">
          <Link className="btn btn-primary" href={`/listing/${session.metadata.listing_id}`}>View the listing</Link>
          <Link className="btn btn-ghost" href="/">Keep browsing</Link>
        </div>
        <p className="fine">The seller will contact you to arrange pickup. Test mode: no real money moved.</p>
      </div>
    </main>
  );
}
