import Stripe from "stripe";
import { stripe, rpc, siteUrl, EMAIL_RE, paymentsReady, json } from "../../lib/server";

const stripeAccounts = () =>
  new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: `${Stripe.API_VERSION.split(".")[0]}.preview` });

// POST { email } -> { url } of Stripe's hosted onboarding for that seller.
export async function POST(req) {
  if (!paymentsReady()) return json({ error: "Payments are not set up yet." }, 503);
  let email = "";
  try {
    email = String((await req.json()).email || "").trim().toLowerCase();
  } catch {}
  if (!EMAIL_RE.test(email) || email.length > 120) return json({ error: "Enter a valid email." }, 400);

  try {
    const [existing] = (await rpc("get_seller", { p_email: email })) ?? [];
    let accountId = existing?.stripe_account_id;

    // Older sellers may have an unfinished Standard account; start them on Express instead.
    if (accountId && !existing.onboarded) {
      const old = await stripe.accounts.retrieve(accountId);
      if (old.controller?.stripe_dashboard?.type !== "express") accountId = null;
    }

    if (!accountId) {
      // Express dashboard, Stripe collects requirements and owns losses. This sandbox
      // only allows that combination on the preview API version.
      const account = await stripeAccounts().accounts.create({
        email,
        controller: {
          fees: { payer: "application" },
          losses: { payments: "stripe" },
          stripe_dashboard: { type: "express" },
        },
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        metadata: { app: "palengke" },
      });
      accountId = account.id;
      await rpc("save_seller", { p_email: email, p_account: accountId, p_onboarded: false });
    }

    const base = siteUrl(req);
    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${base}/connect?email=${encodeURIComponent(email)}&retry=1`,
      return_url: `${base}/connect/return?account=${accountId}`,
    });
    return json({ url: link.url });
  } catch (err) {
    console.error("connect", err);
    return json({ error: "Couldn't start Stripe onboarding. Try again in a moment." }, 500);
  }
}
