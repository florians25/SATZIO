import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { cn } from '@/lib/cn';
import { SyncIndicator } from './SyncIndicator';

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
  return (
    <header className={cn('sticky top-0 z-30 bg-bg/90 pt-safe backdrop-blur-xl', className)}>
      <div className="flex min-h-14 items-center gap-2 px-3">
        {back && (
          <button
            type="button"
            onClick={() => (back === true ? navigate(-1) : navigate(back))}
            className="-ml-1 grid h-11 w-11 place-items-center rounded-full text-text hover:bg-surface-2"
            aria-label="Zurück"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        <div className={cn('min-w-0 flex-1', !back && 'pl-1')}>
          {!large && <h1 className="truncate text-lg font-bold">{title}</h1>}
          {!large && subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
        <SyncIndicator />
        {right}
      </div>
      {large && (
        <div className="px-4 pb-3">
          <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
      )}
    </header>
  );
}
