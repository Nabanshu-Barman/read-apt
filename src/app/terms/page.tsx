import Header from '@/components/Header';
import Footer from '@/components/Footer';
import styles from './page.module.css';

export default function TermsPage() {
  return (
    <div className={styles.page}>
      <Header minimalWhenAuthed />
      <main className={styles.main}>
        <h1 className={styles.title}>Terms of Service</h1>
        <p className={styles.meta}>Effective date: April 15, 2026</p>

        <section className={styles.section}>
          <h2>1. Acceptance of Terms</h2>
          <p>By creating an account or using Readapt, you agree to these Terms of Service and our Privacy Policy.</p>
        </section>

        <section className={styles.section}>
          <h2>2. Service Description</h2>
          <p>Readapt provides reading adaptation tools, profile features, and related accessibility enhancements. Readapt is not a medical device and does not provide medical diagnosis or treatment.</p>
        </section>

        <section className={styles.section}>
          <h2>3. Accounts</h2>
          <p>You are responsible for maintaining the security of your account and password, and for activity under your account.</p>
        </section>

        <section className={styles.section}>
          <h2>4. Billing and Subscriptions</h2>
          <p>Paid plans renew according to your selected billing period unless canceled. You can cancel at any time; access continues until the end of the paid period.</p>
        </section>

        <section className={styles.section}>
          <h2>5. Acceptable Use</h2>
          <p>You agree not to misuse the platform, attempt unauthorized access, or interfere with normal operation of the service.</p>
        </section>

        <section className={styles.section}>
          <h2>6. Limitation of Liability</h2>
          <p>Readapt is provided on an as-is basis without warranties of uninterrupted operation. To the fullest extent permitted by law, liability is limited to amounts paid by you in the preceding 12 months.</p>
        </section>

        <section className={styles.section}>
          <h2>7. Contact</h2>
          <p>For legal inquiries, contact: support@readapt.app</p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
