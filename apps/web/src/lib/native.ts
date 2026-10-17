/**
 * NATIVE GERÄTEFUNKTIONEN (Capacitor)
 * Alles wird lazy importiert → das Web-Bundle bleibt klein, und im Browser
 * passiert schlicht nichts (graceful no-op). Fehler werden nie nach außen geworfen.
 */
import { isNative, platform } from './platform';

type ImpactStyle = 'light' | 'medium' | 'heavy';

const REST_NOTIFICATION_ID = 4711;
const REST_CHANNEL_ID = 'satzio-rest';

async function safe<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch {
    return undefined;
  }
}

/* ───────────────────────────── Haptik ───────────────────────────── */

export function hapticImpact(style: ImpactStyle = 'light') {
  if (!isNative()) return;
  void safe(async () => {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy } as const;
    await Haptics.impact({ style: map[style] });
  });
}

export function hapticSuccess() {
  if (!isNative()) return;
  void safe(async () => {
    const { Haptics, NotificationType } = await import('@capacitor/haptics');
    await Haptics.notification({ type: NotificationType.Success });
  });
}

export function hapticSelection() {
  if (!isNative()) return;
  void safe(async () => {
    const { Haptics } = await import('@capacitor/haptics');
    await Haptics.selectionStart();
    await Haptics.selectionChanged();
    await Haptics.selectionEnd();
  });
}

/* ───────────────────── Pausen-Benachrichtigung ───────────────────── */

let permission: Promise<boolean> | null = null;
let channelReady = false;

/** Fragt beim ersten Pausentimer einmalig nach der Benachrichtigungs-Erlaubnis. */
function ensureNotificationPermission(): Promise<boolean> {
  permission ??= (async () => {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    let st = await LocalNotifications.checkPermissions();
    if (st.display === 'prompt' || st.display === 'prompt-with-rationale') st = await LocalNotifications.requestPermissions();
    if (platform === 'android' && !channelReady) {
      await LocalNotifications.createChannel({
        id: REST_CHANNEL_ID,
        name: 'Pausentimer',
        description: 'Meldet, wenn die Satzpause vorbei ist',
        importance: 5,
        visibility: 1,
        vibration: true,
      });
      channelReady = true;
    }
    return st.display === 'granted';
  })().catch(() => {
    permission = null;
    return false;
  });
  return permission;
}

export async function requestNativeNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNative()) return 'unsupported';
  return (await ensureNotificationPermission()) ? 'granted' : 'denied';
}

/**
 * Plant eine lokale Benachrichtigung zur absoluten Endzeit der Pause.
 * Das Betriebssystem stellt sie zu – auch wenn die App im Hintergrund oder das Gerät gesperrt ist.
 */
export async function scheduleRestNotification(endsAt: number, label?: string | null): Promise<boolean> {
  if (!isNative()) return false;
  const ok = await safe(async () => {
    if (!(await ensureNotificationPermission())) return false;
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] }).catch(() => undefined);
    if (endsAt <= Date.now() + 500) return false;
    await LocalNotifications.schedule({
      notifications: [
        {
          id: REST_NOTIFICATION_ID,
          title: 'Pause vorbei',
          body: label ? `Weiter mit ${label}` : 'Weiter geht’s mit dem nächsten Satz.',
          schedule: { at: new Date(endsAt), allowWhileIdle: true },
          channelId: REST_CHANNEL_ID,
          smallIcon: 'ic_stat_satzio',
          iconColor: '#B7FF3C',
          autoCancel: true,
        },
      ],
    });
    return true;
  });
  return ok ?? false;
}

export async function cancelRestNotification() {
  if (!isNative()) return;
  await safe(async () => {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] });
  });
}

/* ───────────────────────────── Display an ───────────────────────────── */

let awake = false;
export function keepAwake(on: boolean) {
  if (!isNative() || on === awake) return;
  awake = on;
  void safe(async () => {
    const { KeepAwake } = await import('@capacitor-community/keep-awake');
    if (on) await KeepAwake.keepAwake();
    else await KeepAwake.allowSleep();
  });
}

/* ───────────────────────────── Statusleiste ───────────────────────────── */

export function setStatusBarTheme(theme: 'light' | 'dark') {
  if (!isNative()) return;
  void safe(async () => {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    // Style.Dark = helle Schrift (für dunklen Hintergrund)
    await StatusBar.setStyle({ style: theme === 'dark' ? Style.Dark : Style.Light });
    if (platform === 'android') {
      await StatusBar.setBackgroundColor({ color: theme === 'dark' ? '#0B0F0E' : '#F4F6F4' });
    }
  });
}

/* ───────────────────── Zurück-Taste & Tastatur ───────────────────── */

/** Android-Zurück-Taste: im Verlauf zurück, an der Wurzel App minimieren. Liefert Aufräumfunktion. */
export async function registerBackButton(): Promise<() => void> {
  if (!isNative() || platform !== 'android') return () => undefined;
  const handle = await safe(async () => {
    const { App } = await import('@capacitor/app');
    return App.addListener('backButton', ({ canGoBack }) => {
      // Offene Dialoge/Sheets (Radix) schließen zuerst
      const dialog = document.querySelector('[role="dialog"][data-state="open"]');
      if (dialog) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return;
      }
      const atRoot = window.location.pathname === '/' || window.location.pathname === '';
      if (canGoBack && !atRoot && window.history.length > 1) window.history.back();
      else void App.minimizeApp();
    });
  });
  return () => void handle?.remove();
}

export function configureKeyboard() {
  if (!isNative() || platform !== 'ios') return;
  void safe(async () => {
    const { Keyboard, KeyboardResize } = await import('@capacitor/keyboard');
    await Keyboard.setResizeMode({ mode: KeyboardResize.Native });
    await Keyboard.setAccessoryBarVisible({ isVisible: false });
  });
}
