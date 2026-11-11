import type { ReactNode } from "react";

type FormFieldProps = {
  readonly label: string;
  readonly hint?: string;
  readonly htmlFor?: string;
  readonly children: ReactNode;
};

export const FormField = ({ label, hint, htmlFor, children }: FormFieldProps) => (
  <div className="flex flex-col gap-1.5">
    <label htmlFor={htmlFor} className="text-xs font-medium text-foreground-secondary">
      {label}
    </label>
    {children}
    {hint ? <p className="text-xs text-foreground-tertiary">{hint}</p> : null}
  </div>
);
