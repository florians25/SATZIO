import { CheckCircle2, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AuthLayout } from './AuthLayout';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const authed = useAuth((s) => s.status === 'authed');
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    api('/auth/verify-email', { method: 'POST', body: { token }, noRefresh: true })
      .then(() => {
        setState('ok');
        if (user) setUser({ ...user, emailVerified: true });
      })
      .catch((e) => {
        setState('error');
        setMessage(errorMessage(e));
      });
  }, [token, user, setUser]);

  return (
    <AuthLayout title="E-Mail-Bestätigung" back={false}>
      {state === 'loading' && <p className="text-muted">Wird geprüft …</p>}
      {state === 'ok' && (
        <div className="flex gap-3 rounded-3xl border border-border bg-surface p-5">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-success" />
          <p>Danke! Deine E-Mail-Adresse ist bestätigt.</p>
        </div>
      )}
      {state === 'error' && (
        <div className="flex gap-3 rounded-3xl border border-border bg-surface p-5">
          <XCircle className="h-6 w-6 shrink-0 text-error" />
          <p>{message}</p>
        </div>
      )}
      <Button asChild block size="lg" className="mt-6">
        <Link to={authed ? '/' : '/login'}>{authed ? 'Zur App' : 'Zur Anmeldung'}</Link>
      </Button>
    </AuthLayout>
  );
}
