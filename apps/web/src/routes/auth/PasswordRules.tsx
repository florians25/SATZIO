import { PASSWORD_RULES } from '@satzio/shared';
import { Check, Circle } from 'lucide-react';
import { cn } from '@/lib/cn';

export function PasswordRules({ value }: { value: string }) {
  return (
    <ul className="mt-2 grid gap-1 text-sm" aria-label="Passwortanforderungen">
      {PASSWORD_RULES.map((r) => {
        const ok = r.test(value);
        return (
          <li key={r.id} className={cn('flex items-center gap-2', ok ? 'text-success' : 'text-muted')}>
            {ok ? <Check className="h-4 w-4" /> : <Circle className="h-3.5 w-3.5" />}
            {r.label}
          </li>
        );
      })}
    </ul>
  );
}
