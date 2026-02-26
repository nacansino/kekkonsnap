import { type ComponentProps } from "react";

const paddingStyles = {
  sm: "p-3",
  md: "p-5",
  lg: "p-8",
} as const;

interface CardProps extends ComponentProps<"div"> {
  padding?: keyof typeof paddingStyles;
}

export default function Card({
  padding = "md",
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={`
        bg-white/80 backdrop-blur-sm
        rounded-2xl
        shadow-[0_2px_16px_rgba(0,0,0,0.06)]
        ${paddingStyles[padding]}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}
