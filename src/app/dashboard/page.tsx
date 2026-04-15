'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { CHROME_WEBSTORE_URL, SUPPORT_EMAIL } from '@/lib/publicLinks';
import { getSupabaseBrowserClient } from '@/lib/supabaseClient';
import styles from './page.module.css';

type DashTab = 'profile' | 'extension' | 'subscription';

type UserProfile = {
  quiz_score: number | null;
  subscription_status: string | null;
  preset?: Record<string, unknown> | null;
  subscription_renewal_date?: string | null;
  subscription_current_period_end?: string | null;
  razorpay_subscription_id?: string | null;
  razorpay_customer_id?: string | null;
  updated_at?: string | null;
};

function getDisplayName(email: string, name?: string | null) {
  if (name && name.trim().length > 0) return name.trim();
  if (!email) return 'User';
  return email.split('@')[0];
}

function getPlanLabel(status: string | null) {
  return status === 'active' ? 'Pro' : 'Free';
}

export default function DashboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState<DashTab>('profile');
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('User');
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [plan, setPlan] = useState<'Pro' | 'Free'>('Free');
  const [subscriptionStatusRaw, setSubscriptionStatusRaw] = useState<string | null>(null);
  const [renewalDate, setRenewalDate] = useState<string | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    async function loadDashboard() {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        router.replace('/auth/login');
        return;
      }

      const user = data.user;
      const email = user.email || '';
      const metaName =
        typeof user.user_metadata?.full_name === 'string'
          ? user.user_metadata.full_name
          : typeof user.user_metadata?.name === 'string'
            ? user.user_metadata.name
            : null;

      setUserName(getDisplayName(email, metaName));

      try {
        const res = await fetch(`/api/presets?userId=${encodeURIComponent(user.id)}`, { cache: 'no-store' });
        if (res.ok) {
          const payload = (await res.json()) as { profile?: UserProfile | null };
          if (payload.profile) {
            const presetSubscription =
              payload.profile.preset
              && typeof payload.profile.preset === 'object'
              && typeof payload.profile.preset.subscription === 'object'
                ? (payload.profile.preset.subscription as Record<string, unknown>)
                : null;

            setQuizScore(typeof payload.profile.quiz_score === 'number' ? payload.profile.quiz_score : null);
            setPlan(getPlanLabel(payload.profile.subscription_status));
            setSubscriptionStatusRaw(payload.profile.subscription_status ?? null);
            setSubscriptionId(
              payload.profile.razorpay_subscription_id
              ?? (typeof presetSubscription?.subscriptionId === 'string' ? presetSubscription.subscriptionId : null)
            );
            setRenewalDate(
              payload.profile.subscription_renewal_date
                ?? payload.profile.subscription_current_period_end
                ?? (typeof presetSubscription?.renewalDate === 'string' ? presetSubscription.renewalDate : null)
                ?? null
            );
          }
        }
      } catch {
        // Keep safe defaults.
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [router]);

  async function handleLogout() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/');
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.loaderWrap}>
          <Image src="/logo.png" alt="Readapt" width={84} height={84} className={styles.loaderLogo} priority />
          <div className={styles.loaderRing} />
        </div>
        <p className={styles.loaderText}>Loading your dashboard...</p>
      </div>
    );
  }

  const avatarLetter = userName.charAt(0).toUpperCase();
  const isSubscribed = plan === 'Pro';
  const renewalLabel = renewalDate
    ? new Date(renewalDate).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      })
    : 'Not available yet';

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <Link href="/dashboard" className={styles.logoWrap}>
          <Image src="/logo.png" alt="Readapt" width={42} height={42} className={styles.logoIcon} priority />
          <span className={styles.logo}>Readapt</span>
        </Link>

        <div className={styles.userCard}>
          <div className={styles.avatar}>{avatarLetter}</div>
          <div>
            <div className={styles.userName}>{userName}</div>
          </div>
        </div>

        <nav className={styles.sideNav}>
          {[
            { id: 'profile', label: '📚 Reading Profile' },
            { id: 'extension', label: '🌐 Extension Setup' },
          ].map(item => (
            <button
              key={item.id}
              className={`${styles.navItem} ${tab === item.id ? styles.navItemActive : ''}`}
              onClick={() => setTab(item.id as DashTab)}
            >
              {item.label}
            </button>
          ))}

          {isSubscribed && (
            <button
              className={`${styles.navItem} ${tab === 'subscription' ? styles.navItemActive : ''}`}
              onClick={() => setTab('subscription')}
            >
              💳 Manage Subscription
            </button>
          )}

          <Link href="/about" className={styles.navLink}>ℹ️ About</Link>
        </nav>

        <Link href="/paste" className={styles.adaptBtn}>Open Reader →</Link>
        <button className={styles.logoutBtn} onClick={handleLogout}>Log Out</button>
      </aside>

      <main className={styles.main}>
        {tab === 'profile' && (
          <div className={styles.tabContent}>
            <div className={styles.brandHero}>
              <Image src="/logo.png" alt="Readapt" width={94} height={94} className={styles.brandHeroLogo} priority />
              <div>
                <h1 className={styles.tabTitle}>Readapt Dashboard</h1>
                <p className={styles.tabSub}>Welcome back, {userName}.</p>
              </div>
            </div>

            <div className={styles.scoreCard}>
              <div className={styles.scoreCardLeft}>
                <div className={styles.scoreNum}>{quizScore ?? '--'}<span className={styles.scoreMax}>/24</span></div>
                <div className={styles.scoreBand}>Latest quiz score</div>
              </div>
              <Link href="/quiz" className="btn btn-ghost">Take Quiz</Link>
            </div>

            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Current Plan</h2>
              <p className={styles.sectionDesc}>Manage your subscription from one place.</p>
              <div className={styles.planCardInline}>
                <div>
                  <div className={styles.planBadge}>Plan: {plan}</div>
                  <p className={styles.planDesc}>
                    {plan === 'Pro' ? 'You have full access to all reading features.' : 'Upgrade to unlock all premium reading features.'}
                  </p>
                </div>
                {plan === 'Free' && (
                  <Link href="/pricing" className="btn btn-primary">Upgrade to Pro</Link>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'extension' && (
          <div className={styles.tabContent}>
            <h1 className={styles.tabTitle}>Extension Setup</h1>
            <p className={styles.tabSub}>Get Readapt on every website in 4 steps.</p>

            <div className={styles.steps}>
              {[
                { n: '1', title: 'Install from Chrome Web Store', desc: 'Click below to open the Chrome Web Store and install the Readapt extension.', action: <a href={CHROME_WEBSTORE_URL} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ height: '40px', fontSize: '14px', padding: '0 20px' }}>Install Extension →</a> },
                { n: '2', title: 'Pin the extension', desc: 'Click the puzzle icon in your Chrome toolbar, find Readapt, and click the pin icon to keep it visible.' },
                { n: '3', title: 'Sync your current preset from Readapt', desc: 'In the Readapt web app, open Adapt and click Sync with Extension. No login is required for guest sync.' },
                { n: '4', title: 'Apply on any website', desc: 'Open the Readapt extension on the same tab, choose Inline or Overlay, then enable adaptation instantly.' },
              ].map((step, i) => (
                <div key={i} className={styles.stepCard}>
                  <div className={styles.stepNum}>{step.n}</div>
                  <div className={styles.stepBody}>
                    <h3 className={styles.stepTitle}>{step.title}</h3>
                    <p className={styles.stepDesc}>{step.desc}</p>
                    {step.action && <div style={{ marginTop: '16px' }}>{step.action}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'subscription' && isSubscribed && (
          <div className={styles.tabContent}>
            <h1 className={styles.tabTitle}>Manage Subscription</h1>
            <p className={styles.tabSub}>Your current billing details and renewal info.</p>

            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Current Status</h2>
              <div className={styles.planCardInline}>
                <div>
                  <div className={styles.planBadge}>Status: {subscriptionStatusRaw || 'active'}</div>
                  <p className={styles.planDesc}>Plan: Pro</p>
                  <p className={styles.planDesc}>Renewal date: {renewalLabel}</p>
                  {subscriptionId && <p className={styles.planDesc}>Subscription ID: {subscriptionId}</p>}
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Need to change billing?</h2>
              <p className={styles.sectionDesc}>Until Razorpay self-serve customer portal is wired, contact support to cancel or modify billing.</p>
              <a href={`mailto:${SUPPORT_EMAIL}?subject=Readapt%20Subscription%20Support`} className="btn btn-ghost">
                Contact Billing Support
              </a>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
