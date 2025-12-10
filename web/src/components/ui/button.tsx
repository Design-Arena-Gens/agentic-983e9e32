'use client';

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef } from 'react';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-full border border-transparent font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:pointer-events-none disabled:opacity-60',
  {
    variants: {
      variant: {
        primary: 'bg-indigo-500/90 text-white hover:bg-indigo-400 shadow-lg shadow-indigo-500/20',
        secondary: 'bg-white/10 text-slate-100 hover:bg-white/15 border-white/10',
        ghost: 'bg-transparent text-slate-200 hover:bg-white/10 border-white/5',
        danger: 'bg-rose-500 text-white hover:bg-rose-400 shadow-lg shadow-rose-500/25',
      },
      size: {
        sm: 'px-3 py-1.5 text-xs',
        md: 'px-4 py-2 text-sm',
        lg: 'px-5 py-2.5 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp ref={ref} className={buttonVariants({ variant, size, className })} {...props} />;
});

Button.displayName = 'Button';
