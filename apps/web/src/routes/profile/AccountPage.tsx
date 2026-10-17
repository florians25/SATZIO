import { PASSWORD_RULES, type UserView } from '@satzio/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, LogOut, Mail, Monitor, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, SectionTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { clearLocalData } from '@/lib/db';
import { fmtDate, fmtTime } from '@/lib/format';
import { qk } from '@/lib/queries';
import { PasswordInput } from '../auth/PasswordInput';
import { PasswordRules } from '../auth/PasswordRules';

interface SessionInfo {
  id: string;
  userAgent: string | null;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
}

function deviceName(ua: string | null) {
  if (!ua) return 'Unbekanntes Gerät';
  const os = /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Mac OS/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Gerät';
  const br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  return `${br} auf ${os}`;
}

export default function AccountPage() {
  const user = useAuth((s) => s.user)!;
  const setUser = useAuth((s) => s.setUser);
  const logout = useAuth((s) => s.logout);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const sessions = useQuery({ queryKey: qk.sessions, queryFn: () => api<SessionInfo[]>('/auth/sessions') });
  const [pw, setPw] = useState({ current: '', next: '' });
  const [email, setEmail] = useState({ email: '', password: '' });
  const [del, setDel] = useState({ open: false, password: '', confirm: '' });
  const [busy, setBusy] = useState<string | null>(null);

  const changePassword = async () => {
    setBusy('pw');
    try {
      await api('/auth/password/change', { method: 'POST', body: { currentPassword: pw.current, newPassword: pw.next } });
      setPw({ current: '', next: '' });
      void qc.invalidateQueries({ queryKey: qk.sessions });
      toast.success('Passwort geändert – andere Geräte wurden abgemeldet.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const changeEmail = async () => {
    setBusy('email');
    try {
      setUser(await api<UserView>('/users/me/email', { method: 'POST', body: email }));
      setEmail({ email: '', password: '' });
      toast.success('E-Mail geändert. Bitte bestätige die neue Adresse.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const resend = async () => {
    try {
      const r = await api<{ mailEnabled: boolean }>('/auth/verify-email/resend', { method: 'POST' });
      toast.success(r.mailEnabled ? 'Bestätigungs-E-Mail gesendet.' : 'Auf diesem Server ist kein E-Mail-Versand eingerichtet.');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const deleteAccount = async () => {
    setBusy('del');
    try {
      await api('/users/me/delete', { method: 'POST', body: { password: del.password, confirm: del.confirm } });
      await clearLocalData();
      qc.clear();
      useAuth.setState({ status: 'guest', user: null });
      toast.success('Dein Konto und alle Daten wurden gelöscht.');
      navigate('/welcome', { replace: true });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const pwValid = PASSWORD_RULES.every((r) => r.test(pw.next)) && pw.current.length > 0;

  return (
    <div>
      <PageHeader title="Konto & Sicherheit" back="/profile" />
      <div className="space-y-5 px-4 pb-10">
        <section>
          <SectionTitle>E-Mail</SectionTitle>
          <Card className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-muted" />
              <span className="flex-1 truncate">{user.email}</span>
              {user.emailVerified ? (
                <span className="flex items-center gap-1 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" /> Bestätigt
                </span>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => void resend()}>
                  Bestätigen
                </Button>
              )}
            </div>
            {!user.emailVerified && <p className="text-xs text-muted">Du kannst SATZIO ohne Bestätigung voll nutzen. Die Bestätigung hilft beim Zurücksetzen des Passworts.</p>}
            <details>
              <summary className="cursor-pointer py-2 text-sm font-semibold text-primary">E-Mail-Adresse ändern</summary>
              <div className="mt-2 space-y-2">
                <Input type="email" placeholder="Neue E-Mail-Adresse" value={email.email} onChange={(e) => setEmail({ ...email, email: e.target.value })} autoComplete="email" />
                <PasswordInput placeholder="Aktuelles Passwort" value={email.password} onChange={(e) => setEmail({ ...email, password: e.target.value })} autoComplete="current-password" />
                <Button block loading={busy === 'email'} disabled={!email.email || !email.password} onClick={() => void changeEmail()}>
                  E-Mail ändern
                </Button>
              </div>
            </details>
          </Card>
        </section>

        <section>
          <SectionTitle>Passwort ändern</SectionTitle>
          <Card className="space-y-3 p-4">
            <div>
              <Label htmlFor="cur">Aktuelles Passwort</Label>
              <PasswordInput id="cur" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" />
            </div>
            <div>
              <Label htmlFor="new">Neues Passwort</Label>
              <PasswordInput id="new" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" />
              <PasswordRules value={pw.next} />
            </div>
            <Button block loading={busy === 'pw'} disabled={!pwValid} onClick={() => void changePassword()}>
              Passwort ändern
            </Button>
          </Card>
        </section>

        <section>
          <SectionTitle>Angemeldete Geräte</SectionTitle>
          <Card className="divide-y divide-border">
            {sessions.data?.map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-4">
                <Monitor className="h-5 w-5 text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {deviceName(s.userAgent)} {s.current && <span className="text-sm text-primary">· Dieses Gerät</span>}
                  </p>
                  <p className="text-sm text-muted">
                    Aktiv {fmtDate(s.lastUsedAt)} {fmtTime(s.lastUsedAt)}
                  </p>
                </div>
                {!s.current && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await api(`/auth/sessions/${s.id}`, { method: 'DELETE' });
                      void qc.invalidateQueries({ queryKey: qk.sessions });
                    }}
                  >
                    Abmelden
                  </Button>
                )}
              </div>
            ))}
          </Card>
          <Button variant="secondary" block className="mt-2" onClick={() => void logout({ everywhere: true })}>
            <LogOut className="h-4 w-4" /> Überall abmelden
          </Button>
        </section>

        <section>
          <SectionTitle>Konto löschen</SectionTitle>
          <Card className="p-4">
            <p className="text-sm text-muted">Löscht dein Konto und alle Trainingsdaten, Pläne, Rekorde und Uploads endgültig. Exportiere vorher deine Daten, wenn du sie behalten möchtest.</p>
            <Button variant="danger" block className="mt-3" onClick={() => setDel({ open: true, password: '', confirm: '' })}>
              <Trash2 className="h-4 w-4" /> Konto löschen
            </Button>
          </Card>
        </section>
      </div>
      <Sheet open={del.open} onOpenChange={(o) => setDel({ ...del, open: o })} title="Konto endgültig löschen?" description="Diese Aktion kann nicht rückgängig gemacht werden.">
        <div className="space-y-3">
          <PasswordInput placeholder="Passwort" value={del.password} onChange={(e) => setDel({ ...del, password: e.target.value })} autoComplete="current-password" />
          <Input placeholder="Zur Bestätigung LÖSCHEN eingeben" value={del.confirm} onChange={(e) => setDel({ ...del, confirm: e.target.value })} autoCapitalize="characters" />
          <Button variant="danger" block size="lg" loading={busy === 'del'} disabled={!del.password || del.confirm !== 'LÖSCHEN'} onClick={() => void deleteAccount()}>
            Konto und alle Daten löschen
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
