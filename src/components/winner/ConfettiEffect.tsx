"use client";

import { useEffect, useRef, useCallback } from "react";

interface ConfettiEffectProps {
  active?: boolean;
  duration?: number;
  className?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  width: number;
  height: number;
  color: string;
  opacity: number;
  decay: number;
}

const COLORS = [
  "#a46658", // rose-dust
  "#c4887a", // rose-dust-light
  "#fffbf6", // cream
  "#d4a843", // gold
  "#e8c469", // light gold
  "#f0d68a", // pale gold
  "#b8765e", // warm rose
];

export default function ConfettiEffect({
  active = true,
  duration = 3000,
  className = "",
}: ConfettiEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const startTimeRef = useRef<number>(0);

  const createParticles = useCallback((canvas: HTMLCanvasElement) => {
    const particles: Particle[] = [];
    const count = Math.min(120, Math.floor(canvas.width * 0.15));

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * canvas.height * 0.4,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 2,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        width: Math.random() * 8 + 4,
        height: Math.random() * 6 + 2,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        opacity: 1,
        decay: 0.0003 + Math.random() * 0.0005,
      });
    }

    return particles;
  }, []);

  const animate = useCallback(
    (timestamp: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const elapsed = timestamp - startTimeRef.current;
      if (elapsed > duration + 1500) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let aliveCount = 0;

      for (const p of particlesRef.current) {
        if (p.opacity <= 0) continue;
        aliveCount++;

        // Physics
        p.x += p.vx;
        p.vy += 0.06; // gravity
        p.y += p.vy;
        p.vx *= 0.99; // air drag
        p.rotation += p.rotationSpeed;

        // Fade out after duration
        if (elapsed > duration * 0.6) {
          p.opacity -= p.decay * 16;
        }

        // Draw
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
        ctx.restore();
      }

      if (aliveCount > 0) {
        animationRef.current = requestAnimationFrame(animate);
      }
    },
    [duration]
  );

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    particlesRef.current = createParticles(canvas);
    startTimeRef.current = performance.now();
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [active, createParticles, animate]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none fixed inset-0 z-[60] ${className}`}
      aria-hidden
    />
  );
}
