import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema } from '@satzio/shared';
import { MailCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label } from '@/components/ui/input';
import { api, errorMessage } from '@/lib/api';
import { AuthLayout } from './AuthLayout';

export default function ForgotPassword() {
  const [sent, setSent] = useState<null | { mailEnabled: boolean }>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof forgotPasswordSchema>>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = handleSubmit(async (v) => {
    try {
      const r = await api<{ ok: boolean; mailEnabled: boolean }>('/auth/password/forgot', { method: 'POST', body: v, noRefresh: true });
      setSent({ mailEnabled: r.mailEnabled });
    } catch (e) {
      setError('root', { message: errorMessage(e) });
    }
  });

  if (sent) {
    return (
      <AuthLayout title="Prüfe dein Postfach">
        <div className="rounded-3xl border border-border bg-surface p-5">
          <MailCheck className="mb-3 h-8 w-8 text-primary" />
          <p>Falls ein Konto mit dieser Adresse existiert, haben wir dir einen Link zum Zurücksetzen geschickt. Er ist 60 Minuten gültig.</p>
          {!sent.mailEnabled && (
            <p className="mt-3 text-sm text-warning">
              Hinweis: Auf diesem Server ist kein E-Mail-Versand eingerichtet. Bitte wende dich an den Betreiber.
            </p>
          )}
        </div>
        <Button asChild variant="secondary" block className="mt-6">
          <Link to="/login">Zur Anmeldung</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Passwort vergessen?" subtitle="Gib deine E-Mail-Adresse ein. Wir schicken dir einen Link zum Zurücksetzen.">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div>
          <Label htmlFor="email">E-Mail-Adresse</Label>
          <Input id="email" type="email" inputMode="email" autoComplete="email" aria-invalid={!!errors.email} {...register('email')} />
          <FieldError>{errors.email?.message}</FieldError>
        </div>
        <FieldError>{errors.root?.message}</FieldError>
        <Button type="submit" size="lg" block loading={isSubmitting}>
          Link anfordern
        </Button>
      </form>
    </AuthLayout>
  );
}
