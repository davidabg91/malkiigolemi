import React from "react";
import type { CourierId } from "@/lib/couriers";

/** Official vector logo for Econt */
export function EcontLogo({ className = "h-6 w-auto" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a small static SVG logo
    <img
      src="/econt-logo.svg"
      alt="Еконт"
      className={`${className} object-contain`}
      loading="eager"
      decoding="async"
    />
  );
}

/** Official vector logo for Speedy */
export function SpeedyLogo({ className = "h-6 w-auto" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a small static SVG logo
    <img
      src="/speedy-logo.svg"
      alt="Спиди"
      className={`${className} object-contain`}
      loading="eager"
      decoding="async"
    />
  );
}

/** Official vector logo for Box Now */
export function BoxNowLogo({ className = "h-6 w-auto" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a small static SVG logo
    <img
      src="/boxnow-logo.svg"
      alt="Box Now"
      className={`${className} object-contain`}
      loading="eager"
      decoding="async"
    />
  );
}

/** Official vector logo for Pigeon Express */
export function PigeonExpressLogo({ className = "h-6 w-auto" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a small static SVG logo
    <img
      src="/pigeonexpress-logo.svg"
      alt="Pigeon Express"
      className={`${className} object-contain`}
      loading="eager"
      decoding="async"
    />
  );
}

/** Unified Courier Logo helper */
export function CourierLogo({
  courier,
  className = "h-6 w-auto",
}: {
  courier: CourierId;
  className?: string;
}) {
  switch (courier) {
    case "econt":
      return <EcontLogo className={className} />;
    case "speedy":
      return <SpeedyLogo className={className} />;
    case "boxnow":
      return <BoxNowLogo className={className} />;
    case "pigeon":
      return <PigeonExpressLogo className={className} />;
    default:
      return null;
  }
}
