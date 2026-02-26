"use client";

import { useState, type ComponentProps } from "react";

type FlipCameraButtonProps = Omit<ComponentProps<"button">, "children">;

export default function FlipCameraButton({
  className = "",
  ...props
}: FlipCameraButtonProps) {
  const [flipped, setFlipped] = useState(false);

  return (
    <button
      aria-label="Flip camera"
      className={`
        flex h-10 w-10 items-center justify-center
        rounded-full
        bg-black/40 backdrop-blur-md
        text-white
        transition-all duration-200
        hover:bg-black/50
        active:scale-90
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white
        ${className}
      `}
      onClick={(e) => {
        setFlipped((f) => !f);
        props.onClick?.(e);
      }}
      {...props}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-transform duration-300"
        style={{ transform: flipped ? "rotate(180deg)" : "rotate(0deg)" }}
      >
        {/* Camera body */}
        <path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
        <path d="M13 5h5a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5" />
        {/* Flip arrows */}
        <polyline points="17 2 20 5 17 8" />
        <polyline points="7 16 4 19 7 22" />
        <line x1="20" y1="5" x2="13" y2="5" />
        <line x1="4" y1="19" x2="11" y2="19" />
      </svg>
    </button>
  );
}
