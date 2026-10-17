import { GOAL_LABELS_DE, LEVEL_LABELS_DE, type Goal, type Level, type OnboardingInput, type UserView } from '@satzio/shared';
import { ClipboardPaste, FilePlus2, LayoutTemplate, Rocket } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ChoiceTile } from '@/components/ui/controls';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { createEmptyPlan } from './plans/plan-utils';

const DAYS: { value: number; label: string }[] = [
  { value: 2, label: '2 Tage' },
  { value: 3, label: '3 Tage' },
  { value: 4, label: '4 Tage' },
  { value: 5, label: '5 Tage' },
  { value: 6, label: '6 Tage' },
  { value: 0, label: 'Flexibel' },
];

export default function Onboarding() {
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<Goal | null>(user?.profile.goal ?? null);
  const [level, setLevel] = useState<Level | null>(user?.profile.level ?? null);
  const [days, setDays] = useState<number | null>(user?.profile.trainingDaysPerWeek ?? null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!goal || !level || days === null) return false;
    setBusy(true);
    try {
      const body: OnboardingInput = { goal, level, trainingDaysPerWeek: days };
      const u = await api<UserView>('/users/me/onboarding', { method: 'POST', body });
      setUser(u);
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const next = async () => {
    if (step === 2) {
      if (await save()) setStep(3);
    } else setStep((s) => s + 1);
  };

  const finish = async (choice: 'own' | 'template' | 'import' | 'none') => {
    if (choice === 'own') {
      setBusy(true);
      try {
        const plan = await createEmptyPlan('Mein Trainingsplan', true);
        navigate(`/plans/${plan.id}`, { replace: true });
      } catch (e) {
        toast.error(errorMessage(e));
      } finally {
        setBusy(false);
      }
    } else if (choice === 'template') navigate('/plans/templates?onboarding=1', { replace: true });
    else if (choice === 'import') navigate('/plans/import', { replace: true });
    else navigate('/', { replace: true });
  };

  const canNext = (step === 0 && goal) || (step === 1 && level) || (step === 2 && days !== null);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-safe pt-safe">
      <div className="flex h-14 items-center gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn('h-1.5 flex-1 rounded-full transition', i <= step ? 'bg-primary' : 'bg-surface-3')} />
        ))}
      </div>
      <p className="mt-4 text-sm text-muted">Schritt {step + 1} von 4</p>

      {step === 0 && (
        <Step title="Was möchtest du erreichen?">
          {(Object.keys(GOAL_LABELS_DE) as Goal[]).map((g) => (
            <ChoiceTile key={g} selected={goal === g} onClick={() => setGoal(g)} title={GOAL_LABELS_DE[g]} />
          ))}
        </Step>
      )}
      {step === 1 && (
        <Step title="Wie viel Erfahrung hast du?">
          {(Object.keys(LEVEL_LABELS_DE) as Level[]).map((l) => (
            <ChoiceTile
              key={l}
              selected={level === l}
              onClick={() => setLevel(l)}
              title={LEVEL_LABELS_DE[l]}
              description={l === 'beginner' ? 'Weniger als 1 Jahr Krafttraining' : l === 'intermediate' ? '1–3 Jahre regelmäßiges Training' : 'Mehr als 3 Jahre, solide Technik'}
            />
          ))}
        </Step>
      )}
      {step === 2 && (
        <Step title="Wie oft willst du trainieren?">
          <div className="grid grid-cols-3 gap-2" role="radiogroup">
            {DAYS.map((d) => (
              <button
                key={d.value}
                type="button"
                role="radio"
                aria-checked={days === d.value}
                onClick={() => setDays(d.value)}
                className={cn(
                  'h-16 rounded-2xl border text-base font-semibold transition',
                  days === d.value ? 'border-primary bg-primary/10 text-text' : 'border-border bg-surface text-muted',
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted">Pro Woche. Du kannst das jederzeit im Profil ändern.</p>
        </Step>
      )}
      {step === 3 && (
        <Step title="Wie möchtest du starten?">
          <ChoiceTile selected={false} onClick={() => void finish('template')} icon={<LayoutTemplate />} title="Vorlage auswählen" description="Bewährte Pläne – passend zu deinem Ziel" />
          <ChoiceTile selected={false} onClick={() => void finish('own')} icon={<FilePlus2 />} title="Eigenen Plan erstellen" description="Tage und Übungen selbst festlegen" />
          <ChoiceTile selected={false} onClick={() => void finish('import')} icon={<ClipboardPaste />} title="Meine Notizen importieren" description="Text aus Apple Notes, Google Keep & Co. einfügen" />
          <ChoiceTile selected={false} onClick={() => void finish('none')} icon={<Rocket />} title="Erst einmal ohne Plan starten" description="Direkt frei trainieren" />
        </Step>
      )}

      <div className="mt-auto flex gap-3 pb-8 pt-6">
        {step > 0 && step < 3 && (
          <Button variant="secondary" size="lg" onClick={() => setStep((s) => s - 1)}>
            Zurück
          </Button>
        )}
        {step < 3 && (
          <Button size="lg" block disabled={!canNext} loading={busy} onClick={() => void next()}>
            Weiter
          </Button>
        )}
      </div>
    </div>
  );
}

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-2">
      <h1 className="mb-5 text-[28px] font-extrabold leading-tight tracking-tight">{title}</h1>
      <div className="space-y-2.5" role="radiogroup" aria-label={title}>
        {children}
      </div>
    </div>
  );
}
