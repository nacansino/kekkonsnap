"use client";

import { type ComponentProps } from "react";

const sizeMap = {
  sm: "h-4 w-4 border-2",
  md: "h-8 w-8 border-[3px]",
  lg: "h-12 w-12 border-4",
} as const;

interface LoadingSpinnerProps extends Omit<ComponentProps<"div">, "children"> {
  size?: keyof typeof sizeMap;
}

export default function LoadingSpinner({
  size = "md",
  className = "",
  ...props
}: LoadingSpinnerProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`inline-flex items-center justify-center ${className}`}
      {...props}
    >
      <div
        className={`${sizeMap[size]} animate-spin rounded-full border-rose-dust/25 border-t-rose-dust`}
      />
      <span className="sr-only">Loading...</span>
    </div>
  );
}
