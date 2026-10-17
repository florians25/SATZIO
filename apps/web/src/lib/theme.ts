import { useEffect } from 'react';
import { useAuth } from './auth';
import { setStatusBarTheme } from './native';

/** Wendet Dark/Light/System an und merkt sich die Wahl für den nächsten Start. */
export function useThemeSync() {
  const theme = useAuth((s) => s.user?.settings.theme ?? 'dark');
  useEffect(() => {
    const apply = () => {
      const resolved = theme === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : theme;
      document.documentElement.dataset.theme = resolved;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'light' ? '#F4F6F4' : '#0B0F0E');
      setStatusBarTheme(resolved);
    };
    apply();
    try {
      localStorage.setItem('satzio-theme', theme);
    } catch {
      /* ignore */
    }
    if (theme !== 'system') return;
    const mq = matchMedia('(prefers-color-scheme: light)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}
