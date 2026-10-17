import { Check } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { useMeta } from '@/lib/queries';

export default function Welcome() {
  const meta = useMeta();
  const registrationEnabled = meta.data?.registrationEnabled ?? true;
  return (
    <div className="relative mx-auto flex min-h-dvh max-w-md flex-col overflow-hidden px-6 pb-safe pt-safe">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl" aria-hidden />
      <div className="flex flex-1 flex-col justify-center">
        <div className="text-5xl font-black tracking-[0.18em] text-primary">SATZIO</div>
        <p className="mt-4 text-2xl font-bold leading-snug">Dein nächstes Level beginnt hier.</p>
        <p className="mt-2 text-muted">Trainieren. Abhaken. Stärker werden.</p>
        <div className="mt-10 rounded-3xl border border-border bg-surface p-5" aria-hidden>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-muted">Push Day</p>
          <p className="mb-2 font-semibold">Bankdrücken</p>
          {[
            ['60 kg × 12', true],
            ['70 kg × 10', true],
            ['75 kg × 8', false],
          ].map(([t, done]) => (
            <div key={t as string} className="flex items-center gap-3 py-1.5">
              <span className={`grid h-6 w-6 place-items-center rounded-lg ${done ? 'bg-primary text-primary-fg' : 'border-2 border-border'}`}>
                {done && <Check className="h-4 w-4" strokeWidth={3} />}
              </span>
              <span className="text-lg font-semibold tabular">{t as string}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3 pb-8 pt-6">
        {registrationEnabled ? (
          <Button asChild size="lg" block>
            <Link to="/register">Kostenlos registrieren</Link>
          </Button>
        ) : (
          <p className="rounded-2xl bg-surface-2 p-3 text-center text-sm text-muted">Die Registrierung ist auf diesem Server derzeit deaktiviert.</p>
        )}
        <Button asChild size="lg" variant="secondary" block>
          <Link to="/login">Anmelden</Link>
        </Button>
      </div>
    </div>
  );
}
