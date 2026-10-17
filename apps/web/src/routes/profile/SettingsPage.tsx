import { ALL_WEIGHT_STEPS_KG, MOTIVATION_LABELS_DE, THEME_LABELS_DE, type MotivationLevel, type ThemeMode } from '@satzio/shared';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { Card, SectionTitle } from '@/components/ui/card';
import { Segmented, Switch } from '@/components/ui/controls';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { requestNotificationPermission } from '@/lib/feedback';
import { useUpdateSettings } from '@/lib/queries';
import { REST_PRESETS } from '@/lib/timer';

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
      <div>
        <p className="font-medium">{title}</p>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const s = useAuth((st) => st.user!.settings);
  const m = useUpdateSettings();
  const set = (patch: Parameters<typeof m.mutate>[0]) => m.mutate(patch, { onError: () => toast.error('Speichern fehlgeschlagen') });

  return (
    <div>
      <PageHeader title="Einstellungen" back="/profile" subtitle="Änderungen werden sofort gespeichert" />
      <div className="space-y-5 px-4 pb-10">
        <section>
          <SectionTitle>Training</SectionTitle>
          <Card className="divide-y divide-border">
            <div className="space-y-2 p-4">
              <p className="font-medium">Gewichtseinheit</p>
              <Segmented value={s.unit} onChange={(unit) => set({ unit })} options={[{ value: 'kg', label: 'Kilogramm (kg)' }, { value: 'lbs', label: 'Pfund (lbs)' }]} />
              <p className="text-xs text-muted">Intern speichert SATZIO alles in kg – ein Wechsel verändert keine Daten.</p>
            </div>
            <div className="space-y-2 p-4">
              <p className="font-medium">Standard-Pausenzeit</p>
              <div className="flex gap-1.5">
                {REST_PRESETS.map((sec) => (
                  <button key={sec} type="button" onClick={() => set({ defaultRestSeconds: sec })} className={cn('h-10 flex-1 rounded-xl border text-sm font-semibold', s.defaultRestSeconds === sec ? 'border-primary bg-primary text-primary-fg' : 'border-border bg-surface-2')}>
                    {sec}s
                  </button>
                ))}
              </div>
            </div>
            <Row title="Pausentimer automatisch starten" hint="Nach jedem abgehakten Satz">
              <Switch checked={s.autoStartRestTimer} onCheckedChange={(v) => set({ autoStartRestTimer: v })} />
            </Row>
            <div className="space-y-2 p-4">
              <p className="font-medium">Gewichtsschritte (Schnellaktionen, kg)</p>
              <div className="flex gap-1.5">
                {ALL_WEIGHT_STEPS_KG.map((st) => {
                  const on = s.weightStepsKg.includes(st);
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => {
                        const next = on ? s.weightStepsKg.filter((x) => x !== st) : [...s.weightStepsKg, st];
                        if (next.length) set({ weightStepsKg: next });
                      }}
                      aria-pressed={on}
                      className={cn('h-10 flex-1 rounded-xl border text-sm font-semibold', on ? 'border-primary bg-primary text-primary-fg' : 'border-border bg-surface-2')}
                    >
                      ±{st.toLocaleString('de-DE')}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted">Beim Bearbeiten eines Gewichts werden die zwei kleinsten gewählten Schritte angezeigt. Pro Übung einstellbar.</p>
            </div>
            <Row title="Steigerungsvorschläge" hint="Moderate Vorschläge, du entscheidest selbst">
              <Switch checked={s.progressionEnabled} onCheckedChange={(v) => set({ progressionEnabled: v })} />
            </Row>
          </Card>
        </section>

        <section>
          <SectionTitle>Motivation</SectionTitle>
          <Card className="divide-y divide-border">
            <div className="space-y-2 p-4">
              <p className="font-medium">SATZIO Coach</p>
              <Segmented size="sm" value={s.motivationLevel} onChange={(v: MotivationLevel) => set({ motivationLevel: v })} options={(['off', 'subtle', 'normal', 'intense'] as MotivationLevel[]).map((v) => ({ value: v, label: MOTIVATION_LABELS_DE[v] }))} />
              <p className="text-xs text-muted">Kurze Meldungen oben im Bild – sie blockieren nie die Eingabe.</p>
            </div>
            <Row title="Erfolge & Achievements" hint="Dezente Abzeichen für Meilensteine">
              <Switch checked={s.gamificationEnabled} onCheckedChange={(v) => set({ gamificationEnabled: v })} />
            </Row>
          </Card>
        </section>

        <section>
          <SectionTitle>Signale</SectionTitle>
          <Card className="divide-y divide-border">
            <Row title="Vibration" hint="Beim Abhaken und am Pausenende (falls vom Gerät unterstützt)">
              <Switch checked={s.vibrationEnabled} onCheckedChange={(v) => set({ vibrationEnabled: v })} />
            </Row>
            <Row title="Ton am Pausenende">
              <Switch checked={s.soundEnabled} onCheckedChange={(v) => set({ soundEnabled: v })} />
            </Row>
            <Row title="Benachrichtigungen" hint="Pausenende, wenn die App im Hintergrund ist – nur solange der Browser die App aktiv hält (iOS stark eingeschränkt)">
              <Switch
                checked={s.notificationsEnabled}
                onCheckedChange={async (v) => {
                  if (v) {
                    const p = await requestNotificationPermission();
                    if (p !== 'granted') {
                      toast.error(p === 'unsupported' ? 'Benachrichtigungen werden von diesem Browser nicht unterstützt.' : 'Benachrichtigungen wurden nicht erlaubt.');
                      return;
                    }
                  }
                  set({ notificationsEnabled: v });
                }}
              />
            </Row>
          </Card>
        </section>

        <section>
          <SectionTitle>Darstellung</SectionTitle>
          <Card className="space-y-4 p-4">
            <div className="space-y-2">
              <p className="font-medium">Design</p>
              <Segmented value={s.theme} onChange={(v: ThemeMode) => set({ theme: v })} options={(['dark', 'light', 'system'] as ThemeMode[]).map((v) => ({ value: v, label: THEME_LABELS_DE[v] }))} />
            </div>
            <div className="space-y-2">
              <p className="font-medium">Sprache</p>
              <Segmented value={s.language} onChange={(v) => set({ language: v })} options={[{ value: 'de', label: 'Deutsch' }, { value: 'en', label: 'English (teilweise)' }]} />
            </div>
            <div className="space-y-2">
              <p className="font-medium">Trainingsansicht</p>
              <Segmented value={s.workoutMode} onChange={(v) => set({ workoutMode: v })} options={[{ value: 'list', label: 'Liste (Notizen)' }, { value: 'guided', label: 'Geführt' }]} />
            </div>
            <div className="space-y-2">
              <p className="font-medium">Zeitzone</p>
              <p className="text-sm text-muted">
                {s.timeZone}
                {s.timeZone !== Intl.DateTimeFormat().resolvedOptions().timeZone && (
                  <button type="button" className="ml-2 text-primary" onClick={() => set({ timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })}>
                    Auf {Intl.DateTimeFormat().resolvedOptions().timeZone} setzen
                  </button>
                )}
              </p>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
