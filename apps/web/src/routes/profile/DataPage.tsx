import { useQueryClient } from '@tanstack/react-query';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, SectionTitle } from '@/components/ui/card';
import { api, downloadFile, errorMessage } from '@/lib/api';

export default function DataPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const day = new Date().toISOString().slice(0, 10);

  const doImport = async (file: File) => {
    setBusy(true);
    setResult(null);
    const form = new FormData();
    form.append('file', file);
    try {
      const r = await api<{ imported: number; skipped: number; errors?: string[]; plans?: number; bodyWeight?: number }>('/users/me/import', { method: 'POST', form });
      setResult(
        `${r.imported} Trainings importiert, ${r.skipped} bereits vorhanden übersprungen` +
          (r.plans ? `, ${r.plans} Pläne` : '') +
          (r.bodyWeight ? `, ${r.bodyWeight} Körpergewichtseinträge` : '') +
          (r.errors?.length ? `. Hinweise: ${r.errors.slice(0, 3).join('; ')}` : '.'),
      );
      await qc.invalidateQueries();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div>
      <PageHeader title="Daten" back="/profile" />
      <div className="space-y-5 px-4 pb-10">
        <section>
          <SectionTitle>Export</SectionTitle>
          <Card className="space-y-2 p-4">
            <p className="text-sm text-muted">Deine Daten gehören dir. Lade sie jederzeit vollständig herunter.</p>
            <Button variant="secondary" block onClick={() => void downloadFile('/users/me/export.json', `satzio-export-${day}.json`).catch((e) => toast.error(errorMessage(e)))}>
              <Download className="h-4 w-4" /> Alles als JSON (Profil, Pläne, Trainings, Rekorde)
            </Button>
            <Button variant="secondary" block onClick={() => void downloadFile('/users/me/export.csv', `satzio-training-${day}.csv`).catch((e) => toast.error(errorMessage(e)))}>
              <FileSpreadsheet className="h-4 w-4" /> Trainingshistorie als CSV
            </Button>
          </Card>
        </section>
        <section>
          <SectionTitle>Import</SectionTitle>
          <Card className="space-y-3 p-4">
            <p className="text-sm text-muted">
              Importiere einen SATZIO-JSON-Export (z. B. von einem anderen Server) oder eine CSV-Datei mit den Spalten
              <code className="mx-1 rounded bg-surface-2 px-1 text-xs">date;workout;exercise;set;type;weight_kg;reps;completed;rpe;notes</code>.
              Bereits vorhandene Trainings werden nicht doppelt angelegt.
            </p>
            <Button block loading={busy} onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Datei auswählen
            </Button>
            <input ref={fileRef} type="file" accept=".json,.csv,application/json,text/csv" hidden onChange={(e) => e.target.files?.[0] && void doImport(e.target.files[0])} />
            {result && <p className="rounded-xl bg-surface-2 p-3 text-sm">{result}</p>}
          </Card>
        </section>
        <p className="text-xs text-muted">Trainingsnotizen aus Notizen-Apps importierst du unter Pläne → „Notizen importieren“.</p>
      </div>
    </div>
  );
}
