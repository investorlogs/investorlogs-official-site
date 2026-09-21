import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy | InvestorPlugX",
  description:
    "InvestorPlugX privacy policy — what data we collect, how we use it, and how we protect it.",
}

const LAST_UPDATED = "September 21, 2026"

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-12">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">
          Legal
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-100">
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm text-slate-400">
          Last updated: {LAST_UPDATED}
        </p>
      </header>

      <div className="space-y-10 text-slate-300">
        <section>
          <h2 className="mb-3 text-xl font-semibold text-slate-100">1. Overview</h2>
          <p>
            InvestorPlugX (branded as InvestorPlugX) respects your privacy. This
            policy explains what information we collect when you use our site,
            how we use it, and the choices you have about it.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-slate-100">
            2. Information We Collect
          </h2>
          <p className="mb-3">We collect information you provide directly:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Account details (name, email address, password).</li>
            <li>
              Payment information, which is handled by our payment gateway
              (Paystack) and never stored on our servers.
            </li>
            <li>Order and transaction history for fulfillment.</li>
          </ul>
          <p className="mt-3">We also collect limited technical information:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>IP address, browser type, and device information.</li>
            <li>Pages visited and timestamps, for security and analytics.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-slate-100">
            3. How We Use Your Information
          </h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>Create and manage your account.</li>
            <li>Process purchases and deliver digital products.</li>
            <li>Send order confirmations and transactional emails.</li>
            <li>Provide customer support and respond to inquiries.</li>
            <li>Detect and prevent fraud or abuse.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-slate-100">
            4. Data Retention and Security
          </h2>
          <p>
            We retain your data only as long as your account is active or as
            needed to fulfill your orders and comply with legal obligations.
            Personal data is stored on encrypted infrastructure and accessed by
            authorized personnel only.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-slate-100">
            5. Third-Party Services
          </h2>
          <p className="mb-3">
            We use third-party service providers for payments, hosting, and
            email delivery. These providers process your data only as necessary
            to perform their services and are bound by their own privacy
            policies.
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Paystack — card payments.</li>
            <li>Vercel — hosting and deployment.</li>
            <li>Neon — managed PostgreSQL database.</li>
            <li>Resend — transactional email.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-slate-100">
            6. Your Rights
          </h2>
          <p>
            Depending on your location, you may have the right to access,
            correct, or delete your personal data, and to object to certain
            processing. To exercise these rights, contact our support team.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-slate-100">
            7. Changes to This Policy
          </h2>
          <p>
            We may update this privacy policy at any time. The last updated date
            at the top reflects the most recent revision. Continued use of the
            site after changes constitutes acceptance of the updated policy.
          </p>
        </section>
      </div>
    </div>
  )
}
