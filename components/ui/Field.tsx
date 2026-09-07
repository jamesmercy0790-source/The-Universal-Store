import type { InputHTMLAttributes } from "react";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function Field({ label, id, ...props }: FieldProps) {
  const inputId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5 text-left">
      <label htmlFor={inputId} className="text-xs uppercase tracking-wide text-bone-500">
        {label}
      </label>
      <input
        id={inputId}
        className="rounded-sm border border-ink-700 bg-ink-900 px-4 py-3 text-sm text-bone-100 outline-none placeholder:text-bone-500 focus:border-brass-500"
        {...props}
      />
    </div>
  );
}
