import { PREFILL_SOURCE_LABELS_DE, SET_TYPE_LABELS_DE, SET_TYPES, type SetType } from '@satzio/shared';
import { Copy, RotateCcw, Trash2 } from 'lucide-react';
import { Segmented } from '@/components/ui/controls';
import { Sheet, SheetAction } from '@/components/ui/sheet';
import { useWorkout } from '@/lib/workout';

export function SetSheet({ target, onClose }: { target: { exId: string; setId: string } | null; onClose: () => void }) {
  const set = useWorkout((s) => (target ? s.session?.exercises.find((e) => e.id === target.exId)?.sets.find((x) => x.id === target.setId) : undefined));
  const index = useWorkout((s) => (target ? (s.session?.exercises.find((e) => e.id === target.exId)?.sets.findIndex((x) => x.id === target.setId) ?? -1) : -1));
  const { updateSet, duplicateSet, deleteSet } = useWorkout.getState();
  const open = !!target && !!set;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={`Satz ${index + 1}`}>
      {set && target && (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-muted">Satzart</p>
            <Segmented
              size="sm"
              ariaLabel="Satzart"
              value={set.type}
              onChange={(v: SetType) => updateSet(target.exId, target.setId, { type: v })}
              options={SET_TYPES.map((t) => ({ value: t, label: SET_TYPE_LABELS_DE[t].replace('Bis Muskelversagen', 'Versagen').replace('satz', '') }))}
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-muted">Anstrengung (RPE, optional)</p>
            <div className="grid grid-cols-6 gap-1.5">
              {[null, 6, 7, 8, 9, 10].map((r) => (
                <button
                  key={String(r)}
                  type="button"
                  onClick={() => updateSet(target.exId, target.setId, { rpe: r })}
                  className={`h-10 rounded-xl border text-sm font-semibold ${set.rpe === r ? 'border-primary bg-primary text-primary-fg' : 'border-border bg-surface-2'}`}
                >
                  {r ?? '–'}
                </button>
              ))}
            </div>
          </div>
          {(set.weightSource !== 'manual' || set.repsSource !== 'manual') && (
            <p className="rounded-xl bg-surface-2 p-3 text-xs text-muted">
              Gewicht: {PREFILL_SOURCE_LABELS_DE[set.weightSource]} · Wiederholungen: {PREFILL_SOURCE_LABELS_DE[set.repsSource]}
            </p>
          )}
          <div>
            <SheetAction icon={<Copy />} onClick={() => { duplicateSet(target.exId, target.setId); onClose(); }}>
              Satz duplizieren
            </SheetAction>
            <SheetAction
              icon={<RotateCcw />}
              disabled={!set.completed}
              onClick={() => {
                updateSet(target.exId, target.setId, { completed: false, completedAt: null });
                onClose();
              }}
            >
              Satz zurücksetzen (nicht erledigt)
            </SheetAction>
            <SheetAction icon={<Trash2 />} tone="danger" onClick={() => { deleteSet(target.exId, target.setId); onClose(); }}>
              Satz löschen
            </SheetAction>
          </div>
        </div>
      )}
    </Sheet>
  );
}
