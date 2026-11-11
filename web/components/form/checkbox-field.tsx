type CheckboxFieldProps = {
  readonly label: string;
  readonly hint?: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
};

export const CheckboxField = ({ label, hint, checked, onChange }: CheckboxFieldProps) => (
  <label className="flex items-start gap-2.5">
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--accent)]"
    />
    <span className="flex flex-col gap-0.5">
      <span className="text-[13px] text-foreground">{label}</span>
      {hint ? <span className="text-xs text-foreground-tertiary">{hint}</span> : null}
    </span>
  </label>
);
