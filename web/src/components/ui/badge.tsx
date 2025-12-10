'use client';

import { PropsWithChildren } from 'react';
import { twMerge } from 'tailwind-merge';

interface BadgeProps extends PropsWithChildren {
  className?: string;
}

export function Badge({ className, children }: BadgeProps) {
  return (
    <span className={twMerge('inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-300', className)}>
      {children}
    </span>
  );
}
