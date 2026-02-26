"use client";

import { type ComponentProps } from "react";
import LoadingSpinner from "./LoadingSpinner";

const variantStyles = {
  primary:
    "bg-rose-dust text-cream hover:bg-rose-dust-dark active:bg-rose-dust-dark/90 shadow-sm hover:shadow-md",
  secondary:
    "border-2 border-rose-dust text-rose-dust bg-transparent hover:bg-rose-dust/5 active:bg-rose-dust/10",
  ghost:
    "text-charcoal-light hover:bg-charcoal/5 active:bg-charcoal/10",
} as const;

const sizeStyles = {
  sm: "px-4 py-1.5 text-sm gap-1.5",
  md: "px-6 py-2.5 text-base gap-2",
  lg: "px-8 py-3.5 text-lg gap-2.5",
} as const;

interface ButtonProps extends ComponentProps<"button"> {
  variant?: keyof typeof variantStyles;
  size?: keyof typeof sizeStyles;
  loading?: boolean;
}

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  className = "",
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center
        rounded-full font-body font-medium
        transition-all duration-200 ease-out
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-dust focus-visible:ring-offset-2 focus-visible:ring-offset-cream
        disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
        active:scale-[0.97]
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      {...props}
    >
      {loading && (
        <LoadingSpinner
          size={size === "lg" ? "sm" : "sm"}
          className="shrink-0"
        />
      )}
      {children}
    </button>
  );
}
