import { zodResolver } from '@hookform/resolvers/zod';
import { emailSchema, passwordSchema, usernameSchema } from '@satzio/shared';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label } from '@/components/ui/input';
import { ApiError, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AuthLayout } from './AuthLayout';
import { PasswordInput } from './PasswordInput';
import { PasswordRules } from './PasswordRules';

const schema = z
  .object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirm: z.string().min(1, 'Bitte Passwort wiederholen.'),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Die Passwörter stimmen nicht überein.' });

type Form = z.infer<typeof schema>;

export default function Register() {
  const register = useAuth((s) => s.register);
  const navigate = useNavigate();
  const {
    register: field,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema), mode: 'onTouched' });
  const password = watch('password') ?? '';

  const onSubmit = handleSubmit(async (v) => {
    try {
      await register({ username: v.username, email: v.email, password: v.password, rememberMe: true });
      navigate('/onboarding', { replace: true });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'USERNAME_TAKEN') setError('username', { message: e.message });
      else if (e instanceof ApiError && e.code === 'ACCOUNT_EXISTS') setError('email', { message: e.message });
      else setError('root', { message: errorMessage(e) });
    }
  });

  return (
    <AuthLayout title="Konto erstellen" subtitle="In 30 Sekunden startklar. Deine Daten bleiben auf deinem Server.">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div>
          <Label htmlFor="username">Benutzername</Label>
          <Input id="username" autoComplete="username" autoCapitalize="none" spellCheck={false} aria-invalid={!!errors.username} aria-describedby="username-err" {...field('username')} />
          <FieldError id="username-err">{errors.username?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="email">E-Mail-Adresse</Label>
          <Input id="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" aria-invalid={!!errors.email} aria-describedby="email-err" {...field('email')} />
          <FieldError id="email-err">{errors.email?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="password">Passwort</Label>
          <PasswordInput id="password" autoComplete="new-password" aria-invalid={!!errors.password} {...field('password')} />
          <PasswordRules value={password} />
        </div>
        <div>
          <Label htmlFor="confirm">Passwort bestätigen</Label>
          <PasswordInput id="confirm" autoComplete="new-password" aria-invalid={!!errors.confirm} aria-describedby="confirm-err" {...field('confirm')} />
          <FieldError id="confirm-err">{errors.confirm?.message}</FieldError>
        </div>
        <FieldError>{errors.root?.message}</FieldError>
        <Button type="submit" size="lg" block loading={isSubmitting}>
          Kostenlos registrieren
        </Button>
        <p className="text-center text-sm text-muted">
          Schon ein Konto?{' '}
          <Link to="/login" className="font-semibold text-primary">
            Anmelden
          </Link>
        </p>
        <p className="text-center text-xs text-muted">
          Mit der Registrierung akzeptierst du die{' '}
          <Link to="/profile/privacy" className="underline">
            Datenschutzhinweise
          </Link>
          .
        </p>
      </form>
    </AuthLayout>
  );
}
