"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import ShutterButton from "./ShutterButton";
import ShotCounter from "./ShotCounter";
import FlipCameraButton from "./FlipCameraButton";
import CameraPermissionPrompt from "./CameraPermissionPrompt";
import Button from "@/components/ui/Button";

interface CameraViewfinderProps {
  onCapture: (blob: Blob) => void;
  disabled: boolean;
  remainingShots: number;
  totalShots: number;
}

type CameraState = "initializing" | "ready" | "denied" | "error";

export default function CameraViewfinder({
  onCapture,
  disabled,
  remainingShots,
  totalShots,
}: CameraViewfinderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraState, setCameraState] = useState<CameraState>("initializing");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [flashVisible, setFlashVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(
    async (facing: "environment" | "user") => {
      stopStream();
      setCameraState("initializing");
      setErrorMessage("");

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setCameraState("ready");
      } catch (err) {
        const error = err as DOMException;
        if (
          error.name === "NotAllowedError" ||
          error.name === "PermissionDeniedError"
        ) {
          setCameraState("denied");
        } else {
          setCameraState("error");
          setErrorMessage(
            error.name === "NotFoundError"
              ? "No camera found on this device."
              : "Could not access the camera. Please try again."
          );
        }
      }
    },
    [stopStream]
  );

  useEffect(() => {
    startCamera(facingMode);
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFlip = useCallback(() => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    startCamera(next);
  }, [facingMode, startCamera]);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || disabled || remainingShots <= 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Mirror if front-facing camera
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0);

    // Flash effect
    setFlashVisible(true);
    setTimeout(() => setFlashVisible(false), 150);

    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(blob);
      },
      "image/jpeg",
      0.85
    );
  }, [disabled, remainingShots, facingMode, onCapture]);

  // -- Denied state --
  if (cameraState === "denied") {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-charcoal">
        <CameraPermissionPrompt onRetry={() => startCamera(facingMode)} />
      </div>
    );
  }

  // -- Error state --
  if (cameraState === "error") {
    return (
      <div className="flex h-dvh w-full flex-col items-center justify-center gap-6 bg-charcoal px-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="text-red-400"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <p className="text-white/80 text-sm max-w-xs">{errorMessage}</p>
        <Button onClick={() => startCamera(facingMode)} variant="primary">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black">
      {/* Video feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`
          absolute inset-0 h-full w-full object-cover
          ${facingMode === "user" ? "scale-x-[-1]" : ""}
        `}
      />

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Flash overlay */}
      {flashVisible && (
        <div className="absolute inset-0 z-30 bg-white animate-[flashFade_200ms_ease-out_forwards]" />
      )}

      {/* Loading overlay */}
      {cameraState === "initializing" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/20 border-t-white" />
            <p className="text-sm text-white/60">Starting camera...</p>
          </div>
        </div>
      )}

      {/* Disabled / quota reached overlay */}
      {disabled && cameraState === "ready" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 text-center px-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="text-white/80"
              >
                <rect x="2" y="6" width="20" height="14" rx="2" />
                <circle cx="12" cy="13" r="4" />
                <path d="M17 2l3 4H4l3-4" />
              </svg>
            </div>
            <p className="font-heading text-xl text-white">All shots used!</p>
            <p className="text-sm text-white/60">
              You&apos;ve captured all {totalShots} of your photos.
            </p>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <ShotCounter remaining={remainingShots} total={totalShots} />
        <FlipCameraButton onClick={handleFlip} />
      </div>

      {/* Bottom bar with shutter */}
      <div className="absolute bottom-0 inset-x-0 z-10 flex items-center justify-center pb-[max(2rem,env(safe-area-inset-bottom))] pt-4">
        <ShutterButton
          onClick={handleCapture}
          disabled={disabled || cameraState !== "ready" || remainingShots <= 0}
        />
      </div>
    </div>
  );
}
