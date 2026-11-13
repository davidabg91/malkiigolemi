"use client";

import { Activity, BadgePercent, BarChart3, ClipboardPaste, ExternalLink, Gift, MessageSquareText, FolderTree, LayoutDashboard, LogOut, Package, ReceiptText, Truck, Undo2, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/actions/auth";
import { Logo } from "@/components/ui";
import type { AdminAlerts } from "@/lib/admin-alerts";

const LINKS = [
  { href: "/admin", label: "Табло", icon: LayoutDashboard, exact: true },
  { href: "/admin/porachki", label: "Поръчки", icon: ReceiptText },
  { href: "/admin/otkazi", label: "Откази", icon: Undo2 },
  { href: "/admin/facebook", label: "От Facebook", icon: ClipboardPaste },
  { href: "/admin/produkti", label: "Продукти", icon: Package },
  { href: "/admin/kategorii", label: "Категории", icon: FolderTree },
  { href: "/admin/promocii", label: "Промоции", icon: BadgePercent },
  { href: "/admin/otzivi", label: "Отзиви", icon: MessageSquareText },
  { href: "/admin/lojalnost", label: "Точки", icon: Gift },
  { href: "/admin/potrebiteli", label: "Потребители", icon: Users },
  { href: "/admin/statistika", label: "Статистика", icon: BarChart3 },
  { href: "/admin/posetiteli", label: "Посетители", icon: Activity },
  { href: "/admin/kurieri", label: "Куриери", icon: Truck },
];

export function AdminNav({ name, alerts }: { name: string; alerts: AdminAlerts }) {
  const pathname = usePathname();
  return (
    <aside className="flex shrink-0 flex-col border-b border-line bg-paper lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:border-b-0 lg:border-r">
      {/* In the narrow sidebar the badge sits under the logo so the two never overlap. */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 lg:flex-col lg:items-start lg:gap-2 lg:py-6">
        <Logo />
        <span className="rounded-full bg-ink px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-lime">Админ</span>
      </div>
      <nav aria-label="Админ навигация" className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:pb-0">
        {LINKS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          const badge = href === "/admin/porachki" ? alerts.newOrders : href === "/admin/otkazi" ? alerts.withdrawals : href === "/admin/facebook" ? alerts.fbClaims : 0;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex h-11 items-center gap-3 whitespace-nowrap rounded-xl px-3.5 text-[0.95rem] font-medium transition ${active ? "bg-forest text-white" : "text-ink-soft hover:bg-sand hover:text-ink"}`}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
              {label}
              {badge > 0 && (
                <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-tomato px-1.5 text-xs font-bold text-white">{badge}</span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto hidden space-y-1 border-t border-line p-3 lg:block">
        <p className="truncate px-3.5 py-2 text-sm text-ink-soft">{name}</p>
        <Link href="/" className="flex h-11 items-center gap-3 rounded-xl px-3.5 text-[0.95rem] font-medium text-ink-soft hover:bg-sand hover:text-ink">
          <ExternalLink className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
          Към магазина
        </Link>
        <form action={logout}>
          <button type="submit" className="flex h-11 w-full items-center gap-3 rounded-xl px-3.5 text-[0.95rem] font-medium text-ink-soft hover:bg-sand hover:text-tomato">
            <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
            Изход
          </button>
        </form>
      </div>
    </aside>
  );
}
