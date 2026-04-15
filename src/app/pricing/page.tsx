'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getSupabaseBrowserClient } from '@/lib/supabaseClient';
import styles from './page.module.css';

type CurrencyCode = 'INR' | 'USD';

type GeoResponse = {
  countryCode: string;
  currency: CurrencyCode;
  source?: 'geolocation' | 'headers';
};

type PlanType = 'monthly' | 'annual';

type RazorpayOrderResponse = {
  keyId: string;
  orderId: string;
  amount: number;
  currency: CurrencyCode;
  plan: PlanType;
};

type RazorpayVerifyResponse = {
  ok?: boolean;
  status?: string;
  error?: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on?: (eventName: string, handler: (payload: unknown) => void) => void;
    };
  }
}

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
  const router = useRouter();
  const [annual, setAnnual] = useState(true);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [currency, setCurrency] = useState<CurrencyCode>('INR');
  const [locationState, setLocationState] = useState<'idle' | 'detecting' | 'done' | 'failed'>('idle');
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [paymentState, setPaymentState] = useState<'idle' | 'starting' | 'verifying'>('idle');
  const [paymentError, setPaymentError] = useState<string | null>(null);

  async function loadRazorpayCheckoutScript() {
    if (typeof window === 'undefined') return false;
    if (window.Razorpay) return true;

    return new Promise<boolean>((resolve) => {
      const existing = document.querySelector('script[data-readapt-razorpay="1"]') as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener('load', () => resolve(true), { once: true });
        existing.addEventListener('error', () => resolve(false), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.dataset.readaptRazorpay = '1';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }

  async function handleProCheckout() {
    setPaymentError(null);

    if (!userId) {
      router.push('/auth/login');
      return;
    }

    const plan: PlanType = annual ? 'annual' : 'monthly';

    try {
      setPaymentState('starting');

      const orderRes = await fetch('/api/razorpay/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          currency,
          userId,
        }),
      });

      if (!orderRes.ok) {
        const orderErr = (await orderRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(orderErr.error || 'Failed to create payment order.');
      }

      const order = (await orderRes.json()) as RazorpayOrderResponse;
      if (!order.orderId || !order.keyId) {
        throw new Error('Invalid payment order response.');
      }

      const scriptLoaded = await loadRazorpayCheckoutScript();
      if (!scriptLoaded || !window.Razorpay) {
        throw new Error('Could not load Razorpay checkout script.');
      }

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: 'Readapt',
        description: annual ? 'Readapt Pro Annual' : 'Readapt Pro Monthly',
        prefill: {
          email: userEmail || undefined,
        },
        notes: {
          app: 'readapt',
          userId,
          plan,
        },
        theme: {
          color: '#C8A96E',
        },
        handler: async (response: {
          razorpay_order_id?: string;
          razorpay_payment_id?: string;
          razorpay_signature?: string;
        }) => {
          try {
            setPaymentState('verifying');

            const verifyRes = await fetch('/api/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId,
                plan,
                currency: order.currency,
                amount: order.amount,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });

            const verifyData = (await verifyRes.json()) as RazorpayVerifyResponse;
            if (!verifyRes.ok || !verifyData.ok) {
              throw new Error(verifyData.error || 'Payment verification failed.');
            }

            router.push('/dashboard');
            router.refresh();
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Payment verification failed.';
            setPaymentError(msg);
            setPaymentState('idle');
          }
        },
      });

      rzp.on?.('payment.failed', () => {
        setPaymentError('Payment failed or was cancelled. Please try again.');
        setPaymentState('idle');
      });

      rzp.open();
      setPaymentState('idle');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unable to start payment.';
      setPaymentError(msg);
      setPaymentState('idle');
    }
  }

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

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setUserEmail(data.user?.email ?? '');
    });
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

            <button
              type="button"
              className={`btn btn-primary ${styles.cta}`}
              onClick={handleProCheckout}
              disabled={paymentState !== 'idle'}
            >
              {paymentState === 'starting'
                ? 'Starting payment...'
                : paymentState === 'verifying'
                  ? 'Verifying payment...'
                  : 'Start 7-Day Free Trial'}
            </button>
            {paymentError && (
              <p className={styles.noCard} style={{ color: '#ff9a9a', marginTop: '-4px' }}>
                {paymentError}
              </p>
            )}
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
