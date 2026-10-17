import { parseWorkoutNotes, toKg, type ExerciseListItem, type ParsedExercise, type ParsedSet, type PlanView } from '@satzio/shared';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeftRight, Check, Plus, Replace, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ExercisePicker } from '@/components/ExercisePicker';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/controls';
import { Input, Label, Textarea } from '@/components/ui/input';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { uuid } from '@/lib/ids';
import { qk, useExerciseList } from '@/lib/queries';
import { NumberField } from '../workout/NumberField';
import { fromKgDisplay } from '../workout/units';

const EXAMPLE = `Montag Push
Bankdrücken
60x12
70x10
75x8
Schrägbank
24x12
26x10
26x8
Seitheben
10x15
10x15
12x12`;

interface EditExercise {
  key: string;
  rawName: string;
  exercise: ExerciseListItem | null;
  sets: ParsedSet[];
  warnings: string[];
  notes: string | null;
}
interface EditDay {
  key: string;
  name: string;
  exercises: EditExercise[];
}

export default function NotesImportPage() {
  const [text, setText] = useState('');
  const [days, setDays] = useState<EditDay[] | null>(null);
  const [unparsed, setUnparsed] = useState<{ line: number; text: string }[]>([]);
  const [planName, setPlanName] = useState('Importierter Plan');
  const [activate, setActivate] = useState(true);
  const [picker, setPicker] = useState<{ day: string; ex: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const { data: library = [] } = useExerciseList();
  const user = useAuth((s) => s.user)!;
  const unit = user.settings.unit;
  const navigate = useNavigate();
  const qc = useQueryClient();

  const analyze = () => {
    const r = parseWorkoutNotes(text, library, { defaultUnit: unit });
    setUnparsed(r.unparsedLines);
    setDays(
      r.days
        .filter((d) => d.exercises.length)
        .map((d, i) => ({
          key: uuid(),
          name: d.name ?? `Tag ${i + 1}`,
          exercises: d.exercises.map((e: ParsedExercise<ExerciseListItem>) => ({
            key: uuid(),
            rawName: e.rawName,
            exercise: e.match?.exercise ?? null,
            sets: e.sets,
            warnings: e.warnings.filter((w) => !w.includes('eigene Übung')),
            notes: e.notes,
          })),
        })),
    );
    if (r.days.length === 1 && r.days[0].name) setPlanName(r.days[0].name);
  };

  const count = useMemo(() => days?.reduce((s, d) => s + d.exercises.length, 0) ?? 0, [days]);

  const patchEx = (dayKey: string, exKey: string, fn: (e: EditExercise) => EditExercise | null) =>
    setDays((ds) =>
      ds!.map((d) =>
        d.key !== dayKey ? d : { ...d, exercises: d.exercises.map((e) => (e.key === exKey ? fn(e) : e)).filter((e): e is EditExercise => e !== null) },
      ),
    );

  const save = async () => {
    if (!days) return;
    setBusy(true);
    try {
      // Unbekannte Übungen als eigene Übungen anlegen
      const created = new Map<string, string>();
      for (const d of days) {
        for (const e of d.exercises) {
          if (e.exercise || created.has(e.rawName.toLowerCase())) continue;
          const ex = await api<{ id: string }>('/exercises', { method: 'POST', body: { nameDe: e.rawName.slice(0, 100), primaryMuscle: 'full_body', equipment: 'other' } });
          created.set(e.rawName.toLowerCase(), ex.id);
        }
      }
      const plan = await api<PlanView>('/plans', {
        method: 'POST',
        body: {
          name: planName.trim() || 'Importierter Plan',
          description: `Importiert aus Notizen. Original:\n\n${text}`.slice(0, 4000),
          scheduleMode: 'flexible',
          activate,
          changeNote: 'Aus Notizen importiert',
          days: days.map((d) => ({
            id: uuid(),
            name: d.name.slice(0, 80) || 'Tag',
            weekday: null,
            notes: null,
            exercises: d.exercises.map((e) => ({
              id: uuid(),
              exerciseId: e.exercise?.id ?? created.get(e.rawName.toLowerCase())!,
              restSeconds: null,
              notes: e.notes,
              supersetGroup: null,
              weightStepKg: null,
              sets: (e.sets.length ? e.sets : [{ type: 'working', weightKg: null, reps: null, repsMax: null } as ParsedSet]).map((s) => ({
                id: uuid(),
                type: s.type,
                repsMin: s.reps,
                repsMax: s.repsMax ?? s.reps,
                targetWeightKg: s.weightKg,
              })),
            })),
          })),
        },
      });
      await Promise.all([qc.invalidateQueries({ queryKey: ['plans'] }), qc.invalidateQueries({ queryKey: qk.today }), qc.invalidateQueries({ queryKey: qk.exercises })]);
      toast.success('Plan gespeichert');
      navigate(`/plans/${plan.id}`, { replace: true });
    } catch (e) {
      toast.error(errorMessage(e, 'Import fehlgeschlagen. Für den Import wird eine Verbindung benötigt.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Trainingsnotizen importieren" back />
      <div className="space-y-4 px-4 pb-10">
        {!days && (
          <>
            <p className="text-sm text-muted">Kopiere deine Notizen aus Apple Notes, Google Keep oder einer anderen App hierher. SATZIO erkennt Trainingstage, Übungen, Gewichte und Wiederholungen – lokal, ohne KI-Cloud.</p>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={EXAMPLE} className="min-h-72 font-mono text-[15px]" aria-label="Trainingsnotizen" />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setText(EXAMPLE)}>
                Beispiel einfügen
              </Button>
              <Button disabled={!text.trim()} onClick={analyze}>
                Erkennen
              </Button>
            </div>
          </>
        )}

        {days && (
          <>
            <Card className="space-y-3 p-4">
              <div>
                <Label htmlFor="pn">Name des Plans</Label>
                <Input id="pn" value={planName} onChange={(e) => setPlanName(e.target.value)} />
              </div>
              <label className="flex items-center justify-between text-sm">
                Als aktiven Plan verwenden
                <Switch checked={activate} onCheckedChange={setActivate} />
              </label>
            </Card>
            {days.length === 0 && <Card className="p-4 text-sm text-muted">Es wurden keine Übungen erkannt. Prüfe den Text und versuche es erneut.</Card>}
            {days.map((d) => (
              <section key={d.key} className="space-y-2">
                <Input value={d.name} onChange={(e) => setDays((ds) => ds!.map((x) => (x.key === d.key ? { ...x, name: e.target.value } : x)))} className="font-bold" aria-label="Trainingstag" />
                {d.exercises.map((e) => (
                  <Card key={e.key} className="p-3">
                    <div className="flex items-start gap-2">
                      {e.exercise ? <Check className="mt-0.5 h-5 w-5 shrink-0 text-success" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{e.exercise ? e.exercise.nameDe : e.rawName}</p>
                        <p className="text-xs text-muted">{e.exercise ? (e.exercise.nameDe !== e.rawName ? `Erkannt aus „${e.rawName}“` : 'Erkannt') : 'Unbekannt – wird als eigene Übung angelegt'}</p>
                      </div>
                      <Button size="icon-sm" variant="ghost" onClick={() => setPicker({ day: d.key, ex: e.key })} aria-label="Übung zuordnen">
                        <Replace className="h-4 w-4" />
                      </Button>
                      <Button size="icon-sm" variant="ghost" onClick={() => patchEx(d.key, e.key, () => null)} aria-label="Übung entfernen">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-2 space-y-1">
                      {e.sets.map((s, i) => (
                        <div key={i} className={cn('flex items-center gap-1 rounded-xl px-1', s.uncertain && 'bg-warning/10')}>
                          <span className="w-6 text-center text-xs text-muted">{i + 1}</span>
                          <NumberField
                            value={s.weightKg === null ? null : fromKgDisplay(s.weightKg, unit)}
                            onCommit={(v) => patchEx(d.key, e.key, (x) => ({ ...x, sets: x.sets.map((y, j) => (j === i ? { ...y, weightKg: v === null ? null : toKg(v, unit), uncertain: false } : y)) }))}
                            ariaLabel="Gewicht"
                            className="w-20 text-lg"
                          />
                          <span className="text-sm text-muted">{unit} ×</span>
                          <NumberField
                            value={s.reps}
                            decimals={false}
                            onCommit={(v) => patchEx(d.key, e.key, (x) => ({ ...x, sets: x.sets.map((y, j) => (j === i ? { ...y, reps: v, uncertain: false } : y)) }))}
                            ariaLabel="Wiederholungen"
                            className="w-14 text-lg"
                          />
                          <span className="flex-1" />
                          <button type="button" onClick={() => patchEx(d.key, e.key, (x) => ({ ...x, sets: x.sets.filter((_, j) => j !== i) }))} className="grid h-10 w-10 place-items-center text-muted" aria-label="Satz entfernen">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Button size="sm" variant="ghost" onClick={() => patchEx(d.key, e.key, (x) => ({ ...x, sets: [...x.sets, { ...(x.sets[x.sets.length - 1] ?? { type: 'working', weightKg: null, reps: null, repsMax: null, completed: null }), uncertain: false }] }))}>
                        <Plus className="h-4 w-4" /> Satz
                      </Button>
                      {e.sets.some((s) => s.weightKg !== null && s.reps !== null) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            patchEx(d.key, e.key, (x) => ({
                              ...x,
                              warnings: [],
                              sets: x.sets.map((y) => ({ ...y, weightKg: y.reps === null ? null : toKg(y.reps, unit), reps: y.weightKg === null ? null : Math.round(fromKgDisplay(y.weightKg, unit)), uncertain: false })),
                            }))
                          }
                        >
                          <ArrowLeftRight className="h-4 w-4" /> Gewicht/Wdh. tauschen
                        </Button>
                      )}
                    </div>
                    {e.warnings.map((w) => (
                      <p key={w} className="mt-1 text-xs text-warning">
                        {w}
                      </p>
                    ))}
                  </Card>
                ))}
              </section>
            ))}
            {unparsed.length > 0 && (
              <Card className="p-4 text-sm">
                <p className="font-semibold">Nicht zugeordnete Zeilen</p>
                <ul className="mt-1 font-mono text-muted">
                  {unparsed.map((u) => (
                    <li key={u.line}>
                      Zeile {u.line + 1}: {u.text}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted">Der vollständige Originaltext wird in der Planbeschreibung gespeichert.</p>
              </Card>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setDays(null)}>
                Text bearbeiten
              </Button>
              <Button disabled={!count} loading={busy} onClick={() => void save()}>
                Als Plan speichern
              </Button>
            </div>
          </>
        )}
      </div>
      <ExercisePicker
        open={!!picker}
        onOpenChange={(o) => !o && setPicker(null)}
        title="Übung zuordnen"
        onSelect={(ex) => {
          if (picker) patchEx(picker.day, picker.ex, (x) => ({ ...x, exercise: ex }));
          setPicker(null);
        }}
      />
    </div>
  );
}
