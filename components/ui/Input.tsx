import { InputHTMLAttributes, SelectHTMLAttributes, forwardRef, ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, className = "", id, ...rest }, ref) => {
    const inputId = id || rest.name;
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium uppercase tracking-wider text-ink-300"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          {...rest}
          className={`w-full rounded-lg border border-gold-400/15 bg-forest-900/60 px-3.5 py-2.5 text-sm text-ink-100 placeholder:text-ink-300/40 focus:border-gold-400/40 focus:outline-none focus:ring-1 focus:ring-gold-400/30 ${className}`}
        />
      </div>
    );
  }
);
Input.displayName = "Input";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  children: ReactNode;
}

export function Select({ label, className = "", children, id, ...rest }: SelectProps) {
  const selectId = id || rest.name;
  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={selectId}
          className="block text-xs font-medium uppercase tracking-wider text-ink-300"
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        {...rest}
        className={`w-full appearance-none rounded-lg border border-gold-400/15 bg-forest-900/60 px-3.5 py-2.5 text-sm text-ink-100 focus:border-gold-400/40 focus:outline-none focus:ring-1 focus:ring-gold-400/30 ${className}`}
      >
        {children}
      </select>
    </div>
  );
}
