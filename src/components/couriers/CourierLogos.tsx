import React from "react";
import type { CourierId } from "@/lib/couriers";

/** Official-styled vector logo for Econt */
export function EcontLogo({ className = "h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Еконт">
      <rect width="120" height="32" rx="6" fill="#0C3B7A" />
      <text
        x="60"
        y="22"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="800"
        fontSize="17"
        fill="#FFFFFF"
        letterSpacing="2.5"
      >
        ECONT
      </text>
    </svg>
  );
}

/** Official-styled vector logo for Speedy */
export function SpeedyLogo({ className = "h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Спиди">
      <rect width="120" height="32" rx="6" fill="#CB1818" />
      <text
        x="60"
        y="22"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="900"
        fontStyle="italic"
        fontSize="16"
        fill="#FFFFFF"
        letterSpacing="1.8"
      >
        SPEEDY
      </text>
    </svg>
  );
}

/** Official-styled vector logo for Box Now */
export function BoxNowLogo({ className = "h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Box Now">
      <rect width="120" height="32" rx="6" fill="#15803D" />
      <text
        x="60"
        y="21"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="800"
        fontSize="15"
        fill="#FFFFFF"
        letterSpacing="2"
      >
        BOX NOW
      </text>
    </svg>
  );
}

/** Official-styled vector logo for Penguin Express */
export function PenguinExpressLogo({ className = "h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 130 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Penguin Express">
      <rect width="130" height="32" rx="6" fill="#0F766E" />
      {/* Cute Penguin silhouette icon on the left */}
      <g transform="translate(10, 6) scale(0.85)">
        <ellipse cx="12" cy="12" rx="8" ry="11" fill="#134E4A" />
        <ellipse cx="12" cy="13" rx="5" ry="8" fill="#F0FDFA" />
        <circle cx="9.5" cy="8" r="1.2" fill="#134E4A" />
        <circle cx="14.5" cy="8" r="1.2" fill="#134E4A" />
        <polygon points="12,9 10,12 14,12" fill="#F59E0B" />
        <ellipse cx="9" cy="22" rx="2.5" ry="1.2" fill="#F59E0B" />
        <ellipse cx="15" cy="22" rx="2.5" ry="1.2" fill="#F59E0B" />
      </g>
      <text
        x="78"
        y="16"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="800"
        fontSize="11"
        fill="#FFFFFF"
        letterSpacing="1"
      >
        PENGUIN
      </text>
      <text
        x="78"
        y="25"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontWeight="700"
        fontSize="8.5"
        fill="#5EEAD4"
        letterSpacing="1.2"
      >
        EXPRESS
      </text>
    </svg>
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
    case "penguin":
      return <PenguinExpressLogo className={className} />;
    default:
      return null;
  }
}
