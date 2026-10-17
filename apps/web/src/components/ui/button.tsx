import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl font-semibold transition-[transform,background,opacity] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 select-none',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-fg hover:brightness-105',
        secondary: 'bg-surface-2 text-text hover:bg-surface-3 border border-border',
        ghost: 'text-text hover:bg-surface-2',
        outline: 'border border-border text-text hover:bg-surface-2',
        danger: 'bg-error/15 text-error hover:bg-error/25 border border-error/30',
        link: 'text-primary underline-offset-4 hover:underline px-0 h-auto',
      },
      size: {
        sm: 'h-10 px-3 text-sm',
        md: 'h-12 px-4 text-[15px]',
        lg: 'h-14 px-6 text-base',
        icon: 'h-11 w-11',
        'icon-sm': 'h-9 w-9 rounded-xl',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, asChild, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        data-ui="button"
        data-variant={variant ?? 'primary'}
        data-size={size ?? 'md'}
        className={cn(buttonVariants({ variant, size, block }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {children}
          </>
        )}
      </Comp>
    );
  },
);
Button.displayName = 'Button';
