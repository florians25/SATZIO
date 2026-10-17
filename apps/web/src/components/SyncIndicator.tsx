import { AlertTriangle, CloudOff, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useSyncState } from '@/lib/sync';
import { SyncSheet } from './SyncSheet';

/** Sichtbarer Synchronisationsstatus – erscheint nur, wenn es etwas zu sagen gibt. */
export function SyncIndicator() {
  const { online, pending, conflicts, failed, syncing } = useSyncState();
  const [open, setOpen] = useState(false);
  let content: React.ReactNode = null;
  if (conflicts > 0 || failed > 0) {
    content = (
      <>
        <AlertTriangle className="h-4 w-4 text-warning" />
        <span className="text-warning">{conflicts + failed}</span>
      </>
    );
  } else if (!online) {
    content = (
      <>
        <CloudOff className="h-4 w-4" />
        <span>{pending > 0 ? pending : 'Offline'}</span>
      </>
    );
  } else if (pending > 0 || syncing) {
    content = (
      <>
        <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
        {pending > 0 && <span>{pending}</span>}
      </>
    );
  }
  if (!content) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-xs font-semibold text-muted"
        aria-label="Synchronisationsstatus"
      >
        {content}
      </button>
      <SyncSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
