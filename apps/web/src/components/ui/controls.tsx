import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as React from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/cn';

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-border bg-surface-3 transition data-[state=checked]:border-primary data-[state=checked]:bg-primary',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block h-5 w-5 translate-x-1 rounded-full bg-text shadow transition data-[state=checked]:translate-x-6 data-[state=checked]:bg-primary-fg" />
    </SwitchPrimitive.Root>
  );
}

/** Segmentierte Auswahl – große Touch-Flächen. */
export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  className,
  size = 'md',
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  className?: string;
  size?: 'sm' | 'md';
  ariaLabel?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn('flex gap-1 rounded-2xl bg-surface-2 p-1', className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 rounded-xl px-2 font-semibold transition',
            size === 'sm' ? 'h-9 text-xs' : 'h-10 text-sm',
            o.value === value ? 'bg-surface text-text shadow-sm ring-1 ring-border' : 'text-muted hover:text-text',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const Tabs = TabsPrimitive.Root;
export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn('no-scrollbar flex gap-1 overflow-x-auto rounded-2xl bg-surface-2 p-1', className)} {...props} />;
}
export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'h-10 flex-1 whitespace-nowrap rounded-xl px-3 text-sm font-semibold text-muted transition data-[state=active]:bg-surface data-[state=active]:text-text data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-border',
        className,
      )}
      {...props}
    />
  );
}
export const TabsContent = TabsPrimitive.Content;

/** Auswahlkacheln (Onboarding, Einstellungen). */
export function ChoiceTile({
  selected,
  onClick,
  title,
  description,
  icon,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description?: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'flex min-h-14 w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition active:scale-[0.99]',
        selected ? 'border-primary bg-primary/10' : 'border-border bg-surface hover:bg-surface-2',
      )}
    >
      {icon && <span className={cn('text-muted', selected && 'text-primary')}>{icon}</span>}
      <span className="flex-1">
        <span className="block font-semibold">{title}</span>
        {description && <span className="block text-sm text-muted">{description}</span>}
      </span>
      <span className={cn('h-5 w-5 rounded-full border-2', selected ? 'border-primary bg-primary' : 'border-border')} aria-hidden />
    </button>
  );
}

export function ListRow({
  icon,
  title,
  subtitle,
  right,
  onClick,
  to,
  danger,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  onClick?: () => void;
  to?: string;
  danger?: boolean;
}) {
  const content = (
    <>
      {icon && <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted [&>svg]:h-5 [&>svg]:w-5', danger && 'text-error')}>{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate font-medium', danger && 'text-error')}>{title}</span>
        {subtitle && <span className="block truncate text-sm text-muted">{subtitle}</span>}
      </span>
      {right}
    </>
  );
  const cls = 'flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-surface-2 active:bg-surface-3';
  if (to) {
    return (
      <Link to={to} className={cls}>
        {content}
      </Link>
    );
  }
  return onClick ? (
    <button type="button" onClick={onClick} className={cls}>
      {content}
    </button>
  ) : (
    <div className={cls}>{content}</div>
  );
}
