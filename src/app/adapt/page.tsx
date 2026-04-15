'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  adaptText,
  PRESETS,
  PresetId,
  applyBionicToText,
  type PresetConfig,
} from '@/lib/adaptEngine';
import { CUSTOM_SETTINGS_KEY, READING_TEXT_KEY } from '@/lib/readingSession';
import { getSupabaseBrowserClient } from '@/lib/supabaseClient';
import styles from './page.module.css';

type CustomBuilderSettings = {
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  wordSpacing: number;
  maxWidth: number;
  fontFamily: string;
  textColor: string;
  backgroundColor: string;
  bionicIntensity: number;
  focusLineColor: string;
  focusLineOpacity: number;
  focusLineWidth: number;
};

const BG_OPTIONS = [
  { id: 'default', color: '#1A1814', label: 'Warm Dark' },
  { id: 'cream', color: '#F5F0E8', label: 'Cream' },
  { id: 'sage', color: '#EEF2EC', label: 'Sage' },
  { id: 'dusk', color: '#1D1E2C', label: 'Dusk' },
];
const DEFAULT_BG_COLOR = BG_OPTIONS[0].color;

// Shared 5-minute preview pool for Preset B AND Preset C
const PRESET_PREVIEW_MS = 5 * 60 * 1000;
const PRESET_PREVIEW_KEY = 'readapt:presetPreview'; // renamed from presetBPreview
const EXTENSION_SYNC_GUEST_KEY = 'readapt:extensionSyncGuest';
const EXTENSION_SYNC_ACK_TIMEOUT_MS = 1600;
const ADAPT_CONTROL_PREFS_KEY = 'readapt:adaptControlPrefs';

type PresetControlPrefs = {
  focusMode: boolean;
  focusLineEnabled: boolean;
  chunkingEnabled: boolean;
  bionicEnabled: boolean;
};

function getDefaultPresetControlPrefs(preset: PresetId): PresetControlPrefs {
  if (preset === 'A') {
    return {
      focusMode: false,
      focusLineEnabled: false,
      chunkingEnabled: PRESETS.A.sentenceChunking,
      bionicEnabled: true,
    };
  }

  return {
    focusMode: true,
    focusLineEnabled: preset === 'C' ? true : PRESETS[preset].focusLine,
    chunkingEnabled: PRESETS[preset].sentenceChunking,
    bionicEnabled: true,
  };
}

function getUtcDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function formatMsAsClock(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getTextColor(bg: string) {
  const light = ['#F5F0E8', '#EEF2EC'];
  return light.includes(bg) ? '#1A1814' : '#F0EDEA';
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function hexToRgba(hex: string, opacity: number) {
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3
    ? normalized.split('').map((c) => `${c}${c}`).join('')
    : normalized;

  if (full.length !== 6) {
    return `rgba(200, 169, 110, ${opacity})`;
  }

  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, opacity))})`;
}

async function pushSyncPayloadToExtension(payload: Record<string, unknown>) {
  const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return new Promise<boolean>((resolve) => {
    let settled = false;

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', onMessage);
      resolve(ok);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || !event.data || typeof event.data !== 'object') return;

      const data = event.data as { type?: string; requestId?: string; ok?: boolean };
      if (data.type === 'READAPT_EXTENSION_SYNC_ACK' && data.requestId === requestId) {
        finish(Boolean(data.ok));
      }
    };

    window.addEventListener('message', onMessage);

    window.postMessage(
      {
        type: 'READAPT_EXTENSION_SYNC_PUSH',
        requestId,
        payload,
      },
      window.location.origin
    );

    window.setTimeout(() => finish(false), EXTENSION_SYNC_ACK_TIMEOUT_MS);
  });
}

function buildLocalSummary(text: string): string[] {
  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length === 0) return [];

  const scored = sentences.map((sentence) => {
    const words = sentence.toLowerCase().match(/[a-z']+/g) || [];
    const longWordBonus = words.filter((w) => w.length > 7).length * 0.2;
    const punctuationBonus = (sentence.match(/[,;:]/g) || []).length * 0.25;
    const lengthScore = Math.min(words.length / 12, 1.6);
    return { sentence, score: lengthScore + longWordBonus + punctuationBonus };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((item) => item.sentence.replace(/^[-*•]\s*/, '').trim());
}

function getGoogleUkEnglishFemaleVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((voice) => voice.name === 'Google UK English Female') || null;
}

function waitForGoogleUkEnglishFemaleVoice(timeoutMs = 1500): Promise<SpeechSynthesisVoice | null> {
  const immediate = getGoogleUkEnglishFemaleVoice();
  if (immediate) return Promise.resolve(immediate);

  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    const startedAt = Date.now();

    const onVoicesChanged = () => {
      const voice = getGoogleUkEnglishFemaleVoice();
      if (voice) {
        synth.removeEventListener('voiceschanged', onVoicesChanged);
        resolve(voice);
      } else if (Date.now() - startedAt >= timeoutMs) {
        synth.removeEventListener('voiceschanged', onVoicesChanged);
        resolve(null);
      }
    };

    synth.addEventListener('voiceschanged', onVoicesChanged);

    setTimeout(() => {
      synth.removeEventListener('voiceschanged', onVoicesChanged);
      resolve(getGoogleUkEnglishFemaleVoice());
    }, timeoutMs);
  });
}

function AdaptPage() {
  const router = useRouter();
  const params = useSearchParams();
  const initialPreset = (params.get('preset') as PresetId) || 'B';

  const [rawText, setRawText] = useState('');
  const [preset, setPreset] = useState<PresetId>(initialPreset);
  const [bg, setBg] = useState(DEFAULT_BG_COLOR);
  const [fontSize, setFontSize] = useState(0);
  const [focusMode, setFocusMode] = useState(initialPreset !== 'A');
  const [focusLineEnabled, setFocusLineEnabled] = useState(PRESETS[initialPreset].focusLine);
  const [chunkingEnabled, setChunkingEnabled] = useState(PRESETS[initialPreset].sentenceChunking);
  const [bionicEnabled, setBionicEnabled] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sectionOpen, setSectionOpen] = useState({
    reading: true,
    focus: true,
    appearance: true,
    advanced: true,
  });
  const [ttsActive, setTtsActive] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryBullets, setSummaryBullets] = useState<string[]>([]);
  const [revealIndex, setRevealIndex] = useState(0);
  const [customSettings, setCustomSettings] = useState<CustomBuilderSettings | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [planChecked, setPlanChecked] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  // Shared preview pool for both Preset B and Preset C
  const [previewRemainingMs, setPreviewRemainingMs] = useState(PRESET_PREVIEW_MS);
  const [upgradeNudge, setUpgradeNudge] = useState<string | null>(null);
  const [presetReverting, setPresetReverting] = useState(false);
  const [extensionSyncState, setExtensionSyncState] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [extensionSyncMeta, setExtensionSyncMeta] = useState('Ready to sync');

  const canvasRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const chunkRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const syncResetTimerRef = useRef<number | null>(null);
  const controlPrefsRef = useRef<Partial<Record<PresetId, PresetControlPrefs>>>({});
  const controlPrefsReadyRef = useRef(false);
  const controlPrefsHydratedRef = useRef(false);
  const suppressPrefsPersistRef = useRef(true);

  const presetConfig: PresetConfig = PRESETS[preset];
  const activeConfig: PresetConfig = preset === 'C' && customSettings
    ? {
        ...presetConfig,
        fontSize: customSettings.fontSize,
        lineHeight: customSettings.lineHeight,
        letterSpacing: `${customSettings.letterSpacing}em`,
        wordSpacing: `${customSettings.wordSpacing}em`,
        maxWidth: `${customSettings.maxWidth}px`,
        bionicIntensity: customSettings.bionicIntensity,
      }
    : presetConfig;

  const actualFontSize = fontSize || activeConfig.fontSize;
  const isPreviewLocked = planChecked && !isPro && previewRemainingMs <= 0 && (preset === 'B' || preset === 'C');
  const canUseFocusMode = preset !== 'A' && !isPreviewLocked;
  const freePreviewActive = !isPro && previewRemainingMs > 0;
  const canUseCustomBuilder = preset === 'C' && !isPreviewLocked && (isPro || freePreviewActive);
  const canUseSummary = preset !== 'A' && !isPreviewLocked && (isPro || (freePreviewActive && (preset === 'B' || preset === 'C')));
  const summaryText = summaryBullets.join(' ');
  const displayText = showSummary && summaryText ? summaryText : rawText;

  const adapted = adaptText(displayText, activeConfig, { bionic: bionicEnabled, chunking: chunkingEnabled });
  const allChunks = adapted.flatMap((p) => p.chunks);
  const chunkParagraphs = adapted.map((p) => p.chunks);

  let chunkCounter = 0;
  const chunkIndexMap = chunkParagraphs.map((par) => par.map(() => chunkCounter++));

  // ── Load Pro status ──────────────────────────────────────────────
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    async function loadPlan() {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data.user;
        if (!user) {
          setUserId(null);
          setIsPro(false);
          setPlanChecked(true);
          return;
        }

        setUserId(user.id);

        const res = await fetch(`/api/presets?userId=${encodeURIComponent(user.id)}`, { cache: 'no-store' });
        if (!res.ok) {
          setIsPro(false);
          setPlanChecked(true);
          return;
        }

        const payload = (await res.json()) as {
          profile?: {
            subscription_status?: string | null;
          } | null;
        };

        setIsPro(payload.profile?.subscription_status === 'active');
        setPlanChecked(true);
      } catch {
        setUserId(null);
        setIsPro(false);
        setPlanChecked(true);
      }
    }

    loadPlan();
  }, []);

  useEffect(() => {
    return () => {
      if (syncResetTimerRef.current !== null) {
        window.clearTimeout(syncResetTimerRef.current);
      }
    };
  }, []);

  // ── Load shared preview pool from localStorage ───────────────────
  useEffect(() => {
    const today = getUtcDayKey();
    try {
      const raw = localStorage.getItem(PRESET_PREVIEW_KEY);
      if (!raw) {
        setPreviewRemainingMs(PRESET_PREVIEW_MS);
        return;
      }

      const parsed = JSON.parse(raw) as { day?: string; remainingMs?: number };
      if (parsed.day !== today || typeof parsed.remainingMs !== 'number') {
        // New day — reset the pool
        setPreviewRemainingMs(PRESET_PREVIEW_MS);
        localStorage.setItem(PRESET_PREVIEW_KEY, JSON.stringify({ day: today, remainingMs: PRESET_PREVIEW_MS }));
        return;
      }

      setPreviewRemainingMs(Math.max(0, Math.min(PRESET_PREVIEW_MS, parsed.remainingMs)));
    } catch {
      setPreviewRemainingMs(PRESET_PREVIEW_MS);
    }
  }, []);

  // ── Persist preview pool to localStorage ────────────────────────
  useEffect(() => {
    if (isPro) return;
    const today = getUtcDayKey();
    localStorage.setItem(PRESET_PREVIEW_KEY, JSON.stringify({ day: today, remainingMs: previewRemainingMs }));
  }, [isPro, previewRemainingMs]);

  // ── Countdown timer — runs when free user is on B or C ──────────
  useEffect(() => {
    if (isPro) return;
    if (preset !== 'B' && preset !== 'C') return;
    if (previewRemainingMs <= 0) return;

    const timer = window.setInterval(() => {
      setPreviewRemainingMs((prev) => Math.max(0, prev - 1000));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [isPro, preset, previewRemainingMs]);

  // ── Load extension sync status ───────────────────────────────────
  useEffect(() => {
    if (!userId) {
      try {
        const raw = localStorage.getItem(EXTENSION_SYNC_GUEST_KEY);
        if (!raw) {
          setExtensionSyncState('idle');
          setExtensionSyncMeta('Ready to sync');
          return;
        }

        const parsed = JSON.parse(raw) as { presetId?: PresetId; syncedAt?: string };
        if (parsed.presetId && parsed.syncedAt) {
          const timeText = new Date(parsed.syncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setExtensionSyncState('idle');
          setExtensionSyncMeta(`Last synced ${parsed.presetId} at ${timeText}`);
          return;
        }

        setExtensionSyncState('idle');
        setExtensionSyncMeta('Ready to sync');
      } catch {
        setExtensionSyncState('error');
        setExtensionSyncMeta('Could not load local sync status');
      }
      return;
    }

    const currentUserId = userId;

    let cancelled = false;

    async function loadExtensionSync() {
      try {
        const res = await fetch(`/api/extension/sync?userId=${encodeURIComponent(currentUserId)}`, { cache: 'no-store' });
        if (!res.ok) {
          throw new Error('Failed sync status request');
        }

        const payload = (await res.json()) as {
          synced?: boolean;
          extensionSync?: {
            presetId?: PresetId;
            syncedAt?: string;
          } | null;
        };

        if (cancelled) return;

        if (payload.synced && payload.extensionSync?.presetId) {
          const timeText = payload.extensionSync.syncedAt
            ? new Date(payload.extensionSync.syncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : null;
          setExtensionSyncState('idle');
          setExtensionSyncMeta(`Last synced ${payload.extensionSync.presetId}${timeText ? ` at ${timeText}` : ''}`);
          return;
        }

        setExtensionSyncState('idle');
        setExtensionSyncMeta('Ready to sync');
      } catch {
        if (cancelled) return;
        setExtensionSyncState('error');
        setExtensionSyncMeta('Could not load sync status');
      }
    }

    loadExtensionSync();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // ── Show lock nudge when preview expires on B/C ─────────────────
  useEffect(() => {
    if (isPro) return;
    if (preset !== 'B' && preset !== 'C') return;
    if (previewRemainingMs > 0) return;

    setPresetReverting(true);
    const lockedPayload = {
      presetId: 'A',
      source: 'web',
      syncedAt: new Date().toISOString(),
      lock: {
        presetLocked: preset,
        reason: 'preview-expired',
      },
    };

    void pushSyncPayloadToExtension(lockedPayload);
    try {
      localStorage.setItem(
        EXTENSION_SYNC_GUEST_KEY,
        JSON.stringify(lockedPayload)
      );
    } catch {
      // Ignore local sync write failures.
    }

    const resetAnim = window.setTimeout(() => setPresetReverting(false), 420);
    return () => window.clearTimeout(resetAnim);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPro, preset, previewRemainingMs]);

  // ── Load reading text & custom settings ─────────────────────────
  useEffect(() => {
    const text = localStorage.getItem(READING_TEXT_KEY) || '';
    setRawText(text);

    try {
      const raw = localStorage.getItem(CUSTOM_SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CustomBuilderSettings;
        setCustomSettings(parsed);
      }
    } catch {
      setCustomSettings(null);
    }
  }, []);

  // ── Load persisted control prefs once (per preset) ──────────────
  useEffect(() => {
    suppressPrefsPersistRef.current = true;
    controlPrefsHydratedRef.current = false;

    try {
      const raw = localStorage.getItem(ADAPT_CONTROL_PREFS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Record<PresetId, PresetControlPrefs>>;
        if (parsed && typeof parsed === 'object') {
          controlPrefsRef.current = parsed;
        }
      }
    } catch {
      controlPrefsRef.current = {};
    } finally {
      controlPrefsReadyRef.current = true;
      const presetPrefs = controlPrefsRef.current[preset] ?? getDefaultPresetControlPrefs(preset);
      setFocusMode(preset === 'A' ? false : presetPrefs.focusMode);
      setFocusLineEnabled(preset === 'A' ? false : presetPrefs.focusLineEnabled);
      setChunkingEnabled(presetPrefs.chunkingEnabled);
      setBionicEnabled(presetPrefs.bionicEnabled);

      window.requestAnimationFrame(() => {
        controlPrefsHydratedRef.current = true;
        suppressPrefsPersistRef.current = false;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Apply stored prefs when preset changes ──────────────────────
  useEffect(() => {
    if (!controlPrefsReadyRef.current) return;

    suppressPrefsPersistRef.current = true;

    if (!isPro && previewRemainingMs <= 0 && (preset === 'B' || preset === 'C')) {
      setFocusMode(false);
      setFocusLineEnabled(false);
      window.requestAnimationFrame(() => {
        suppressPrefsPersistRef.current = false;
      });
      return;
    }

    const presetPrefs = controlPrefsRef.current[preset] ?? getDefaultPresetControlPrefs(preset);
    setFocusMode(preset === 'A' ? false : presetPrefs.focusMode);
    setFocusLineEnabled(preset === 'A' ? false : presetPrefs.focusLineEnabled);
    setChunkingEnabled(presetPrefs.chunkingEnabled);
    setBionicEnabled(presetPrefs.bionicEnabled);

    window.requestAnimationFrame(() => {
      suppressPrefsPersistRef.current = false;
    });
  }, [isPro, preset, previewRemainingMs]);

  // ── Persist current control prefs per preset ────────────────────
  useEffect(() => {
    if (!controlPrefsReadyRef.current || !controlPrefsHydratedRef.current) return;
    if (suppressPrefsPersistRef.current) return;

    const nextPrefs: PresetControlPrefs = {
      focusMode: preset === 'A' ? false : focusMode,
      focusLineEnabled: preset === 'A' ? false : focusLineEnabled,
      chunkingEnabled,
      bionicEnabled,
    };

    const merged = {
      ...controlPrefsRef.current,
      [preset]: nextPrefs,
    };

    controlPrefsRef.current = merged;
    try {
      localStorage.setItem(ADAPT_CONTROL_PREFS_KEY, JSON.stringify(merged));
    } catch {
      // Ignore storage quota failures.
    }
  }, [preset, focusMode, focusLineEnabled, chunkingEnabled, bionicEnabled]);

  useEffect(() => {
    if (preset === 'C' && customSettings?.backgroundColor) {
      setBg(customSettings.backgroundColor);
    } else {
      setBg(DEFAULT_BG_COLOR);
    }
  }, [preset, customSettings]);

  // ── Focus/reveal scroll sync ─────────────────────────────────────
  useEffect(() => {
    if (!focusMode || preset === 'A') return;

    const syncRevealToScroll = () => {
      const canvas = canvasRef.current;
      const el = contentRef.current;
      if (!canvas || !el || allChunks.length === 0) return;

      const canvasRect = canvas.getBoundingClientRect();
      const activationLine = canvasRect.top + canvas.clientHeight * 0.35;
      const beforeContentTop = canvas.scrollTop <= 4;
      if (beforeContentTop) {
        setRevealIndex(0);
        return;
      }

      let nextIndex = 0;
      chunkRefs.current.forEach((node, idx) => {
        if (!node) return;
        const nodeTop = node.getBoundingClientRect().top;
        if (nodeTop <= activationLine) {
          nextIndex = idx;
        }
      });

      setRevealIndex(Math.min(allChunks.length - 1, Math.max(0, nextIndex)));
    };

    const canvas = canvasRef.current;
    if (!canvas) return;

    syncRevealToScroll();
    canvas.addEventListener('scroll', syncRevealToScroll, { passive: true });
    window.addEventListener('resize', syncRevealToScroll);
    return () => {
      canvas.removeEventListener('scroll', syncRevealToScroll);
      window.removeEventListener('resize', syncRevealToScroll);
    };
  }, [focusMode, preset, allChunks.length]);

  useEffect(() => {
    chunkRefs.current = chunkRefs.current.slice(0, allChunks.length);
  }, [allChunks.length]);

  useEffect(() => {
    setRevealIndex(0);
  }, [preset, focusMode]);

  // ── TTS ─────────────────────────────────────────────────────────
  async function handleTTS() {
    if (!window.speechSynthesis) return;

    if (ttsActive) {
      window.speechSynthesis.cancel();
      setTtsActive(false);
      return;
    }

    const targetVoice = await waitForGoogleUkEnglishFemaleVoice();
    if (!targetVoice) {
      setTtsActive(false);
      window.alert('Google UK English Female voice is not available in this browser.');
      return;
    }

    const utt = new SpeechSynthesisUtterance(displayText);
    utt.voice = targetVoice;
    utt.lang = targetVoice.lang;
    utt.onend = () => setTtsActive(false);
    utt.onerror = () => setTtsActive(false);
    window.speechSynthesis.speak(utt);
    setTtsActive(true);
  }

  // ── Summary ──────────────────────────────────────────────────────
  async function fetchSummary() {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const bullets = buildLocalSummary(rawText);
      if (bullets.length === 0) {
        throw new Error('Not enough content to summarize.');
      }
      setSummaryBullets(bullets);
      setShowSummary(true);
    } catch (error) {
      setSummaryError(error instanceof Error ? error.message : 'Failed to generate summary.');
      setSummaryBullets([]);
      setShowSummary(false);
    } finally {
      setSummaryLoading(false);
    }
  }

  // ── Handle preset selection ──────────────────────────────────────
  function handlePresetClick(p: PresetId) {
    if (p === 'A') {
      setPreset('A');
      setFocusMode(false);
      return;
    }

    // B or C — requires preview time or Pro
    if (!isPro && previewRemainingMs <= 0) {
      setPreset(p);
      setFocusMode(false);
      return;
    }

    setPreset(p);
    setFocusMode(true);
    setFocusLineEnabled(p === 'C' ? true : PRESETS[p].focusLine);
  }

  async function handleSyncWithExtension() {
    if (isPreviewLocked) {
      const lockedPayload = {
        presetId: 'A',
        source: 'web',
        syncedAt: new Date().toISOString(),
        lock: {
          presetLocked: preset,
          reason: 'preview-expired',
        },
      };

      const extensionBridgeOk = await pushSyncPayloadToExtension(lockedPayload);

      try {
        localStorage.setItem(
          EXTENSION_SYNC_GUEST_KEY,
          JSON.stringify(lockedPayload)
        );
      } catch {
        // Ignore local sync write failures.
      }
      setExtensionSyncState('error');
      setExtensionSyncMeta(
        extensionBridgeOk
          ? `Preset ${preset} is locked. Extension fallback is Preset A.`
          : `Preset ${preset} is locked. Load extension on this tab to sync fallback.`
      );
      return;
    }

    setExtensionSyncState('syncing');
    setExtensionSyncMeta('Syncing current preset...');

    try {
      const settingsPayload: Record<string, unknown> = {
        presetId: preset,
        profileName: PRESETS[preset].profileName,
        isPro,
        bionicEnabled,
        chunkingEnabled,
        focusMode,
        focusLineEnabled,
        extensionFocusLineAvailable: false,
        sentenceReveal: preset !== 'A' && focusMode,
        fontSize: actualFontSize,
        fontFamily: preset === 'C' && customSettings?.fontFamily
          ? customSettings.fontFamily
          : 'Literata, Georgia, serif',
        backgroundColor: bg,
        textColor: pageTextColor,
        focusLineColor,
        focusLineOpacity,
        focusLineWidth: focusLineHeight,
        // focusLineLength removed — focus line auto-spans full text column width
        lineHeight: activeConfig.lineHeight,
        letterSpacing: activeConfig.letterSpacing,
        wordSpacing: activeConfig.wordSpacing,
        maxWidth: activeConfig.maxWidth,
        bionicIntensity: activeConfig.bionicIntensity,
        maxChunkWords: activeConfig.maxChunkWords,
      };

      if (preset === 'C' && customSettings) {
        settingsPayload.customBuilder = customSettings;
      }

      const bridgePayload = {
        presetId: preset,
        source: 'web',
        syncedAt: new Date().toISOString(),
        settings: settingsPayload,
      };

      const extensionBridgeOk = await pushSyncPayloadToExtension(bridgePayload);

      if (!userId) {
        localStorage.setItem(
          EXTENSION_SYNC_GUEST_KEY,
          JSON.stringify(bridgePayload)
        );

        if (extensionBridgeOk) {
          setExtensionSyncState('synced');
          setExtensionSyncMeta(`Synced ${preset} \u2713 (guest mode)`);
          if (syncResetTimerRef.current !== null) {
            window.clearTimeout(syncResetTimerRef.current);
          }
          syncResetTimerRef.current = window.setTimeout(() => {
            setExtensionSyncState('idle');
            setExtensionSyncMeta('Ready to sync');
          }, 1500);
        } else {
          setExtensionSyncState('error');
          setExtensionSyncMeta('Extension not reachable on this tab. Open popup on this page and retry.');
        }
        return;
      }

      const res = await fetch('/api/extension/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          presetId: preset,
          source: 'web',
          settings: settingsPayload,
        }),
      });

      if (!res.ok) {
        throw new Error('Sync failed');
      }

      if (extensionBridgeOk) {
        setExtensionSyncState('synced');
        setExtensionSyncMeta(`Synced ${preset} \u2713`);
        if (syncResetTimerRef.current !== null) {
          window.clearTimeout(syncResetTimerRef.current);
        }
        syncResetTimerRef.current = window.setTimeout(() => {
          setExtensionSyncState('idle');
          setExtensionSyncMeta('Ready to sync');
        }, 1500);
      } else {
        setExtensionSyncState('error');
        setExtensionSyncMeta('Cloud sync saved, but extension on this tab did not confirm.');
      }
    } catch {
      setExtensionSyncState('error');
      setExtensionSyncMeta('Sync failed. Try again.');
    }
  }

  if (!rawText.trim()) {
    return (
      <div className={styles.inputPage}>
        <div className={styles.inputInner}>
          <Link href="/dashboard" className={styles.logo}>
            <Image src="/logo.png" alt="Readapt" width={34} height={34} className={styles.logoIcon} priority />
            <span>Readapt</span>
          </Link>
          <h1 className={styles.inputHeading}>No pasted text yet.</h1>
          <p className={styles.inputSub}>Paste text first, then come back to read with your preset.</p>
          <Link href="/paste" className="btn btn-primary" style={{ width: 'fit-content' }}>Go to Paste Page →</Link>
        </div>
      </div>
    );
  }

  const textColor = getTextColor(bg);
  const pageBackground = bg;
  const pageTextColor = preset === 'C' && customSettings?.textColor ? customSettings.textColor : textColor;
  const focusLineColor = preset === 'C' && customSettings?.focusLineColor
    ? customSettings.focusLineColor
    : '#C8A96E';
  const focusLineOpacity = preset === 'C' && typeof customSettings?.focusLineOpacity === 'number'
    ? customSettings.focusLineOpacity
    : PRESETS[preset].focusLineOpacity;
  const focusLineHeight = preset === 'C' && typeof customSettings?.focusLineWidth === 'number'
    ? customSettings.focusLineWidth
    : 58;
  // focusLineLength removed — focus line now always spans full text column width
  const focusLineFill = hexToRgba(focusLineColor, focusLineOpacity);

  // Low time warning: amber pulse when < 60 seconds left
  const isLowTime = !isPro && (preset === 'B' || preset === 'C') && previewRemainingMs > 0 && previewRemainingMs <= 60000;

  const presetInfo = {
    A: { name: 'Mild', accent: '#5AB98C' },
    B: { name: 'Moderate', accent: '#C8A96E' },
    C: { name: 'Intense', accent: '#9B8EC4' },
  } as const;

  const renderSectionHeader = (id: 'reading' | 'focus' | 'appearance' | 'advanced', label: string) => (
    <button className={styles.sectionHeaderBtn} onClick={() => setSectionOpen((s) => ({ ...s, [id]: !s[id] }))}>
      <span>{label}</span>
      <span>{sectionOpen[id] ? '▾' : '▸'}</span>
    </button>
  );

  return (
    <div className={`${styles.adaptLayout} ${sidebarCollapsed ? styles.sidebarCollapsed : ''}`}>
      <section ref={canvasRef} className={styles.readingCanvas} style={{ background: pageBackground, color: pageTextColor }}>
        {upgradeNudge && (
          <div className={styles.upgradeNudge}>{upgradeNudge}</div>
        )}

        {focusMode && focusLineEnabled && canUseFocusMode && (
          <div
            className={styles.canvasFocusLine}
            style={{
              height: `${focusLineHeight}px`,
              /* Width = text column width (matches activeConfig.maxWidth) — always full text span */
              width: activeConfig.maxWidth,
              maxWidth: 'calc(100% - 32px)',
              margin: '0 auto',
              background: `linear-gradient(to bottom, transparent, ${focusLineFill} 25%, ${focusLineFill} 75%, transparent)`,
            }}
          />
        )}

        <div
          ref={contentRef}
          className={`${styles.textContainer} ${presetReverting ? styles.presetRevertAnim : ''}`}
          style={{
            maxWidth: activeConfig.maxWidth,
            fontFamily: preset === 'C' && customSettings ? customSettings.fontFamily : 'Literata, Georgia, serif',
            fontSize: `${actualFontSize}px`,
            lineHeight: activeConfig.lineHeight,
            letterSpacing: activeConfig.letterSpacing,
            wordSpacing: activeConfig.wordSpacing,
            color: pageTextColor,
          }}
        >
          {showSummary && !summaryLoading && !summaryError && (
            <p className={styles.summaryInlineMeta}>Summary mode enabled. You are reading the adapted summary.</p>
          )}
          {summaryError && <p className={styles.summaryInlineError}>{summaryError}</p>}

          {isPreviewLocked ? (
            <div className={styles.lockedPresetCard}>
              <h3>Preset {preset} is locked</h3>
              <p>Upgrade to Pro to keep using this mode after your daily preview window.</p>
              <Link href="/pricing" className="btn btn-primary">Upgrade to Pro</Link>
            </div>
          ) : (preset === 'B' || preset === 'C') ? (
            <div className={styles.chunkFlow}>
              {chunkParagraphs.map((paragraphChunks, paragraphIndex) => (
                <div key={paragraphIndex} className={styles.chunkParagraph} style={{ marginBottom: activeConfig.paragraphSpacing }}>
                  {paragraphChunks.map((chunk, chunkInParagraphIndex) => {
                    const globalChunkIndex = chunkIndexMap[paragraphIndex][chunkInParagraphIndex];
                    const isActive = globalChunkIndex === revealIndex;
                    return (
                      <span
                        key={globalChunkIndex}
                        ref={(node) => { chunkRefs.current[globalChunkIndex] = node; }}
                        className={styles.chunkSentence}
                        style={{
                          opacity: focusMode ? (isActive ? 1 : globalChunkIndex < revealIndex ? 0.25 : 0.15) : 1,
                          transition: 'opacity 300ms',
                        }}
                        dangerouslySetInnerHTML={{
                          __html: (
                            bionicEnabled
                              ? applyBionicToText(chunk, activeConfig.bionicIntensity)
                              : escapeHtml(chunk)
                          ).replace(/\n/g, '<br/>') + ' ',
                        }}
                      />
                    );
                  })}
                </div>
              ))}
              {focusMode && (
                <div className={styles.revealHint}>
                  Scroll to advance · {revealIndex + 1} / {allChunks.length}
                </div>
              )}
            </div>
          ) : (
            adapted.map((para, i) => (
              <p
                key={i}
                className="bionic-text"
                style={{ marginBottom: activeConfig.paragraphSpacing, color: pageTextColor }}
                dangerouslySetInnerHTML={{ __html: para.html.replace(/\n/g, '<br/>') }}
              />
            ))
          )}

          <div className={styles.endStateCard}>
            <p>You&apos;ve finished reading.</p>
            <div className={styles.endStateBtns}>
              <button
                className="btn btn-ghost"
                onClick={() => router.push('/paste?preset=A')}
              >
                Back to Paste and use Preset A only
              </button>
            </div>
          </div>
        </div>
      </section>

      <aside className={styles.sidebarPanel}>
        {!sidebarCollapsed && (
          <div className={styles.sidebarHeaderBlock}>
            <div className={styles.sidebarHeaderTop}>
              <button className={styles.sidebarBackBtn} onClick={() => router.push(`/paste?preset=${preset}`)}>← Back</button>
              <Link href="/dashboard" className={styles.sidebarBrandLink}>
                <Image src="/logo.png" alt="Readapt" width={18} height={18} className={styles.sidebarBrandIcon} />
                <span>Readapt</span>
              </Link>
              <button
                className={styles.sidebarCollapseIconBtn}
                onClick={() => setSidebarCollapsed(true)}
                aria-label="Collapse controls"
                title="Collapse controls"
              >
                ›
              </button>
            </div>
            <div className={styles.sidebarPresetTitle}>Preset {preset}</div>
            <div className={styles.sidebarPresetSub}>{PRESETS[preset].profileName}</div>
            {planChecked && !isPro && (preset === 'B' || preset === 'C') && (
              <div className={`${styles.sidebarTimerChip} ${isLowTime ? styles.sidebarTimerChipLow : ''}`}>
                <span className={styles.previewTimerDot} />
                Preset Preview Remaining: <span className={styles.previewTimerClock}>{formatMsAsClock(previewRemainingMs)}</span>
              </div>
            )}
          </div>
        )}

        {!sidebarCollapsed ? (
          <>
            <div className={styles.presetSelectorGrid}>
              {(['A', 'B', 'C'] as PresetId[]).map((p) => {
                const isPreviewPreset = !isPro && (p === 'B' || p === 'C');
                const isPreviewUsed = isPreviewPreset && previewRemainingMs <= 0;
                return (
                  <button
                    key={p}
                    className={`${styles.presetCardBtn} ${preset === p ? styles.presetCardActive : ''}`}
                    style={{ borderColor: preset === p ? presetInfo[p].accent : 'var(--bg-border)' }}
                    onClick={() => handlePresetClick(p)}
                  >
                    <div className={styles.presetCardTop}>
                      <span>{p}</span>
                      {isPreviewPreset && !isPreviewUsed && <span className={styles.presetBadge}>{formatMsAsClock(previewRemainingMs)}</span>}
                      {isPreviewPreset && isPreviewUsed && <span className={styles.presetBadge}>Used</span>}
                    </div>
                    <div className={styles.presetCardLabel}>{presetInfo[p].name}</div>
                  </button>
                );
              })}
            </div>
            {isPreviewLocked ? (
              <div className={styles.presetLockedNotice}>
                Upgrade to Pro to use Preset {preset}
              </div>
            ) : (
              <>
                <div className={styles.extensionSyncPanel}>
                  <div className={styles.extensionSyncLabel}>Extension Sync</div>
                  <button
                    className={`${styles.extensionSyncBtn} ${extensionSyncState === 'synced' ? styles.extensionSyncBtnSynced : ''}`}
                    onClick={handleSyncWithExtension}
                    disabled={extensionSyncState === 'syncing'}
                  >
                    {extensionSyncState === 'syncing' ? 'Syncing...' : extensionSyncState === 'synced' ? '\u2713 Synced' : 'Sync with Extension'}
                  </button>
                  <div className={styles.extensionSyncMeta}>{extensionSyncMeta}</div>
                </div>

                <div className={styles.sidebarSection}>
                  {renderSectionHeader('reading', 'Reading Style')}
                  {sectionOpen.reading && (
                    <div className={styles.sectionBody}>
                      <div className={styles.controlRow}><span>Bionic Reading</span><button className={`${styles.smallToggle} ${bionicEnabled ? styles.smallToggleOn : ''}`} onClick={() => setBionicEnabled((v) => !v)}>{bionicEnabled ? 'On' : 'Off'}</button></div>
                      <div className={styles.readOnlyLine}>Intensity: {activeConfig.bionicIntensity.toFixed(2)}</div>
                      {preset !== 'A' && (
                        <>
                          <div className={styles.controlRow}><span>Sentence Chunking</span><button className={`${styles.smallToggle} ${chunkingEnabled ? styles.smallToggleOn : ''}`} onClick={() => setChunkingEnabled((v) => !v)}>{chunkingEnabled ? 'On' : 'Off'}</button></div>
                          <div className={styles.readOnlyLine}>Chunk size up to {activeConfig.maxChunkWords} words</div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {preset !== 'A' && (
                  <div className={styles.sidebarSection}>
                    {renderSectionHeader('focus', 'Focus Tools')}
                    {sectionOpen.focus && (
                      <div className={styles.sectionBody}>
                        <div className={styles.controlRow}><span>Focus Mode</span><button className={`${styles.smallToggle} ${focusMode ? styles.smallToggleOn : ''}`} onClick={() => setFocusMode((v) => !v)}>{focusMode ? 'On' : 'Off'}</button></div>
                        <div className={styles.controlRow}><span>Focus Line</span><button className={`${styles.smallToggle} ${focusLineEnabled ? styles.smallToggleOn : ''}`} onClick={() => setFocusLineEnabled((v) => !v)}>{focusLineEnabled ? 'On' : 'Off'}</button></div>
                      </div>
                    )}
                  </div>
                )}

                <div className={styles.sidebarSection}>
                  {renderSectionHeader('appearance', 'Appearance')}
                  {sectionOpen.appearance && (
                    <div className={styles.sectionBody}>
                      <div className={styles.bgSwatchRow}>
                        {BG_OPTIONS.map((b) => (
                          <button
                            key={b.id}
                            className={`${styles.bgSwatch} ${bg === b.color ? styles.bgSwatchActive : ''}`}
                            style={{ background: b.color }}
                            onClick={() => setBg(b.color)}
                            title={b.label}
                          />
                        ))}
                      </div>
                      <div className={styles.controlRow}><span>Font Size</span><div className={styles.fontStepper}><button onClick={() => setFontSize((f) => Math.max(14, (f || actualFontSize) - 2))}>−</button><span>{actualFontSize}</span><button onClick={() => setFontSize((f) => Math.min(38, (f || actualFontSize) + 2))}>+</button></div></div>
                    </div>
                  )}
                </div>

                {preset === 'C' && (
                  <div className={styles.sidebarSection}>
                    {renderSectionHeader('advanced', 'Advanced')}
                    {sectionOpen.advanced && (
                      <div className={styles.sectionBody}>
                        <button
                          className={`btn btn-ghost ${styles.fullWidthBtn} ${!canUseCustomBuilder ? styles.disabledAction : ''}`}
                          onClick={() => {
                            if (canUseCustomBuilder) router.push('/custom-builder');
                            else setUpgradeNudge('Custom Builder is available while preview runs or on Pro.');
                          }}
                        >
                          Open Custom Builder
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className={styles.sidebarFooter}>
                  <button className={`btn btn-ghost ${styles.fullWidthBtn}`} onClick={handleTTS}>{ttsActive ? 'Stop TTS' : 'Start TTS'}</button>
                  {preset !== 'A' && (
                    <button
                      className={`btn btn-primary ${styles.fullWidthBtn} ${!canUseSummary ? styles.disabledAction : ''}`}
                      onClick={() => {
                        if (!canUseSummary) {
                          setUpgradeNudge('Summary is available while preview runs or on Pro.');
                          return;
                        }
                        if (summaryLoading) return;
                        if (showSummary) {
                          setShowSummary(false);
                          return;
                        }
                        if (summaryBullets.length > 0) {
                          setShowSummary(true);
                          return;
                        }
                        fetchSummary();
                      }}
                    >
                      {summaryLoading ? 'Generating...' : `Summary ${showSummary ? 'On' : 'Off'}`}
                    </button>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          <div className={styles.sidebarCollapsedRail}>
            <button onClick={() => setSidebarCollapsed(false)} aria-label="Open controls" title="Open controls">‹</button>
          </div>
        )}
      </aside>
    </div>
  );
}

export default function AdaptPageWrapper() {
  return (
    <Suspense>
      <AdaptPage />
    </Suspense>
  );
}
