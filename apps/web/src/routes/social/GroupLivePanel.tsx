import type { InviteLiveParticipant } from '@satzio/shared';
import { CheckCircle2, ChevronDown, Radio, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Card, ProgressBar } from '@/components/ui/card';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { fmtDuration, fmtVolume, fmtWeight } from '@/lib/format';
import { useInviteLive } from '@/lib/queries';
import { nameOf } from '@/lib/social';
import { Avatar, relTime } from './parts';

/**
 * Live-Gruppenansicht für ein gemeinsames Training. Zeigt den Fortschritt der
 * anderen Teilnehmenden (aktuelle Übung, Sätze, letzter Satz) und aktualisiert sich
 * alle 5 s, solange die Seite sichtbar ist.
 *
 * - compact (Standard): einklappbare Leiste, z. B. im Training
 * - expanded: immer aufgeklappt (Einladungsseite)
 */
export function GroupLivePanel({
  inviteId,
  defaultExpanded = false,
  showSelf = false,
  className,
}: {
  inviteId: string;
  defaultExpanded?: boolean;
  /** Eigenen Fortschritt ebenfalls anzeigen (Standard: nur die anderen). */
  showSelf?: boolean;
  className?: string;
}) {
  const unit = useAuth((s) => s.user?.settings.unit ?? 'kg');
  const [open, setOpen] = useState(defaultExpanded);
  const live = useInviteLive(inviteId);
  const err = live.error;
  if (err instanceof ApiError && (err.status === 403 || err.status === 404)) return null;
  const data = live.data;
  const people = (data?.participants ?? []).filter((p) => showSelf || !p.isMe);
  const activeCount = people.filter((p) => p.sessionStatus !== 'completed').length;
  const waiting = data?.waiting ?? [];

  return (
    <Card className={cn('overflow-hidden', className)} data-testid="group-live-panel">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left"
      >
        <span className="relative grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-primary">
          <Users className="h-4 w-4" />
          {activeCount > 0 && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-success ring-2 ring-surface" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Gemeinsames Training</span>
          <span className="block truncate text-xs text-muted">
            {!data
              ? 'Lade Gruppe …'
              : people.length === 0
                ? waiting.length
                  ? `${waiting.map(nameOf).join(', ')} ${waiting.length === 1 ? 'hat' : 'haben'} noch nicht gestartet`
                  : 'Noch niemand sonst gestartet'
                : people.map((p) => `${nameOf(p)} ${p.setsDone}/${p.setsTotal}`).join(' · ')}
          </span>
        </span>
        <span className="flex -space-x-2">
          {people.slice(0, 3).map((p) => (
            <Avatar key={p.id} user={p} size={26} className="ring-2 ring-surface" />
          ))}
        </span>
        <ChevronDown className={cn('h-5 w-5 shrink-0 text-muted transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t border-border">
          {people.length === 0 && (
            <p className="px-4 py-3 text-sm text-muted">Sobald jemand aus der Gruppe trainiert, siehst du hier den Fortschritt live.</p>
          )}
          <ul className="divide-y divide-border">
            {people.map((p) => (
              <LiveRow key={p.id} p={p} unit={unit} serverTime={data?.serverTime} />
            ))}
          </ul>
          {waiting.length > 0 && people.length > 0 && (
            <p className="border-t border-border px-4 py-2 text-xs text-muted">Noch nicht gestartet: {waiting.map(nameOf).join(', ')}</p>
          )}
          <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted">
            <span className="flex items-center gap-1">
              <Radio className="h-3.5 w-3.5" /> {live.isFetching ? 'Aktualisiere …' : 'Live · alle 5 s'}
            </span>
            <Link to={`/invites/${inviteId}`} className="font-semibold text-primary">
              Details
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
}

function LiveRow({ p, unit, serverTime }: { p: InviteLiveParticipant; unit: 'kg' | 'lbs'; serverTime?: string }) {
  const done = p.sessionStatus === 'completed';
  return (
    <li className="flex gap-3 px-4 py-3" data-testid="live-participant">
      <Avatar user={p} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold">
            {nameOf(p)}
            {p.isMe && <span className="font-normal text-muted"> (du)</span>}
          </span>
          {done ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-success">
              <CheckCircle2 className="h-3.5 w-3.5" /> Fertig
            </span>
          ) : (
            <span className={cn('text-xs font-semibold', p.sessionStatus === 'paused' ? 'text-warning' : 'text-primary')}>
              {p.sessionStatus === 'paused' ? 'Pausiert' : 'Aktiv'}
            </span>
          )}
          <span className="ml-auto shrink-0 text-xs text-muted">{relTime(p.updatedAt, serverTime)}</span>
        </div>
        {done && p.summary ? (
          <p className="text-sm text-muted">
            {p.summary.completedSets} Sätze · {fmtVolume(p.summary.volumeKg, unit)} · {fmtDuration(p.summary.durationMinutes)}
          </p>
        ) : (
          <>
            <p className="truncate text-sm">{p.currentExercise ?? '–'}</p>
            <div className="mt-1 flex items-center gap-2">
              <ProgressBar value={p.setsTotal ? (p.setsDone / p.setsTotal) * 100 : 0} className="flex-1" />
              <span className="shrink-0 text-xs tabular text-muted">
                {p.setsDone}/{p.setsTotal} Sätze
              </span>
            </div>
          </>
        )}
        {p.lastSet && !done && (
          <p className="mt-1 truncate text-xs text-muted">
            Zuletzt: {p.lastSet.weightKg !== null ? `${fmtWeight(p.lastSet.weightKg, unit)} ${unit}` : 'ohne Gewicht'} × {p.lastSet.reps ?? '–'}
            {p.lastSet.exerciseName !== p.currentExercise ? ` · ${p.lastSet.exerciseName}` : ''}
          </p>
        )}
      </div>
    </li>
  );
}

export default GroupLivePanel;
