import Header from '@/components/Header';
import Footer from '@/components/Footer';
import styles from './page.module.css';

export default function TermsPage() {
  return (
    <div className={styles.page}>
      <Header minimalWhenAuthed />
      <main className={styles.main}>
        <h1 className={styles.title}>Terms of Service</h1>
        <p className={styles.meta}>Effective date: April 18, 2026</p>

        <section className={styles.section}>
          <h2>1. Acceptance of Terms</h2>
          <p>
            These Terms of Service (&quot;Terms&quot;) govern your access to and use of Readapt, including our website,
            web application, and browser extension.
          </p>
          <p>
            By creating an account, purchasing a subscription, or using Readapt, you agree to be bound by these Terms
            and our Privacy Policy. If you do not agree, do not use the service.
          </p>
        </section>

        <section className={styles.section}>
          <h2>2. Service Description</h2>
          <p>
            Readapt provides reading adaptation tools such as presets, focus and typography controls, summary workflows,
            and extension-based web reading modes.
          </p>
          <p>
            Readapt is an assistive productivity and accessibility tool. It is not a medical device and does not provide
            medical advice, diagnosis, or treatment.
          </p>
        </section>

        <section className={styles.section}>
          <h2>3. Accounts</h2>
          <p>
            You are responsible for maintaining the confidentiality of account credentials and for all activities under
            your account. You agree to provide accurate information and keep it reasonably up to date.
          </p>
          <p>
            You must promptly notify us of suspected unauthorized account access. We may suspend or restrict accounts
            involved in security incidents, abuse, fraud, or policy violations.
          </p>
        </section>

        <section className={styles.section}>
          <h2>4. Billing and Subscriptions</h2>
          <p>
            Paid plans renew on the billing cycle shown at checkout unless canceled before renewal. You authorize recurring
            billing through our payment processors for active paid subscriptions.
          </p>
          <p>
            You may cancel at any time. Unless required by law, fees already paid are non-refundable, and access continues
            through the end of the current paid period.
          </p>
          <p>
            We may change plan pricing or features in the future. Changes will apply prospectively and will not retroactively
            alter charges already processed.
          </p>
        </section>

        <section className={styles.section}>
          <h2>5. License and Permitted Use</h2>
          <p>
            Subject to your compliance with these Terms, Readapt grants you a limited, non-exclusive,
            non-transferable, revocable license to use the service for personal or internal business reading-adaptation use.
          </p>
          <p>You may not:</p>
          <ul>
            <li>reverse engineer or attempt to extract source code except where legally permitted;</li>
            <li>circumvent access controls, subscription limits, or security mechanisms;</li>
            <li>use Readapt to violate law or third-party rights; or</li>
            <li>resell, sublicense, or commercially exploit the service without written permission.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>6. User Content and Responsibilities</h2>
          <p>
            You are responsible for content you submit, paste, or process through Readapt, including ensuring you have the
            right to use that content. You must not submit unlawful, infringing, or malicious material.
          </p>
          <p>
            We do not claim ownership of your submitted text. You grant us the rights necessary to process it solely for
            operating and improving Readapt features under our Privacy Policy.
          </p>
        </section>

        <section className={styles.section}>
          <h2>7. Intellectual Property</h2>
          <p>
            Readapt, including software, branding, visual design, and related materials, is protected by intellectual
            property laws. Except for the limited license above, all rights are reserved by Readapt and its licensors.
          </p>
        </section>

        <section className={styles.section}>
          <h2>8. Third-Party Services</h2>
          <p>
            The service may rely on third-party providers (for example, authentication, hosting, and payments).
            Their terms and policies may apply to their portions of the service.
          </p>
          <p>
            We are not responsible for third-party products or services beyond obligations required by law.
          </p>
        </section>

        <section className={styles.section}>
          <h2>9. Disclaimer of Warranties</h2>
          <p>
            To the maximum extent permitted by law, Readapt is provided &quot;as is&quot; and &quot;as available,&quot; without warranties
            of any kind, whether express, implied, or statutory, including implied warranties of merchantability,
            fitness for a particular purpose, and non-infringement.
          </p>
          <p>
            We do not guarantee uninterrupted, error-free, or fully secure operation at all times.
          </p>
        </section>

        <section className={styles.section}>
          <h2>10. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by law, Readapt and its affiliates will not be liable for indirect,
            incidental, special, consequential, exemplary, or punitive damages, or for loss of data, revenue,
            profits, or business opportunities.
          </p>
          <p>
            To the extent liability cannot be excluded, our aggregate liability for claims related to the service
            is limited to the amount you paid us in the 12 months preceding the event giving rise to the claim.
          </p>
        </section>

        <section className={styles.section}>
          <h2>11. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless Readapt and its affiliates from claims, liabilities, and expenses
            arising from your misuse of the service, your violation of these Terms, or your infringement of third-party rights.
          </p>
        </section>

        <section className={styles.section}>
          <h2>12. Suspension and Termination</h2>
          <p>
            We may suspend or terminate access if you violate these Terms, create legal risk, or threaten service integrity.
            You may stop using the service at any time.
          </p>
          <p>
            Upon termination, provisions that by nature should survive (including payment obligations, disclaimers,
            liability limits, and dispute provisions) will continue to apply.
          </p>
        </section>

        <section className={styles.section}>
          <h2>13. Governing Law and Disputes</h2>
          <p>
            These Terms are governed by applicable law in the jurisdiction of service operation, without regard to
            conflict-of-law principles. You and Readapt agree to attempt good-faith resolution of disputes before
            initiating formal legal proceedings.
          </p>
        </section>

        <section className={styles.section}>
          <h2>14. Changes to Terms</h2>
          <p>
            We may update these Terms from time to time. Material changes will be reflected by updating the effective date
            and, where appropriate, by additional notice.
          </p>
          <p>
            Continued use of Readapt after updated Terms become effective constitutes acceptance of the revised Terms.
          </p>
        </section>

        <section className={styles.section}>
          <h2>15. Contact</h2>
          <p>For legal or terms-related inquiries, contact: joltmetric@gmail.com</p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
