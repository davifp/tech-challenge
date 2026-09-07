import { type ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'ghost' | 'outlined';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const BASE =
  'inline-flex cursor-pointer items-center justify-center gap-2 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-50';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary-container font-semibold text-on-primary hover:bg-primary',
  ghost: 'font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface',
  outlined:
    'border border-outline-variant font-medium text-on-surface-variant hover:bg-surface-container-low',
};

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return (
    <button className={[BASE, VARIANTS[variant], className].filter(Boolean).join(' ')} {...props} />
  );
}
