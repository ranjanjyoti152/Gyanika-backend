'use client';

import * as React from 'react';
import { type VariantProps, cva } from 'class-variance-authority';
import * as TogglePrimitive from '@radix-ui/react-toggle';
import { cn } from '@/lib/utils';

const toggleVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 rounded-full',
    'text-sm font-medium whitespace-nowrap',
    'cursor-pointer outline-none transition-all duration-200',
    'hover:bg-cyan-500/20 hover:text-cyan-300',
    'disabled:pointer-events-none disabled:opacity-50',
    'data-[state=on]:bg-cyan-500/30 data-[state=on]:text-cyan-200',
    'focus-visible:ring-cyan-400/50 focus-visible:ring-[3px] focus-visible:border-cyan-400',
    'aria-invalid:ring-red-500/20 aria-invalid:border-red-500',
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        primary:
          'bg-cyan-950/50 text-cyan-300 hover:bg-cyan-500/20 hover:text-cyan-200 data-[state=on]:bg-cyan-500/30',
        secondary:
          'bg-cyan-950/40 hover:bg-cyan-500/20 hover:text-cyan-200 data-[state=on]:bg-cyan-500/30 data-[state=on]:text-cyan-200 border border-cyan-500/20',
        outline:
          'border border-cyan-500/30 bg-transparent hover:bg-cyan-500/20 hover:text-cyan-200',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 px-6 has-[>svg]:px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
