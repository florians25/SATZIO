import { zodResolver } from '@hookform/resolvers/zod';
import { passwordSchema } from '@satzio/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FieldError, Label } from '@/components/ui/input';
import { api, errorMessage } from '@/lib/api';
import { AuthLayout } from './AuthLayout';
import { PasswordInput } from './PasswordInput';
import { PasswordRules } from './PasswordRules';

const schema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Die Passwörter stimmen nicht überein.' });

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (v) => {
    try {
      await api('/auth/password/reset', { method: 'POST', body: { token, password: v.password }, noRefresh: true });
      setDone(true);
    } catch (e) {
      setError('root', { message: errorMessage(e) });
    }
  });

  if (!token) {
    return (
      <AuthLayout title="Ungültiger Link">
        <p className="text-muted">Dieser Link ist unvollständig. Bitte fordere einen neuen an.</p>
        <Button asChild block className="mt-6">
          <Link to="/forgot-password">Neuen Link anfordern</Link>
        </Button>
      </AuthLayout>
    );
  }
  if (done) {
    return (
      <AuthLayout title="Passwort geändert" back={false}>
        <p className="text-muted">Dein Passwort wurde geändert. Aus Sicherheitsgründen wurden alle Sitzungen beendet.</p>
        <Button asChild block size="lg" className="mt-6">
          <Link to="/login">Jetzt anmelden</Link>
        </Button>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout title="Neues Passwort" subtitle="Wähle ein neues, sicheres Passwort.">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div>
          <Label htmlFor="password">Neues Passwort</Label>
          <PasswordInput id="password" autoComplete="new-password" {...register('password')} />
          <PasswordRules value={watch('password') ?? ''} />
        </div>
        <div>
          <Label htmlFor="confirm">Passwort bestätigen</Label>
          <PasswordInput id="confirm" autoComplete="new-password" {...register('confirm')} />
          <FieldError>{errors.confirm?.message}</FieldError>
        </div>
        <FieldError>{errors.root?.message}</FieldError>
        <Button type="submit" size="lg" block loading={isSubmitting}>
          Passwort speichern
        </Button>
      </form>
    </AuthLayout>
  );
}
