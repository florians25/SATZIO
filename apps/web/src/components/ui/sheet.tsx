import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/cn';

/** Bottom Sheet (mobil) bzw. zentrierter Dialog (Desktop). */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  footer,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] data-[state=open]:animate-in" />
        <Dialog.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-3xl border border-border bg-surface shadow-float outline-none',
            'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[min(560px,92vw)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl',
            className,
          )}
          aria-describedby={description ? undefined : undefined}
        >
          <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-surface-3 sm:hidden" aria-hidden />
          <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-3">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-bold leading-tight">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{typeof title === 'string' ? title : 'Dialog'}</Dialog.Description>
              )}
            </div>
            <Dialog.Close className="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2" aria-label="Schließen">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
          {footer && <div className="border-t border-border px-5 pb-safe pt-3 [&>*]:mb-3">{footer}</div>}
          {!footer && <div className="pb-safe" />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function SheetAction({
  icon,
  children,
  onClick,
  tone = 'default',
  disabled,
  hint,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  tone?: 'default' | 'danger' | 'primary';
  disabled?: boolean;
  hint?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[15px] font-medium transition hover:bg-surface-2 active:bg-surface-3 disabled:opacity-40',
        tone === 'danger' && 'text-error',
        tone === 'primary' && 'text-primary',
      )}
    >
      {icon && <span className="grid h-6 w-6 place-items-center text-muted [&>svg]:h-5 [&>svg]:w-5">{icon}</span>}
      <span className="flex-1">
        {children}
        {hint && <span className="block text-xs font-normal text-muted">{hint}</span>}
      </span>
    </button>
  );
}

/** Bestätigungsdialog für destruktive Aktionen. */
export function ConfirmSheet({
  open,
  onOpenChange,
  title,
  text,
  confirmLabel,
  onConfirm,
  danger = true,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  text?: string;
  confirmLabel: string;
  onConfirm: () => void;
  danger?: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} description={text}>
      <div className="flex flex-col gap-2 pt-2">
        <button
          type="button"
          className={cn(
            'h-12 rounded-2xl font-semibold',
            danger ? 'bg-error text-white' : 'bg-primary text-primary-fg',
          )}
          onClick={() => {
            onConfirm();
            onOpenChange(false);
          }}
        >
          {confirmLabel}
        </button>
        <button type="button" className="h-12 rounded-2xl bg-surface-2 font-semibold" onClick={() => onOpenChange(false)}>
          Abbrechen
        </button>
      </div>
    </Sheet>
  );
}
