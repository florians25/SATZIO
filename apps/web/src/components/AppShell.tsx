import { BarChart3, CalendarCheck, Dumbbell, ListChecks, Timer, User } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { useCoach } from '@/lib/coach';
import { fmtClock } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { setTimerPrefs, useTimer, useTimerAlarm, useTimerRemaining } from '@/lib/timer';
import { useActiveWorkouts } from '@/lib/workout';
import { UpdatePrompt } from './UpdatePrompt';

export function AppShell() {
  const t = useT();
  const location = useLocation();
  const active = useActiveWorkouts();
  const settings = useAuth((s) => s.user?.settings);
  const inWorkout = location.pathname.startsWith('/workout/');
  useTimerAlarm();

  useEffect(() => {
    if (settings) {
      setTimerPrefs({ sound: settings.soundEnabled, vibration: settings.vibrationEnabled, notifications: settings.notificationsEnabled });
    }
  }, [settings]);

  const items = [
    { to: '/', label: t.nav.today, icon: CalendarCheck, end: true },
    { to: '/plans', label: t.nav.plans, icon: ListChecks },
    { to: '/exercises', label: t.nav.exercises, icon: Dumbbell },
    { to: '/progress', label: t.nav.progress, icon: BarChart3 },
    { to: '/profile', label: t.nav.profile, icon: User },
  ];
  const current = active[0];

  return (
    <div className="mx-auto min-h-dvh max-w-2xl">
      <CoachToast />
      <main className={cn('pb-nav', inWorkout && 'pb-safe')}>
        <Outlet />
      </main>
      {!inWorkout && (
        <div className="fixed inset-x-0 bottom-0 z-40">
          <div className="mx-auto max-w-2xl px-3">
            <RestTimerPill />
            {current && (
              <Link
                to={`/workout/${current.id}`}
                className="mb-2 flex h-12 items-center gap-3 rounded-2xl bg-primary px-4 font-semibold text-primary-fg shadow-float active:scale-[0.99]"
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-fg/50" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary-fg" />
                </span>
                <span className="flex-1 truncate">
                  {current.status === 'paused' ? 'Pausiert' : 'Training läuft'} · {current.name}
                </span>
                <span className="text-sm">Weiter →</span>
              </Link>
            )}
          </div>
          <nav className="border-t border-border bg-bg/90 pb-safe backdrop-blur-xl" aria-label="Hauptnavigation">
            <ul className="mx-auto flex max-w-2xl">
              {items.map(({ to, label, icon: Icon, end }) => (
                <li key={to} className="flex-1">
                  <NavLink
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      cn(
                        'flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition',
                        isActive ? 'text-primary' : 'text-muted hover:text-text',
                      )
                    }
                  >
                    <Icon className="h-6 w-6" strokeWidth={2} aria-hidden />
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
      <UpdatePrompt />
    </div>
  );
}

/** Kompakter Pausentimer außerhalb des Trainingsbildschirms. */
function RestTimerPill() {
  const remaining = useTimerRemaining();
  const skip = useTimer((s) => s.skip);
  if (remaining === null) return null;
  return (
    <div className="mb-2 flex h-11 items-center gap-2 rounded-2xl border border-border bg-surface px-3 shadow-float">
      <Timer className="h-4 w-4 text-primary" />
      <span className="flex-1 text-sm font-semibold tabular">Pause {fmtClock(remaining)}</span>
      <button className="h-9 rounded-xl px-3 text-sm text-muted hover:bg-surface-2" onClick={skip}>
        Überspringen
      </button>
    </div>
  );
}

function CoachToast() {
  const current = useCoach((s) => s.current);
  const clear = useCoach((s) => s.clear);
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center pt-safe" aria-live="polite">
      <AnimatePresence>
        {current && (
          <motion.button
            key={current.id}
            type="button"
            onClick={clear}
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 8, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className={cn(
              'pointer-events-auto mx-4 max-w-sm rounded-full border px-4 py-2 text-sm font-semibold shadow-float backdrop-blur',
              current.tone === 'highlight'
                ? 'border-primary bg-primary text-primary-fg'
                : current.tone === 'success'
                  ? 'border-success/40 bg-surface/95 text-success'
                  : 'border-border bg-surface/95 text-text',
            )}
          >
            {current.text}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
