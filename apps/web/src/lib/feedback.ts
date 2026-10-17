import { hapticImpact, hapticSuccess, requestNativeNotificationPermission } from './native';
import { isNative } from './platform';

/**
 * Haptisches & akustisches Feedback – nur, wenn vom Gerät unterstützt und aktiviert.
 * In der nativen App echte Taptic-Engine/Android-Haptik statt navigator.vibrate
 * (das es in iOS Safari gar nicht gibt): kurze Impulse → Impact, Muster → Erfolgs-Haptik.
 */
export function vibrate(pattern: number | number[] = 12) {
  if (isNative()) {
    if (Array.isArray(pattern)) {
      const total = pattern.reduce((a, b) => a + b, 0);
      if (total >= 300) hapticImpact('heavy');
      hapticSuccess();
    } else {
      hapticImpact(pattern >= 40 ? 'heavy' : pattern >= 20 ? 'medium' : 'light');
    }
    return;
  }
  try {
    if ('vibrate' in navigator) navigator.vibrate(pattern);
  } catch {
    /* nicht unterstützt (z. B. iOS Safari) */
  }
}

let ctx: AudioContext | null = null;
export function beep(times = 2) {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    const c = ctx;
    for (let i = 0; i < times; i++) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.value = i === times - 1 ? 1046 : 784;
      const t = c.currentTime + i * 0.22;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g).connect(c.destination);
      o.start(t);
      o.stop(t + 0.2);
    }
  } catch {
    /* Audio blockiert */
  }
}

/** Audio muss durch eine Nutzeraktion freigeschaltet werden (iOS). */
export function unlockAudio() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    /* ignore */
  }
}

export async function notify(title: string, body: string) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, icon: `${import.meta.env.BASE_URL}icons/icon-192.png`, tag: 'satzio-rest', silent: false });
    else new Notification(title, { body, icon: `${import.meta.env.BASE_URL}icons/icon-192.png` });
  } catch {
    /* nicht unterstützt */
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (isNative()) return requestNativeNotificationPermission();
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}
