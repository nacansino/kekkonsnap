"use client";

import { useState, useId } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

interface TermsConsentProps {
  termsText?: string;
  onAgree: () => void;
  loading?: boolean;
  className?: string;
}

const defaultTerms = `By participating in this photo contest, you grant the happy couple permission to use, display, and share the photos you capture during the event. All photos become part of the wedding memories collection.

Please be respectful and mindful when taking photos. Enjoy the celebration and capture the joy!`;

export default function TermsConsent({
  termsText = defaultTerms,
  onAgree,
  loading = false,
  className = "",
}: TermsConsentProps) {
  const [agreed, setAgreed] = useState(false);
  const checkboxId = useId();

  return (
    <div className={`flex flex-col gap-5 ${className}`}>
      <Card padding="md" className="max-h-48 overflow-y-auto">
        <p className="text-sm text-charcoal-light leading-relaxed whitespace-pre-line">
          {termsText}
        </p>
      </Card>

      <label
        htmlFor={checkboxId}
        className="flex items-start gap-3 cursor-pointer select-none px-1"
      >
        <div className="relative mt-0.5">
          <input
            id={checkboxId}
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="peer sr-only"
          />
          <div
            className="
              h-5 w-5 rounded-md border-2 border-rose-dust/40
              transition-all duration-200
              peer-checked:bg-rose-dust peer-checked:border-rose-dust
              peer-focus-visible:ring-2 peer-focus-visible:ring-rose-dust/30 peer-focus-visible:ring-offset-2
            "
          >
            <svg
              viewBox="0 0 14 14"
              fill="none"
              className={`
                h-full w-full p-0.5 text-cream
                transition-all duration-200
                ${agreed ? "scale-100 opacity-100" : "scale-50 opacity-0"}
              `}
            >
              <path
                d="M11 4L5.5 9.5L3 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
        <span className="text-sm text-charcoal leading-snug">
          I understand and agree to the photo contest terms
        </span>
      </label>

      <Button
        onClick={onAgree}
        disabled={!agreed}
        loading={loading}
        variant="primary"
        size="lg"
        className="w-full"
      >
        Continue
      </Button>
    </div>
  );
}
