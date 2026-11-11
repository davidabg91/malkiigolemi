"use client";

import { Gift, Heart, MapPin, Package, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/profil", label: "Поръчки", icon: Package },
  { href: "/profil/tochki", label: "Точки", icon: Gift },
  { href: "/profil/adres", label: "Адрес за доставка", icon: MapPin },
  { href: "/profil/danni", label: "Лични данни", icon: UserRound },
  { href: "/lyubimi", label: "Любими", icon: Heart },
];

export function ProfileNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Профил" className="no-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition ${active ? "bg-ink text-cream" : "bg-paper shadow-soft hover:bg-lime"}`}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
