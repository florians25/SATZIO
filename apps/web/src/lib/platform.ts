/**
 * PLATTFORM-ERKENNUNG
 * Bestimmt einmalig, welche Designsprache die App spricht:
 *  - 'ios'     → iOS 26 „Liquid Glass“ (Capacitor-iOS-App und iPhone/iPad-Safari/PWA)
 *  - 'android' → Material Design 3 (Capacitor-Android-App und Android-Chrome/PWA)
 *  - 'web'     → bisheriges Design (Desktop & Rest)
 * Ergebnis landet in <html data-platform="…"> – das CSS steuert daran die Varianten.
 * Ein Inline-Skript in index.html setzt das Attribut schon vor dem ersten Paint;
 * dieses Modul ist die maßgebliche Quelle zur Laufzeit.
 * Testen: localStorage 'satzio-platform-style' = 'ios' | 'android' | 'web'.
 */
export type Platform = 'ios' | 'android' | 'web';

export const PLATFORM_OVERRIDE_KEY = 'satzio-platform-style';

interface CapacitorGlobal {
  getPlatform?: () => string;
  isNativePlatform?: () => boolean;
}

function capacitor(): CapacitorGlobal | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

/** Läuft die App in der nativen Capacitor-Hülle (nicht im Browser)? */
export function isNative(): boolean {
  try {
    return capacitor()?.isNativePlatform?.() ?? false;
  } catch {
    return false;
  }
}

export function detectPlatform(): Platform {
  if (typeof window === 'undefined') return 'web';
  try {
    const o = localStorage.getItem(PLATFORM_OVERRIDE_KEY);
    if (o === 'ios' || o === 'android' || o === 'web') return o;
  } catch {
    /* ignore */
  }
  const cap = capacitor()?.getPlatform?.();
  if (cap === 'ios' || cap === 'android') return cap;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  // iPadOS meldet sich als Mac – aber mit Touch
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'web';
}

export const platform: Platform = detectPlatform();
export const isIOS = platform === 'ios';
export const isAndroid = platform === 'android';

/** Setzt data-platform (und data-native) am <html>-Element. */
export function applyPlatform() {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  el.dataset.platform = platform;
  if (isNative()) el.dataset.native = 'true';
  if (platform === 'android') installRipple();
}

const RIPPLE_TARGETS = 'button, a[href], [role="button"], [role="radio"], [role="tab"], [role="switch"], [data-ripple-host]';
let rippleInstalled = false;

/**
 * Material-3-Wellen-Feedback ohne DOM-Eingriffe: setzt nur CSS-Variablen und
 * ein data-Attribut am gedrückten Element; das ::before zeichnet die Welle (platform.css).
 */
function installRipple() {
  if (rippleInstalled || typeof document === 'undefined') return;
  rippleInstalled = true;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (reduce.matches || e.button !== 0) return;
      let el = (e.target as Element | null)?.closest<HTMLElement>(RIPPLE_TARGETS);
      if (!el || el.matches(':disabled, [aria-disabled="true"]')) return;
      // Navigationsleiste: Welle in der Indikator-Pille
      const isTab = el.dataset.ui === 'tab';
      if (isTab) el = el.querySelector<HTMLElement>('[data-ui="tab-icon"]') ?? el;
      const r = el.getBoundingClientRect();
      const x = isTab ? r.width / 2 : e.clientX - r.left;
      const y = isTab ? r.height / 2 : e.clientY - r.top;
      const max = Math.hypot(Math.max(x, r.width - x), Math.max(y, r.height - y));
      el.style.setProperty('--rx', `${x}px`);
      el.style.setProperty('--ry', `${y}px`);
      el.style.setProperty('--rmax', `${Math.ceil(max)}px`);
      el.removeAttribute('data-ripple');
      void el.offsetWidth; // Animation neu starten
      el.setAttribute('data-ripple', '');
      const target = el;
      window.setTimeout(() => {
        if (target.getAttribute('data-ripple') === '') target.removeAttribute('data-ripple');
      }, 600);
    },
    { passive: true, capture: true },
  );
}
