'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import styles from './page.module.css';

type CurrencyCode = 'INR' | 'USD';

type GeoResponse = {
  countryCode: string;
  currency: CurrencyCode;
  source?: 'geolocation' | 'headers';
};

const FAQ = [
  { q: "Is this a real ADHD tool or just a gimmick?", a: "Bionic reading and the formatting techniques Readapt uses are grounded in cognitive science research on attention and word recognition. The ASRS-6 quiz is a clinically validated screener used by healthcare professionals worldwide. We don't claim to treat ADHD — we give your brain the text environment where it naturally focuses better." },
  { q: "What exactly does the browser extension do?", a: "The extension injects your reading preset into any webpage. Text is reformatted in real-time: bionic reading applied, line height adjusted, focus line optionally overlaid. It works on articles, emails, Wikipedia — any text-heavy page. Your preset syncs from your account automatically." },
  { q: "Can I cancel my subscription?", a: "Yes, at any time, with no questions asked. You can cancel from your dashboard and you'll retain Pro access until the end of your billing period. We use Razorpay for billing, which means everything is handled securely and transparently." },
  { q: "Is my text private?", a: "Yes. All text adaptation happens in your browser — your pasted text never leaves your device and is never sent to our servers. The only data we store is your reading preset configuration and subscription status." },
  { q: "What devices does this work on?", a: "The web app works on any modern browser on any device. The browser extension is available for Chrome (and Chromium-based browsers like Edge, Brave, Arc). Firefox support is coming in month 2. Mobile browser extensions are not yet supported." },
  { q: "Is this suitable for children with ADHD?", a: "The reading adaptations are completely safe for children. The ASRS-6 quiz is designed for adults — for children, we recommend starting with Preset B and adjusting based on their comfort. There's no medical claim, just better text formatting." },
];

const FREE_FEATURES = [
  { included: true,  text: 'Preset A — Unlimited' },
  { included: true,  text: 'Preset B — 5 min/day preview' },
  { included: true,  text: 'Preset C — 5 min/day preview' },
  { included: true,  text: 'Custom Builder (Preset C) — 5 min/day preview' },
  { included: true,  text: 'ADHD Summary — 5 min/day preview' },
  { included: true,  text: 'TTS + Font controls' },
  { included: true,  text: 'All background colors' },
  { included: true,  text: 'Extension — Preset A sync' },
];

const PRO_FEATURES = [
  'Preset A, B, C — unlimited',
  'Preset C Custom Builder',
  'ADHD Summary — unlimited',
  'TTS + Font controls',
  'All background colors',
  'Extension full preset sync (A/B/C)',
  'Preset switcher in extension popup',
  '7-day free trial',
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(true);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [currency, setCurrency] = useState<CurrencyCode>('INR');
  const [locationState, setLocationState] = useState<'idle' | 'detecting' | 'done' | 'failed'>('idle');

  async function loadGeoCurrencyWithCoords(lat?: number, lon?: number) {
    const query = typeof lat === 'number' && typeof lon === 'number'
      ? `?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`
      : '';
    const res = await fetch(`/api/geo${query}`, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error('Failed to detect location');
    }
    return (await res.json()) as GeoResponse;
  }

  async function detectCurrencyFromBrowserLocation() {
    setLocationState('detecting');

    const hasGeo = typeof navigator !== 'undefined' && 'geolocation' in navigator;
    if (!hasGeo) {
      try {
        const data = await loadGeoCurrencyWithCoords();
        setCurrency(data.currency === 'INR' ? 'INR' : 'USD');
        setLocationState('done');
      } catch {
        setLocationState('failed');
      }
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const data = await loadGeoCurrencyWithCoords(position.coords.latitude, position.coords.longitude);
          setCurrency(data.currency === 'INR' ? 'INR' : 'USD');
          setLocationState('done');
        } catch {
          setLocationState('failed');
        }
      },
      async () => {
        try {
          const data = await loadGeoCurrencyWithCoords();
          setCurrency(data.currency === 'INR' ? 'INR' : 'USD');
          setLocationState('done');
        } catch {
          setLocationState('failed');
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 300000,
      }
    );
  }

  useEffect(() => {
    detectCurrencyFromBrowserLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pricing = useMemo(() => {
    const usd = {
      monthly: 6.99,
      annualMonthly: 4.92,
      annualTotal: 59,
    };

    if (currency === 'INR') {
      return {
        monthly: 579,
        annualMonthly: 409,
        annualTotal: 4899,
      };
    }

    return usd;
  }, [currency]);

  function formatPrice(value: number) {
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: currency === 'INR' ? 0 : 2,
      maximumFractionDigits: currency === 'INR' ? 0 : 2,
    }).format(value);
  }

  return (
    <div className={styles.page}>
      <Header minimalWhenAuthed />

      <main className={styles.main}>
        {/* Header */}
        <div className={styles.hero}>
          <h1 className={styles.title}>Read better everywhere.</h1>
          <p className={styles.sub}>Start free. Upgrade when you&apos;re ready.</p>
          <button
            type="button"
            className={styles.locationBtn}
            onClick={detectCurrencyFromBrowserLocation}
            disabled={locationState === 'detecting'}
          >
            {locationState === 'detecting' ? 'Detecting location...' : 'Use my location'}
          </button>

          {/* Billing toggle */}
          <div className={styles.billingToggle}>
            <button
              className={`${styles.billingBtn} ${!annual ? styles.billingActive : ''}`}
              onClick={() => setAnnual(false)}
            >
              Monthly
            </button>
            <button
              className={`${styles.billingBtn} ${annual ? styles.billingActive : ''}`}
              onClick={() => setAnnual(true)}
            >
              Annual <span className={styles.saveBadge}>Save 30%</span>
            </button>
          </div>
        </div>

        {/* Pricing cards */}
        <div className={styles.cards}>
          {/* Free */}
          <div className={`${styles.card} card`}>
            <div className={styles.tier}>Starter</div>
            <div className={styles.price}>{formatPrice(0)} <span className={styles.period}>/ forever</span></div>
            <p className={styles.tierDesc}>Experience Readapt on one text at a time.</p>

            <div className={styles.featureList}>
              {FREE_FEATURES.map((f, i) => (
                <div key={i} className={`${styles.featureItem} ${!f.included ? styles.featureMissing : ''}`}>
                  <span className={f.included ? styles.checkmark : styles.cross}>
                    {f.included ? '✓' : '✕'}
                  </span>
                  {f.text}
                </div>
              ))}
            </div>

            <Link href="/auth/signup" className={`btn btn-ghost ${styles.cta}`}>
              Get Started Free
            </Link>
          </div>

          {/* Pro */}
          <div className={`${styles.card} ${styles.cardPro}`}>
            <div className={styles.popularBadge}>Most Popular</div>
            <div className={styles.tier}>Pro</div>
            <div className={styles.price}>
              {annual ? formatPrice(pricing.annualMonthly) : formatPrice(pricing.monthly)}
              <span className={styles.period}>/month</span>
            </div>
            {annual && (
              <div className={styles.annualNote}>billed as {formatPrice(pricing.annualTotal)}/year</div>
            )}
            <p className={styles.tierDesc}>Your complete ADHD reading layer. On every website.</p>

            <div className={styles.featureList}>
              {PRO_FEATURES.map((f, i) => (
                <div key={i} className={styles.featureItem}>
                  <span className={styles.checkmark}>✓</span>
                  {f}
                </div>
              ))}
            </div>

            <Link href="/auth/signup" className={`btn btn-primary ${styles.cta}`}>
              Start 7-Day Free Trial
            </Link>
            <p className={styles.noCard}>Cancel anytime. No credit card for trial.</p>
          </div>
        </div>

        {/* FAQ */}
        <div className={styles.faqSection}>
          <h2 className={styles.faqTitle}>Common questions</h2>
          {FAQ.map((item, i) => (
            <div key={i} className="accordion-item">
              <button className="accordion-trigger" onClick={() => setFaqOpen(faqOpen === i ? null : i)}>
                {item.q}
                <span style={{ fontSize: '20px', color: 'var(--accent)', transform: faqOpen === i ? 'rotate(45deg)' : 'none', transition: 'transform 200ms', display: 'inline-block' }}>+</span>
              </button>
              {faqOpen === i && (
                <div className="accordion-content">{item.a}</div>
              )}
            </div>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}
