"use client";

import { type ComponentProps, useId } from "react";

interface InputProps extends ComponentProps<"input"> {
  label?: string;
  error?: string;
}

export default function Input({
  label,
  error,
  className = "",
  id: propId,
  ...props
}: InputProps) {
  const generatedId = useId();
  const id = propId ?? generatedId;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={id}
          className="text-sm font-medium text-charcoal pl-1"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        className={`
          w-full rounded-xl bg-cream px-4 py-3
          text-charcoal placeholder:text-charcoal-light/50
          border-2 border-beige
          transition-all duration-200 ease-out
          focus:outline-none focus:border-rose-dust focus:ring-2 focus:ring-rose-dust/20
          hover:border-rose-dust-light/50
          disabled:opacity-50 disabled:cursor-not-allowed
          font-body text-base
          ${error ? "border-red-400 focus:border-red-400 focus:ring-red-400/20" : ""}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="text-sm text-red-500 pl-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
