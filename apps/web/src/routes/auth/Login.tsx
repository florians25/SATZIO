import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@satzio/shared';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label } from '@/components/ui/input';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AuthLayout } from './AuthLayout';
import { PasswordInput } from './PasswordInput';

type Form = z.input<typeof loginSchema>;

export default function Login() {
  const login = useAuth((s) => s.login);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(loginSchema), defaultValues: { rememberMe: true } });

  const onSubmit = handleSubmit(async (v) => {
    try {
      const user = await login({ identifier: v.identifier, password: v.password, rememberMe: v.rememberMe ?? false });
      navigate(user.profile.onboardingCompleted ? from : '/onboarding', { replace: true });
    } catch (e) {
      setError('root', { message: errorMessage(e) });
    }
  });

  return (
    <AuthLayout title="Willkommen zurück" subtitle="Melde dich an und mach da weiter, wo du aufgehört hast.">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div>
          <Label htmlFor="identifier">E-Mail oder Benutzername</Label>
          <Input id="identifier" autoComplete="username" autoCapitalize="none" spellCheck={false} aria-invalid={!!errors.identifier} {...register('identifier')} />
          <FieldError>{errors.identifier?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="password">Passwort</Label>
          <PasswordInput id="password" autoComplete="current-password" aria-invalid={!!errors.password} {...register('password')} />
          <FieldError>{errors.password?.message}</FieldError>
        </div>
        <div className="flex items-center justify-between">
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" className="h-5 w-5 accent-[var(--primary)]" {...register('rememberMe')} />
            Angemeldet bleiben
          </label>
          <Link to="/forgot-password" className="text-sm font-medium text-primary">
            Passwort vergessen?
          </Link>
        </div>
        <FieldError>{errors.root?.message}</FieldError>
        <Button type="submit" size="lg" block loading={isSubmitting}>
          Anmelden
        </Button>
        <p className="text-center text-sm text-muted">
          Neu bei SATZIO?{' '}
          <Link to="/register" className="font-semibold text-primary">
            Kostenlos registrieren
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
