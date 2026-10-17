import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { cn } from '@/lib/cn';
import { useWorkout } from '@/lib/workout';

export function FinishSheet({ open, onOpenChange, onFinished }: { open: boolean; onOpenChange: (o: boolean) => void; onFinished: () => void }) {
  const session = useWorkout((s) => s.session);
  const finish = useWorkout((s) => s.finish);
  const [rpe, setRpe] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  if (!session) return null;
  const sets = session.exercises.flatMap((e) => e.sets);
  const done = sets.filter((s) => s.completed).length;
  const open_ = sets.length - done;
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Training abschließen?" description={`${done} von ${sets.length} Sätzen erledigt`}>
      <div className="space-y-4">
        {open_ > 0 && (
          <p className="rounded-xl bg-surface-2 p-3 text-sm text-muted">
            {open_} {open_ === 1 ? 'offener Satz wird' : 'offene Sätze werden'} gespeichert, aber nicht in Volumen und Rekorde eingerechnet.
          </p>
        )}
        <div>
          <p className="mb-2 text-sm font-medium text-muted">Wie anstrengend war es? (optional)</p>
          <div className="grid grid-cols-5 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setRpe(rpe === v ? null : v)}
                className={cn('h-11 rounded-xl border text-sm font-bold', rpe === v ? 'border-primary bg-primary text-primary-fg' : 'border-border bg-surface-2')}
              >
                {v}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">1 = sehr leicht · 10 = maximal</p>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-muted">Notiz (optional)</p>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Wie lief’s?" className="min-h-20" />
        </div>
        <Button
          size="lg"
          block
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await finish({ perceivedExertion: rpe, notes: notes.trim() || session.notes });
            setBusy(false);
            onOpenChange(false);
            onFinished();
          }}
        >
          Abschließen
        </Button>
      </div>
    </Sheet>
  );
}
