import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils';

const baseClasses =
  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap';

const variants = {
  default: 'border-border bg-white/[0.04] text-foreground/80',
  success: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  destructive: 'border-rose-400/25 bg-rose-500/10 text-rose-300',
  warning: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
  outline: 'border-border text-muted-foreground',
};

export interface BadgeProps extends ComponentPropsWithoutRef<'div'> {
  variant?: keyof typeof variants;
}

export function Badge({
  className,
  variant = 'default',
  ...props
}: BadgeProps) {
  return (
    <div className={cn(baseClasses, variants[variant], className)} {...props} />
  );
}
