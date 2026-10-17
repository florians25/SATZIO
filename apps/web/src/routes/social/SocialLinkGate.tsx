import { Navigate, useParams } from 'react-router';
import { Splash } from '@/components/Splash';
import { useAuth } from '@/lib/auth';
import { setPendingSocial } from '@/lib/social';

/**
 * Öffentliche Einstiegs-Links (/friends/add/:code, /invites/join/:token).
 * Nicht angemeldet → Link merken und zur Anmeldung; nach Login/Registrierung
 * verarbeitet usePendingSocial() den Link. Angemeldet → weiter zur App-Seite.
 */
export default function SocialLinkGate({ kind }: { kind: 'friend' | 'join' }) {
  const params = useParams<{ code?: string; token?: string }>();
  const status = useAuth((s) => s.status);
  const onboarded = useAuth((s) => s.user?.profile.onboardingCompleted ?? false);
  const value = (kind === 'friend' ? params.code : params.token) ?? '';
  const valid = /^[A-Za-z0-9_-]{8,64}$/.test(value);
  if (status === 'booting') return <Splash />;
  if (!valid) return <Navigate to="/" replace />;
  const target = kind === 'friend' ? `/social/add/${value}` : `/social/join/${value}`;
  if (status === 'authed' && onboarded) return <Navigate to={target} replace />;
  setPendingSocial(kind === 'friend' ? { kind, code: value } : { kind, token: value });
  return <Navigate to={status === 'authed' ? '/onboarding' : '/welcome'} replace />;
}
