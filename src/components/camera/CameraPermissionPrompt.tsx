"use client";

import Button from "@/components/ui/Button";

interface CameraPermissionPromptProps {
  onRetry: () => void;
  className?: string;
}

export default function CameraPermissionPrompt({
  onRetry,
  className = "",
}: CameraPermissionPromptProps) {
  return (
    <div
      className={`
        flex flex-col items-center justify-center gap-6
        px-8 py-12 text-center
        ${className}
      `}
    >
      {/* Camera icon */}
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-rose-dust/10">
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-rose-dust"
        >
          <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
          <circle cx="12" cy="13" r="3" />
          <line x1="2" y1="2" x2="22" y2="22" className="text-red-400" stroke="currentColor" />
        </svg>
      </div>

      <div className="space-y-2">
        <h2 className="font-heading text-xl text-charcoal">
          Camera Access Needed
        </h2>
        <p className="text-sm text-charcoal-light leading-relaxed max-w-xs">
          To capture your beautiful moments, we need access to your camera.
          Please allow camera permissions in your browser settings.
        </p>
      </div>

      <div className="space-y-3 text-left text-sm text-charcoal-light">
        <p className="font-medium text-charcoal">How to enable:</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Tap the lock icon in your browser&apos;s address bar</li>
          <li>Find &quot;Camera&quot; in the permissions list</li>
          <li>Set it to &quot;Allow&quot;</li>
          <li>Tap the button below to try again</li>
        </ol>
      </div>

      <Button onClick={onRetry} variant="primary" size="lg">
        Try Again
      </Button>
    </div>
  );
}
