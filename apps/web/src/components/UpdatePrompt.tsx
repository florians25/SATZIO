import { useEffect, useState } from 'react';
import { Button } from './ui/button';

/**
 * Service-Worker-Updates werden NICHT automatisch eingespielt, damit ein
 * laufendes Training nicht durch einen Reload unterbrochen wird.
 */
export function UpdatePrompt() {
  const [update, setUpdate] = useState<null | (() => void)>(null);
  useEffect(() => {
    if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
    let cancelled = false;
    void import('virtual:pwa-register').then(({ registerSW }) => {
      const updateSW = registerSW({
        onNeedRefresh() {
          if (!cancelled) setUpdate(() => () => void updateSW(true));
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);
  if (!update) return null;
  return (
    <div className="fixed inset-x-3 top-3 z-[70] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-float pt-safe">
      <p className="flex-1 text-sm">Eine neue Version von SATZIO ist verfügbar.</p>
      <Button size="sm" onClick={update}>
        Aktualisieren
      </Button>
    </div>
  );
}
