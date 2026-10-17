import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/card';

export default function PrivacyPage() {
  return (
    <div>
      <PageHeader title="Datenschutz" back />
      <div className="space-y-4 px-4 pb-10 text-[15px] leading-relaxed">
        <Card className="space-y-3 p-4">
          <h2 className="font-bold">Datenschutzhinweise (Vorlage)</h2>
          <p>
            SATZIO wird von dem Betreiber dieses Servers selbst gehostet. Verantwortlich für die Verarbeitung deiner Daten ist dieser Betreiber. Es werden keine Daten an
            externe Cloud-, Analyse- oder Werbedienste übertragen.
          </p>
          <h3 className="font-semibold">Welche Daten werden verarbeitet?</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>Kontodaten: Benutzername, E-Mail-Adresse, Passwort (nur als Argon2id-Hash)</li>
            <li>Trainingsdaten: Pläne, Workouts, Sätze, Gewichte, Wiederholungen, Notizen, Rekorde</li>
            <li>Freiwillige Angaben: Profilbild, Ziel, Erfahrung, Körpergewicht, Maße, Größe</li>
            <li>Technische Daten: Sitzungen (Gerätetyp/Browser, Zeitpunkte) zur Absicherung deines Kontos</li>
          </ul>
          <h3 className="font-semibold">Zweck</h3>
          <p>Ausschließlich die Bereitstellung der App-Funktionen: Training erfassen, Fortschritt anzeigen, Konto absichern.</p>
          <h3 className="font-semibold">Speicherung auf deinem Gerät</h3>
          <p>
            Für die Offline-Nutzung speichert die App Trainings und Pläne im Browserspeicher (IndexedDB) deines Geräts. Beim Abmelden werden diese Daten gelöscht. Noch
            nicht synchronisierte Änderungen gehen verloren, wenn du die Browserdaten löschst.
          </p>
          <h3 className="font-semibold">Deine Rechte</h3>
          <p>
            Du kannst deine Daten jederzeit exportieren (Profil → Daten), berichtigen und dein Konto inklusive aller Daten löschen (Profil → Konto & Sicherheit). Weitere
            Rechte (Auskunft, Einschränkung, Beschwerde bei einer Aufsichtsbehörde) richtest du an den Betreiber.
          </p>
          <h3 className="font-semibold">Gesundheitsbezug</h3>
          <p>SATZIO gibt keine medizinischen Empfehlungen. Vorschläge zur Gewichtssteigerung sind rein rechnerisch und ersetzen keine fachliche Beratung.</p>
        </Card>
        <p className="text-sm text-muted">
          Hinweis für Betreiber: Diese Vorlage ersetzt keine Rechtsberatung. Vor einer öffentlichen Inbetriebnahme ist ein rechtlich geprüftes Datenschutz- und
          Impressumskonzept erforderlich.
        </p>
      </div>
    </div>
  );
}
