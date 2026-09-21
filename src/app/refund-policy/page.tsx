import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Refund Policy | InvestorPlugX",
  description:
    "InvestorPlugX refund policy for digital account purchases, SMS verification orders, and SMM services.",
}

const LAST_UPDATED = "September 21, 2026"

export default function RefundPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-12">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">
          Legal
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-100">
          Refund Policy
        </h1>
        <p className="mt-3 text-sm text-slate-400">
          Last updated: {LAST_UPDATED}
        </p>
      </header>

      <div className="space-y-10 text-slate-300">
        <section>
          <h2 className="mb-3 text-xl font-semibold text-slate-100">1. Overview</h2>
          <p>
            InvestorPlugX (branded as InvestorPlugX) is a digital asset marketplace.
            All products and services sold through this site are digital and
            delivered instantly. Because of their intangible nature, refunds are
            handled on a case-by-case basis and only under the conditions set out
            in this policy.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-slate-100">2. Digital Accounts</h2>
          <p className="mb-3">
            Digital accounts are sold as-is. Once an account is delivered to the
            buyer, the sale is final except where one of the following applies:
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>The account was not delivered within the stated delivery window.</li>
            <li>
              The account was suspended, banned, or otherwise unusable at the time
              of delivery, and the issue is reported within 24 hours of delivery.
            </li>
            <li>
              The account credentials provided do not match the description shown
              at checkout.
            </li>
          </ul>
          <p className="mt-3">
            Refunds for eligible accounts are issued to the original payment
            method or credited back to the buyer&rsquo;s wallet, at our discretion.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-slate-100">3. SMS Verification Numbers</h2>
          <p className="mb-3">
            SMS verification numbers are non-refundable once the order has been
            placed with the supplier. A refund may be considered only if:
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>The number never received a verification code and the order expired.</li>
            <li>The supplier failed to deliver the number at all.</li>
          </ul>
          <p className="mt-3">
            Requests must be made within 24 hours of the order timestamp. Partial
            or expired codes do not qualify for a refund.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-slate-100">4. SMM Services</h2>
          <p>
            Social media marketing services are fulfilled by third-party
            suppliers. Refunds are processed only where a supplier fails to
            deliver the ordered quantity, or where a service is cancelled before
            fulfillment begins. Partial or in-progress orders are not refunded.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-slate-100">5. Wallet Deposits</h2>
          <p>
            Wallet deposits may be refunded to the original payment method on a
            case-by-case basis, subject to verification of the original
            transaction. Deposits used to purchase products or services are
            subject to the refund rules for that product or service.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-slate-100">6. How to Request a Refund</h2>
          <p className="mb-3">
            To request a refund, contact our support team with:
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>The order ID or transaction reference.</li>
            <li>A clear description of the issue.</li>
            <li>Any relevant screenshots or evidence.</li>
          </ul>
          <p className="mt-3">
            We aim to acknowledge refund requests within 48 hours and resolve
            eligible requests within 5 business days.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-slate-100">7. Changes to This Policy</h2>
          <p>
            We may update this refund policy at any time. The last updated date
            at the top of this page reflects the most recent revision. Continued
            use of the site after changes constitutes acceptance of the updated
            policy.
          </p>
        </section>
      </div>
    </div>
  )
}
