import { ArrowLeft, ChevronLeft } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { cn } from '@/lib/cn';
import { platform } from '@/lib/platform';
import { SyncIndicator } from './SyncIndicator';

/** Mobile Plattformen: großer Titel scrollt mit, die Leiste bekommt beim Scrollen Glas (iOS) bzw. Tonfläche (Android). */
const collapsing = platform !== 'web';

function useScrolled(enabled: boolean) {
  const [scrolled, setScrolled] = useState(() => enabled && typeof window !== 'undefined' && window.scrollY > 4);
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setScrolled(window.scrollY > 4));
    };
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', on);
    };
  }, [enabled]);
  return scrolled;
}

export function PageHeader({
  title,
  subtitle,
  back,
  right,
  large = false,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: string | true;
  right?: ReactNode;
  large?: boolean;
  className?: string;
}) {
  const navigate = useNavigate();
  const scrolled = useScrolled(collapsing);
  const BackIcon = platform === 'android' ? ArrowLeft : ChevronLeft;
  const largeOutside = large && collapsing;
  return (
    <>
      <header
        data-ui="header"
        data-large={large ? 'true' : undefined}
        data-back={back ? 'true' : undefined}
        data-scrolled={scrolled ? 'true' : undefined}
        className={cn('sticky top-0 z-30 bg-bg/90 pt-safe backdrop-blur-xl', className)}
      >
        <div data-ui="header-bar" className="relative flex min-h-14 items-center gap-2 px-3">
          {back && (
            <button
              type="button"
              data-ui="header-back"
              onClick={() => (back === true ? navigate(-1) : navigate(back))}
              className="-ml-1 grid h-11 w-11 place-items-center rounded-full text-text hover:bg-surface-2"
              aria-label="Zurück"
            >
              <BackIcon className="h-6 w-6" />
            </button>
          )}
          <div data-ui="header-title" className={cn('min-w-0 flex-1', !back && 'pl-1')}>
            {!large && <h1 className="truncate text-lg font-bold">{title}</h1>}
            {!large && subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
            {largeOutside && (
              <p data-ui="header-collapsed-title" className="truncate text-lg font-bold" aria-hidden>
                {title}
              </p>
            )}
          </div>
          <div data-ui="header-actions" className="contents">
            <SyncIndicator />
            {right}
          </div>
        </div>
        {large && !largeOutside && (
          <div className="px-4 pb-3">
            <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">{title}</h1>
            {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
          </div>
        )}
      </header>
      {largeOutside && (
        <div data-ui="large-title" className="px-4 pb-3">
          <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
      )}
    </>
  );
}
