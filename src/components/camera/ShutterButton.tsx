"use client";

import { type ComponentProps } from "react";

interface ShutterButtonProps extends Omit<ComponentProps<"button">, "children"> {
  disabled?: boolean;
}

export default function ShutterButton({
  disabled = false,
  className = "",
  ...props
}: ShutterButtonProps) {
  return (
    <button
      disabled={disabled}
      aria-label="Take photo"
      className={`
        group relative
        h-[72px] w-[72px] rounded-full
        bg-white
        border-[3px] border-rose-dust
        shadow-lg shadow-black/20
        transition-all duration-150 ease-out
        active:scale-90
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent
        disabled:border-charcoal-light/30 disabled:opacity-50 disabled:active:scale-100
        ${className}
      `}
      {...props}
    >
      {/* Inner circle — fills on hover */}
      <span
        className="
          absolute inset-[5px] rounded-full
          bg-white
          transition-all duration-150
          group-hover:bg-rose-dust-light/20
          group-active:bg-rose-dust/30
          group-disabled:bg-gray-200
        "
      />
    </button>
  );
}
