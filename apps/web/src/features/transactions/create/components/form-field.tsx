import type { ReactNode } from 'react';

type FormFieldProps = {
  children: ReactNode;
  error?: string;
  errorId: string;
  htmlFor: string;
  label: string;
};

export function FormField({ children, error, errorId, htmlFor, label }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-on-surface" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[12px] text-error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
