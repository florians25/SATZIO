import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';

export function AuthLayout({ title, subtitle, children, back = true }: { title: string; subtitle?: string; children: ReactNode; back?: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-safe pt-safe">
      <div className="flex h-14 items-center">
        {back && (
          <button type="button" onClick={() => navigate(-1)} className="-ml-2 grid h-11 w-11 place-items-center rounded-full hover:bg-surface-2" aria-label="Zurück">
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
      </div>
      <div className="mb-6 mt-2">
        <div className="mb-3 text-sm font-black tracking-[0.25em] text-primary">SATZIO</div>
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
      </div>
      <div className="flex-1 pb-8">{children}</div>
    </div>
  );
}
