import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terms of Service | InvestorPlugX",
  description:
    "InvestorPlugX terms of service governing your use of the digital asset marketplace.",
}

const LAST_UPDATED = "September 21, 2026"

export default function TermsOfServicePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-12">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">
          Legal
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-100">
          Terms of Service
        </h1>
        <p className="mt-3 text-sm text-slate-400">
          Last updated: {LAST_UPDATED}
        </p>
      </header>

      <div className="space-y-10 text-slate-300">
        <section>
          <h2 className="mb-3 text-xl font-semibold text-slate-100">
            1. Acceptance of Terms
          </h2>
          <p>
            By accessing or using InvestorPlugX (branded as InvestorPlugX), you
            agree to be bound by these terms of service. If you do not agree,
            do not use this site.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-slate-100">
            2. Account Registration
          </h2>
          <p className="mb-3">
            To use certain features you must register an account. You agree to:
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Provide accurate and up-to-date information.</li>
            <li>Keep your credentials secure and not share them.</li>
            <li>Notify us promptly of any unauthorized use of your account.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-slate-100">
            3. Products and Services
          </h2>
          <p>
            InvestorPlugX is a digital asset marketplace. All products and
            services are digital and delivered electronically. Availability,
            pricing, and descriptions may change at any time without notice.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-slate-100">
            4. Prohibited Conduct
          </h2>
          <p className="mb-3">You agree not to:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>Use the site for any unlawful purpose.</li>
            <li>Attempt to gain unauthorized access to the platform.</li>
            <li>Abuse, exploit, or interfere with the service.</li>
            <li>Resell products or services without permission.</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-slate-100">
            5. Payments and Fees
          </h2>
          <p>
            All payments are processed by our payment gateway. Prices are shown
            in the currency indicated at checkout. You are responsible for any
            applicable taxes, fees, or charges imposed by your payment provider
            or jurisdiction.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-slate-100">
            6. Limitation of Liability
          </h2>
          <p>
            InvestorPlugX is provided on an as-is basis. To the fullest extent
            permitted by law, we are not liable for any indirect, incidental, or
            consequential damages arising from your use of the site.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-slate-100">
            7. Termination
          </h2>
          <p>
            We may suspend or terminate your account at any time for violation
            of these terms or for any other reason, with or without notice.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-slate-100">
            8. Governing Law
          </h2>
          <p>
            These terms are governed by the laws of the jurisdiction in which
            InvestorPlugX operates. Any disputes shall be resolved in the courts
            of that jurisdiction.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-slate-100">
            9. Contact
          </h2>
          <p>
            For questions about these terms, contact our support team through
            the dashboard or the support page.
          </p>
        </section>
      </div>
    </div>
  )
}
