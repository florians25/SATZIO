/**
 * Start der nativen Integration (nur in der Capacitor-App, im Browser ein No-op):
 * Statusleiste, Android-Zurück-Taste, iOS-Tastatur und „Display bleibt an“
 * während eines laufenden Trainings.
 */
import { configureKeyboard, keepAwake, registerBackButton, setStatusBarTheme } from './native';
import { isNative } from './platform';

let started = false;

export async function initNative() {
  if (started || !isNative()) return;
  started = true;
  document.documentElement.dataset.native = 'true';

  const theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  setStatusBarTheme(theme);
  configureKeyboard();
  void registerBackButton();

  try {
    // Lazy, damit der Workout-Store nicht vorgezogen wird
    const { useWorkout } = await import('./workout');
    const sync = () => keepAwake(useWorkout.getState().session?.status === 'active');
    sync();
    useWorkout.subscribe(sync);
  } catch {
    /* ignore */
  }
}
