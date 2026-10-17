import { CloudOff, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { db, type ConflictEntry, type OutboxOp } from '@/lib/db';
import { fmtTime } from '@/lib/format';
import { discardFailed, flush, resolveKeepLocal, resolveTakeServer, retryFailed, useSyncState } from '@/lib/sync';
import { Button } from './ui/button';
import { Sheet } from './ui/sheet';

const TYPE_LABEL: Record<string, string> = {
  'session.create': 'Training angelegt',
  'session.update': 'Training geändert',
  'session.finish': 'Training abgeschlossen',
  'session.delete': 'Training gelöscht',
  'exercise.add': 'Übung hinzugefügt',
  'exercise.update': 'Übung geändert',
  'exercise.replace': 'Übung ersetzt',
  'exercise.delete': 'Übung entfernt',
  'exercise.reorder': 'Reihenfolge geändert',
  'set.add': 'Satz hinzugefügt',
  'set.update': 'Satz geändert',
  'set.delete': 'Satz gelöscht',
};

function describeEntity(entity: unknown): string {
  const e = entity as { weightKg?: number | null; reps?: number | null; name?: string; completed?: boolean } | null;
  if (!e) return '–';
  if ('weightKg' in e || 'reps' in e) return `${e.weightKg ?? '–'} kg × ${e.reps ?? '–'}${e.completed ? ' ✓' : ''}`;
  return e.name ?? 'Eintrag';
}

function describeLocal(op: OutboxOp | undefined): string {
  if (!op) return '–';
  const p = op.payload as { patch?: Record<string, unknown> };
  if (p.patch) return Object.entries(p.patch).map(([k, v]) => `${k === 'weightKg' ? 'Gewicht' : k === 'reps' ? 'Wdh.' : k === 'completed' ? 'erledigt' : k}: ${String(v)}`).join(', ');
  return TYPE_LABEL[op.type] ?? op.type;
}

export function SyncSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const state = useSyncState();
  const [ops, setOps] = useState<OutboxOp[]>([]);
  const [conflicts, setConflicts] = useState<ConflictEntry[]>([]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const load = async () => {
      const [o, c] = await Promise.all([db.outbox.orderBy('seq').toArray(), db.conflicts.toArray()]);
      if (alive) {
        setOps(o);
        setConflicts(c);
      }
    };
    void load();
    const t = setInterval(load, 1000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [open]);

  const failed = ops.filter((o) => o.status === 'failed');
  const pending = ops.filter((o) => o.status === 'pending');

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Synchronisation" description={state.online ? 'Verbunden' : 'Keine Verbindung – Änderungen sind lokal gespeichert.'}>
      <div className="space-y-4">
        {!state.online && (
          <div className="flex gap-3 rounded-2xl bg-surface-2 p-3 text-sm">
            <CloudOff className="mt-0.5 h-5 w-5 shrink-0 text-muted" />
            <p>
              Deine Änderungen sind auf diesem Gerät gespeichert und werden automatisch übertragen, sobald wieder eine Verbindung besteht.
              <span className="mt-1 block text-muted">Wichtig: Browserdaten nicht löschen, solange noch Änderungen ausstehen.</span>
            </p>
          </div>
        )}
        <div className="flex items-center justify-between rounded-2xl bg-surface-2 p-3 text-sm">
          <span>
            {pending.length} ausstehend
            {state.lastSyncedAt && <span className="text-muted"> · zuletzt {fmtTime(new Date(state.lastSyncedAt))}</span>}
          </span>
          <Button size="sm" variant="secondary" onClick={() => void flush()} loading={state.syncing}>
            <RefreshCw className="h-4 w-4" /> Jetzt
          </Button>
        </div>

        {conflicts.length > 0 && (
          <section>
            <h3 className="mb-2 font-semibold">Konflikte ({conflicts.length})</h3>
            <p className="mb-2 text-sm text-muted">Diese Einträge wurden zwischenzeitlich auf einem anderen Gerät geändert. Was soll gelten?</p>
            <ul className="space-y-2">
              {conflicts.map((c) => {
                const op = ops.find((o) => o.opId === c.opId);
                return (
                  <li key={c.opId} className="rounded-2xl border border-warning/40 bg-warning/5 p-3 text-sm">
                    <p className="font-medium">{TYPE_LABEL[op?.type ?? ''] ?? 'Änderung'}</p>
                    <p className="text-muted">Dieses Gerät: {describeLocal(op)}</p>
                    <p className="text-muted">Anderes Gerät: {describeEntity(c.serverEntity)}</p>
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" onClick={() => void resolveKeepLocal(c.opId)}>
                        Meine Änderung behalten
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => void resolveTakeServer(c.opId)}>
                        Andere übernehmen
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {failed.length > 0 && (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold">Fehlgeschlagen ({failed.length})</h3>
              <Button size="sm" variant="ghost" onClick={() => void retryFailed()}>
                Erneut versuchen
              </Button>
            </div>
            <ul className="space-y-2">
              {failed.map((o) => (
                <li key={o.seq} className="flex items-center gap-2 rounded-2xl bg-surface-2 p-3 text-sm">
                  <span className="flex-1">
                    {TYPE_LABEL[o.type] ?? o.type}
                    <span className="block text-error">{o.lastError}</span>
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => void discardFailed(o.seq!)}>
                    Verwerfen
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Sheet>
  );
}
