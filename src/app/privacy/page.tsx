import Header from '@/components/Header';
import Footer from '@/components/Footer';
import styles from './page.module.css';

export default function PrivacyPage() {
  return (
    <div className={styles.page}>
      <Header minimalWhenAuthed />
      <main className={styles.main}>
        <h1 className={styles.title}>Privacy Policy</h1>
        <p className={styles.meta}>Effective date: April 15, 2026</p>

        <section className={styles.section}>
          <h2>1. Data We Collect</h2>
          <p>We collect account information (such as email and profile metadata), subscription status, and settings required to provide the service.</p>
        </section>

        <section className={styles.section}>
          <h2>2. Reading Content</h2>
          <p>Text you paste for adaptation is processed for functionality. We do not sell personal data. Storage behavior depends on feature usage and implementation details of your workspace deployment.</p>
        </section>

        <section className={styles.section}>
          <h2>3. How We Use Data</h2>
          <p>We use your data to authenticate users, save profiles, provide subscription features, and improve reliability and performance.</p>
        </section>

        <section className={styles.section}>
          <h2>4. Third-Party Services</h2>
          <p>Readapt may use third-party services (such as Supabase and payment providers) to operate core features. Their privacy terms also apply.</p>
        </section>

        <section className={styles.section}>
          <h2>5. Your Rights</h2>
          <p>You can request correction or deletion of your account data by contacting support@readapt.app.</p>
        </section>

        <section className={styles.section}>
          <h2>6. Contact</h2>
          <p>For privacy questions, contact: support@readapt.app</p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
